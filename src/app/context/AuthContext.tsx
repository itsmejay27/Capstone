import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, MutationResult } from '../types';
import { mockUsers, mockClassrooms, mockExams, mockQuestionBank, mockExamAttempts } from '../data/mockData';
import { parseGoogleJwt } from '../utils/authUtils';
import * as db from '../services/supabaseData';
import { removeClassroomFile } from '../services/fileStorage';
import { notifyAnnouncement, notifyAssignment } from '../services/emailService';

/** Per-assignment detail captured when a template is posted to a class. */
export interface AssignmentOptions {
  postDate: string;
  dueDate: string;
  /** Overrides the template title for this class only; blank keeps the template's. */
  title?: string;
  instructions?: string;
  topicId?: string;
  totalPoints?: number;
  allowedAttempts?: number;
  allowLate?: boolean;
  shuffleQuestions?: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  loginWithGoogle: (credential: string, role?: UserRole) => boolean;
  logout: () => void;
  switchAccount: (userId: string) => void;
  /** Updates the signed-in user's display name and/or avatar. */
  updateProfile: (changes: { name?: string; avatar?: string }) => Promise<MutationResult>;
  /** Changes the signed-in user's password after verifying the current one. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<MutationResult>;
  isAuthenticated: boolean;

  // Reactive state, hydrated from Supabase when available and mirrored to localStorage as a fallback cache
  classrooms: any[];
  exams: any[];
  savedExams: any[];
  examAttempts: any[];
  reviewers: any[];
  questionBank: any[];
  classroomMaterials: Record<string, any[]>; // classroomId -> materials[]
  announcements: Record<string, any[]>; // classroomId -> announcements[]
  topics: Record<string, any[]>; // classroomId -> topics[]
  classwork: Record<string, any[]>; // classroomId -> classwork[]
  submissions: any[]; // flat: spans classes, filtered by classworkId/studentId
  comments: any[]; // flat: filtered by postType + postId

  // Mutators
  addClassroom: (classroom: any) => void;
  joinClassroom: (classCode: string, studentId: string) => boolean;
  saveExamToRepository: (exam: any) => void;
  assignExamToClassroom: (examId: string, classroomId: string, options: AssignmentOptions) => void;
  submitExamAttempt: (attempt: any) => void;
  saveReviewer: (reviewer: any) => void;
  saveQuestionBankItem: (item: any) => void;
  deleteQuestionBankItem: (itemId: string) => void;
  deleteReviewer: (reviewerId: string) => void;
  updateReviewer: (reviewer: any) => void;
  updateExamInRepository: (exam: any) => void;
  deleteExamFromRepository: (examId: string) => void;
  // Material and announcement writes report success/failure so the UI can surface a failed
  // upload instead of optimistically showing a row that never persisted.
  addClassroomMaterial: (classroomId: string, material: any) => Promise<MutationResult>;
  deleteClassroomMaterial: (classroomId: string, materialId: string) => Promise<MutationResult>;
  saveAnnouncement: (announcement: any) => Promise<MutationResult>;
  deleteAnnouncement: (classroomId: string, announcementId: string) => Promise<MutationResult>;
  saveTopic: (topic: any) => Promise<MutationResult>;
  deleteTopic: (classroomId: string, topicId: string) => Promise<MutationResult>;
  saveClasswork: (work: any) => Promise<MutationResult>;
  deleteClasswork: (classroomId: string, classworkId: string) => Promise<MutationResult>;
  saveSubmission: (submission: any) => Promise<MutationResult>;
  saveComment: (comment: any) => Promise<MutationResult>;
  deleteComment: (commentId: string) => Promise<MutationResult>;
  archiveClassroom: (classroomId: string) => void;
  unarchiveClassroom: (classroomId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Union of a local array and a remote one, keyed by id. Remote wins on conflict (it is the
 * shared source of truth) but local-only rows SURVIVE, which is the whole point: a row that
 * has not reached the server yet must not vanish when hydration lands.
 */
function mergeById(
  local: any[],
  remote: any[],
  resolve: (local: any, remote: any) => any = (_l, r) => r
): any[] {
  const byId = new Map<string, any>();
  for (const item of local || []) if (item?.id) byId.set(String(item.id), item);
  for (const item of remote || []) {
    if (!item?.id) continue;
    const key = String(item.id);
    const existing = byId.get(key);
    byId.set(key, existing ? resolve(existing, item) : item);
  }
  return Array.from(byId.values());
}

/** Same merge, applied per classroom across a Record<classroomId, rows[]>. */
function mergeGroupedById(
  local: Record<string, any[]>,
  remote: Record<string, any[]>
): Record<string, any[]> {
  const out: Record<string, any[]> = { ...local };
  for (const key of Object.keys(remote)) {
    out[key] = mergeById(local[key] || [], remote[key] || []);
  }
  return out;
}

/**
 * localStorage is a best-effort cache, not the source of truth. Writing a large payload
 * (e.g. a base64 data-URL attachment in offline mode) can exceed the ~5MB origin quota and
 * throw QuotaExceededError; unguarded inside a useEffect that surfaces as an uncaught error
 * and blanks the app. Degrade to "not cached" instead.
 */
function safeSetItem(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storage] Could not cache "${key}" in localStorage (quota or serialisation):`, e);
  }
}

/** Counterpart to safeSetItem: read a cached collection, falling back on any parse failure. */
function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => {
    const stored = localStorage.getItem('registeredUsers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    localStorage.setItem('registeredUsers', JSON.stringify(mockUsers));
    return mockUsers;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedId = localStorage.getItem('currentUserId');
    if (savedId) {
      const stored = localStorage.getItem('registeredUsers');
      const currentUsers: User[] = stored ? JSON.parse(stored) : mockUsers;
      return currentUsers.find((u) => u.id === savedId) || null;
    }
    return null;
  });

  // Local state initialization (falls back to localStorage, then seed mock data; Supabase hydration below can override once loaded)
  const [classrooms, setClassrooms] = useState<any[]>(() => {
    const stored = localStorage.getItem('classrooms');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Fallback
      }
    }
    localStorage.setItem('classrooms', JSON.stringify(mockClassrooms));
    return mockClassrooms;
  });

  const [exams, setExams] = useState<any[]>(() => {
    const stored = localStorage.getItem('exams');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Revive date objects if any
        return parsed.map((e: any) => ({
          ...e,
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
          dueDate: e.dueDate ? new Date(e.dueDate) : undefined,
          postDate: e.postDate ? new Date(e.postDate) : undefined,
        }));
      } catch (e) {
        // Fallback
      }
    }
    localStorage.setItem('exams', JSON.stringify(mockExams));
    return mockExams;
  });

  const [savedExams, setSavedExams] = useState<any[]>(() => {
    const stored = localStorage.getItem('savedExams');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Fallback
      }
    }
    // Seed with a mock saved exam template in the repository
    const initialSaved = [
      {
        id: 'se-template-1',
        title: 'Diagnostic Quiz - JavaScript Mechanics',
        description: 'Comprehensive diagnostic exam covering scope, hoisting, closures, and async event loops.',
        questions: [
          {
            id: 'q-seq-1',
            type: 'multiple-choice',
            question: 'What is the output of console.log(typeof NaN)?',
            options: ['"number"', '"NaN"', '"undefined"', '"object"'],
            correctAnswer: 0,
            points: 10,
            difficulty: 'easy',
            topic: 'JS Types'
          },
          {
            id: 'q-seq-2',
            type: 'true-false',
            question: 'Strict equality (===) performs type coercion before comparison.',
            correctAnswer: 'false',
            points: 10,
            difficulty: 'easy',
            topic: 'JS Scope'
          },
          {
            id: 'q-seq-3',
            type: 'short-answer',
            question: 'What keyword was introduced in ES6 to declare block-scoped variable that can be reassigned?',
            correctAnswer: 'let',
            points: 10,
            difficulty: 'medium',
            topic: 'ES6 Syntax'
          },
          {
            id: 'q-seq-4',
            type: 'essay',
            question: 'Describe how closure works in JavaScript and give a practical use case.',
            points: 20,
            difficulty: 'hard',
            topic: 'Closures'
          }
        ],
        totalPoints: 50,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
      }
    ];
    localStorage.setItem('savedExams', JSON.stringify(initialSaved));
    return initialSaved;
  });

  const [examAttempts, setExamAttempts] = useState<any[]>(() => {
    const stored = localStorage.getItem('examAttempts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((a: any) => ({
          ...a,
          submittedAt: a.submittedAt ? new Date(a.submittedAt) : undefined,
          startedAt: a.startedAt ? new Date(a.startedAt) : new Date(),
        }));
      } catch (e) {
        // Fallback
      }
    }
    localStorage.setItem('examAttempts', JSON.stringify(mockExamAttempts));
    return mockExamAttempts;
  });

  const [questionBank, setQuestionBank] = useState<any[]>(() => {
    const stored = localStorage.getItem('questionBank');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return mockQuestionBank;
  });

  const [reviewers, setReviewers] = useState<any[]>(() => {
    const stored = localStorage.getItem('reviewers');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    // Seed with a default student reviewer
    const initialReviewers = [
      {
        id: 'rev-1',
        title: 'Reviewer: Web Technologies Study Aid',
        subject: 'Computer Science',
        difficulty: 'normal',
        difficultyLabel: 'Normal – Multiple Choice (2 modules)',
        moduleCount: 2,
        itemsPerModule: 2,
        source: 'Sample Course Material',
        status: 'in-progress',
        currentModuleIndex: 0,
        modules: [
          {
            id: 'mod-seed-1',
            number: 1,
            title: 'Module 1: CSS & Web Layouts',
            topic: 'CSS & Web Layouts',
            lessonContent: '### Module 1: CSS & Web Layouts\n\nCSS (Cascading Style Sheets) enables styling and media queries for responsive web application layouts across different devices.',
            questions: [
              {
                id: 'rq-1',
                type: 'multiple-choice',
                question: 'Which of the following describes the purpose of a CSS Media Query?',
                options: [
                  'To query the database for styling values',
                  'To apply styles based on device screen characteristics',
                  'To play media files in the background',
                  'To configure structural HTML tags'
                ],
                correctAnswer: 1,
                explanation: 'Media queries allow web developers to apply different CSS rules depending on the rendering device screen width, orientation, and resolution.'
              }
            ],
            status: 'unlocked',
            bestScore: null,
            attempts: 0,
          },
          {
            id: 'mod-seed-2',
            number: 2,
            title: 'Module 2: DOM & JavaScript Execution',
            topic: 'DOM & JavaScript Execution',
            lessonContent: '### Module 2: DOM & JavaScript Execution\n\nThe Document Object Model (DOM) is an object representation of HTML nodes in memory, allowing script manipulation.',
            questions: [
              {
                id: 'rq-2',
                type: 'true-false',
                question: 'The DOM (Document Object Model) is a built-in compiler for JS code.',
                correctAnswer: 'false',
                explanation: 'The DOM is an API representation of the HTML document structure, permitting JavaScript scripts to access and manipulate page nodes dynamically.'
              }
            ],
            status: 'unlocked',
            bestScore: null,
            attempts: 0,
          }
        ],
        createdAt: new Date().toISOString(),
      }
    ];
    localStorage.setItem('reviewers', JSON.stringify(initialReviewers));
    return initialReviewers;
  });

  const [classroomMaterials, setClassroomMaterials] = useState<Record<string, any[]>>(() => {
    const stored = localStorage.getItem('classroomMaterials');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return {};
  });

  const [announcements, setAnnouncements] = useState<Record<string, any[]>>(() => {
    const stored = localStorage.getItem('announcements');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return {};
  });

  const [topics, setTopics] = useState<Record<string, any[]>>(() => readCache('classroomTopics', {}));
  const [classwork, setClasswork] = useState<Record<string, any[]>>(() => readCache('classwork', {}));
  const [submissions, setSubmissions] = useState<any[]>(() => readCache('classworkSubmissions', []));
  const [comments, setComments] = useState<any[]>(() => readCache('postComments', []));

  // ── Supabase hydration ──
  // Best-effort: if the Supabase project has rows for a given collection, prefer them.
  // Otherwise keep whatever localStorage/mock data was loaded above, so the app never
  // regresses to an empty state (e.g. if RLS blocks anonymous reads for a table).
  useEffect(() => {
    (async () => {
      // A session restored from localStorage must exist in Supabase too: classrooms,
      // exams, attempts and materials all carry a foreign key to this user, and an
      // insert against a missing user row fails with a FK violation.
      if (currentUser) await db.upsertUser(currentUser);

      const [
        dbUsers, dbClassrooms, dbExams, dbSavedExams, dbAttempts, dbReviewers, dbQuestionBank,
        dbMaterials, dbAnnouncements, dbTopics, dbClasswork, dbSubmissions, dbComments,
      ] = await Promise.all([
        db.fetchUsers(),
        db.fetchClassrooms(),
        db.fetchExams(),
        db.fetchSavedExams(),
        db.fetchExamAttempts(),
        db.fetchReviewers(),
        db.fetchQuestionBank(),
        db.fetchClassroomMaterials(),
        db.fetchAnnouncements(),
        db.fetchTopics(),
        db.fetchClasswork(),
        db.fetchSubmissions(),
        db.fetchComments(),
      ]);

      if (dbUsers.length > 0) {
        setUsers((prev) => {
          const byEmail = new Map(dbUsers.map((u) => [u.email.toLowerCase(), u]));
          const merged = prev.map((u) => byEmail.get(u.email.toLowerCase()) ? { ...u, ...byEmail.get(u.email.toLowerCase()), password: u.password } : u);
          const existingEmails = new Set(merged.map((u) => u.email.toLowerCase()));
          const extra = dbUsers.filter((u) => !existingEmails.has(u.email.toLowerCase()));
          return [...merged, ...extra];
        });
      }
      if (dbClassrooms.length > 0) setClassrooms(dbClassrooms);
      if (dbExams.length > 0) setExams(dbExams);
      if (dbSavedExams.length > 0) setSavedExams(dbSavedExams);
      if (dbReviewers.length > 0) setReviewers(dbReviewers);
      if (dbQuestionBank.length > 0) setQuestionBank(dbQuestionBank);

      // Attempts merge by id rather than replace. A wholesale replace would drop the locally
      // cached `questions` snapshot of any attempt whose row predates that column, and item
      // analysis cannot interpret a multiple-choice answer index without it.
      if (dbAttempts.length > 0) {
        setExamAttempts((prev) => mergeById(prev, dbAttempts, (local, remote) => ({
          ...local,
          ...remote,
          questions:
            Array.isArray(remote.questions) && remote.questions.length > 0
              ? remote.questions
              : local.questions,
        })));
      }

      // Materials and announcements merge PER CLASSROOM and PER ROW.
      // The previous code replaced the whole map whenever the DB returned any row at all.
      // Because database/seed.sql seeds two materials, that condition was true on every
      // mount of a seeded project, so it deterministically erased every locally uploaded
      // material — and wiped classrooms the DB had no rows for at all.
      if (Object.keys(dbMaterials).length > 0) {
        setClassroomMaterials((prev) => mergeGroupedById(prev, dbMaterials));
      }
      if (Object.keys(dbAnnouncements).length > 0) {
        setAnnouncements((prev) => mergeGroupedById(prev, dbAnnouncements));
      }
      if (Object.keys(dbTopics).length > 0) setTopics((prev) => mergeGroupedById(prev, dbTopics));
      if (Object.keys(dbClasswork).length > 0) setClasswork((prev) => mergeGroupedById(prev, dbClasswork));
      if (dbSubmissions.length > 0) setSubmissions((prev) => mergeById(prev, dbSubmissions));
      if (dbComments.length > 0) setComments((prev) => mergeById(prev, dbComments));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('registeredUsers', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('classrooms', JSON.stringify(classrooms));
  }, [classrooms]);

  useEffect(() => {
    localStorage.setItem('exams', JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem('savedExams', JSON.stringify(savedExams));
  }, [savedExams]);

  useEffect(() => {
    localStorage.setItem('examAttempts', JSON.stringify(examAttempts));
  }, [examAttempts]);

  useEffect(() => {
    localStorage.setItem('reviewers', JSON.stringify(reviewers));
  }, [reviewers]);

  // Materials and announcements can carry base64 data URLs in offline mode, so these two
  // writes are the ones most likely to hit the storage quota.
  useEffect(() => {
    safeSetItem('classroomMaterials', classroomMaterials);
  }, [classroomMaterials]);

  useEffect(() => {
    safeSetItem('announcements', announcements);
  }, [announcements]);

  useEffect(() => { safeSetItem('classroomTopics', topics); }, [topics]);
  useEffect(() => { safeSetItem('classwork', classwork); }, [classwork]);
  useEffect(() => { safeSetItem('classworkSubmissions', submissions); }, [submissions]);
  useEffect(() => { safeSetItem('postComments', comments); }, [comments]);

  useEffect(() => {
    safeSetItem('questionBank', questionBank);
  }, [questionBank]);

  /**
   * Applies a change to the signed-in user across all three places a user is held: the
   * `users` list, the `currentUser` slot, and Supabase. Missing any one of them is what
   * makes a profile edit appear to work and then revert on the next page load.
   */
  const applyUserChange = async (changes: Partial<User>): Promise<MutationResult> => {
    if (!currentUser) return { ok: false, error: 'Not signed in.' };
    const updated: User = { ...currentUser, ...changes };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    try {
      await db.upsertUser(updated);
      return { ok: true };
    } catch (err: any) {
      // The local state above already reflects the change and localStorage will cache it,
      // so the edit is not lost — but say plainly that it did not reach the server.
      return { ok: false, error: err?.message || 'Saved locally, but the server rejected the update.' };
    }
  };

  const updateProfile = async (changes: { name?: string; avatar?: string }): Promise<MutationResult> => {
    const name = changes.name?.trim();
    if (changes.name !== undefined && !name) {
      return { ok: false, error: 'Name cannot be empty.' };
    }
    const patch: Partial<User> = {};
    if (name) patch.name = name;
    if (changes.avatar !== undefined) patch.avatar = changes.avatar;
    return applyUserChange(patch);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<MutationResult> => {
    if (!currentUser) return { ok: false, error: 'Not signed in.' };
    // A Google-provisioned account has no local password to verify against.
    if (!currentUser.password) {
      return { ok: false, error: 'This account signs in with Google and has no password to change.' };
    }
    if (currentUser.password !== currentPassword) {
      return { ok: false, error: 'Current password is incorrect.' };
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters.' };
    }
    if (newPassword === currentPassword) {
      return { ok: false, error: 'New password must differ from the current one.' };
    }
    return applyUserChange({ password: newPassword });
  };

  const login = (email: string, password: string): boolean => {
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUserId', user.id);
      // Mirror the user into Supabase so later inserts that reference them succeed.
      db.upsertUser(user);
      return true;
    }
    return false;
  };

  const loginWithGoogle = (credential: string, role: UserRole = 'instructor'): boolean => {
    const payload = parseGoogleJwt(credential);
    if (!payload || !payload.email) {
      return false;
    }

    const googleEmail = payload.email.toLowerCase();
    const existingUser = users.find((u) => u.email.toLowerCase() === googleEmail);

    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        name: payload.name || existingUser.name,
        avatar: payload.picture || existingUser.avatar,
      };
      setUsers((prev) => prev.map((u) => (u.id === existingUser.id ? updatedUser : u)));
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUserId', updatedUser.id);
      db.upsertUser(updatedUser);
      return true;
    }

    const newUser: User = {
      id: `google-${payload.sub || Date.now()}`,
      email: payload.email,
      password: '',
      name: payload.name || payload.email.split('@')[0],
      role: role,
      avatar: payload.picture,
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUser(newUser);
    localStorage.setItem('currentUserId', newUser.id);
    db.upsertUser(newUser);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUserId');
  };

  const switchAccount = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUserId', user.id);
      db.upsertUser(user);
    }
  };

  const addClassroom = (classroom: any) => {
    setClassrooms((prev) => [...prev, classroom]);
    db.upsertClassroom(classroom);
  };

  const joinClassroom = (classCode: string, studentId: string): boolean => {
    const target = classrooms.find((c) => c.classCode.toLowerCase() === classCode.trim().toLowerCase());
    if (target) {
      if (!target.students.includes(studentId)) {
        setClassrooms((prev) => prev.map((c) => {
          if (c.id === target.id) {
            return { ...c, students: [...c.students, studentId] };
          }
          return c;
        }));
        db.addClassroomStudent(target.id, studentId);
      }
      return true;
    }
    return false;
  };

  const saveExamToRepository = (exam: any) => {
    setSavedExams((prev) => {
      // Check if already exists, then overwrite/update
      const idx = prev.findIndex((e) => e.id === exam.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = exam;
        return updated;
      }
      return [...prev, exam];
    });
    db.upsertSavedExam(exam);
  };

  const updateExamInRepository = (exam: any) => {
    saveExamToRepository(exam);
  };

  const deleteExamFromRepository = (examId: string) => {
    setSavedExams((prev) => prev.filter((e) => e.id !== examId));
    setExams((prev) => prev.filter((e) => e.id !== examId && e.sourceExamId !== examId));
    db.deleteSavedExamDb(examId);
  };

  // ── Classwork, topics, submissions, comments ──
  // All follow the same shape: optimistic local update, then an awaited write-through whose
  // failure is reported back to the caller so the UI can surface it.

  const saveTopic = async (topic: any): Promise<MutationResult> => {
    setTopics((prev) => {
      const list = prev[topic.classroomId] || [];
      const idx = list.findIndex((t: any) => t.id === topic.id);
      const next = idx > -1 ? list.map((t: any) => (t.id === topic.id ? topic : t)) : [...list, topic];
      return { ...prev, [topic.classroomId]: next.sort((a: any, b: any) => a.position - b.position) };
    });
    try {
      await db.upsertTopic(topic);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: `Topic saved on this device but not to the server${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const deleteTopic = async (classroomId: string, topicId: string): Promise<MutationResult> => {
    const previous = topics[classroomId] || [];
    setTopics((prev) => ({ ...prev, [classroomId]: (prev[classroomId] || []).filter((t: any) => t.id !== topicId) }));
    // Classwork under a deleted topic becomes untopiced rather than disappearing with it.
    setClasswork((prev) => ({
      ...prev,
      [classroomId]: (prev[classroomId] || []).map((w: any) => (w.topicId === topicId ? { ...w, topicId: null } : w)),
    }));
    try {
      await db.deleteTopicDb(topicId);
      return { ok: true };
    } catch (e: any) {
      setTopics((prev) => ({ ...prev, [classroomId]: previous }));
      return { ok: false, error: `Could not delete the topic${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const saveClasswork = async (work: any): Promise<MutationResult> => {
    setClasswork((prev) => {
      const list = prev[work.classroomId] || [];
      const idx = list.findIndex((w: any) => w.id === work.id);
      const next = idx > -1 ? list.map((w: any) => (w.id === work.id ? work : w)) : [work, ...list];
      return { ...prev, [work.classroomId]: next };
    });
    try {
      await db.upsertClasswork(work);
      // Notify only on first publish of an assignment — not on edits, and not for materials.
      if (!work.updatedAt && work.isPublished !== false && work.kind !== 'material') {
        const classroom = classrooms.find((c: any) => c.id === work.classroomId);
        if (classroom) {
          void notifyAssignment(classroom, users, {
            title: work.title,
            instructions: work.instructions,
            dueLabel: work.dueDate ? `due ${new Date(work.dueDate).toLocaleDateString()}` : undefined,
          });
        }
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: `"${work?.title ?? 'Classwork'}" is saved on this device but did not reach the server${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const deleteClasswork = async (classroomId: string, classworkId: string): Promise<MutationResult> => {
    const previous = classwork[classroomId] || [];
    setClasswork((prev) => ({ ...prev, [classroomId]: (prev[classroomId] || []).filter((w: any) => w.id !== classworkId) }));
    setSubmissions((prev) => prev.filter((s: any) => s.classworkId !== classworkId));
    try {
      await db.deleteClassworkDb(classworkId);
      return { ok: true };
    } catch (e: any) {
      setClasswork((prev) => ({ ...prev, [classroomId]: previous }));
      return { ok: false, error: `Could not delete the assignment${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const saveSubmission = async (submission: any): Promise<MutationResult> => {
    setSubmissions((prev) => {
      // Keyed by (classwork, student), not by id: a resubmission must replace the existing
      // row rather than add a second one that would double-count in the gradebook.
      const idx = prev.findIndex(
        (s: any) => s.classworkId === submission.classworkId && s.studentId === submission.studentId
      );
      return idx > -1 ? prev.map((s: any, i: number) => (i === idx ? submission : s)) : [...prev, submission];
    });
    try {
      await db.upsertSubmission(submission);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: `Your work is saved on this device but did not reach the server${e?.message ? ` (${e.message})` : ''}. Try again before the due date.` };
    }
  };

  const saveComment = async (comment: any): Promise<MutationResult> => {
    setComments((prev) => {
      const idx = prev.findIndex((c: any) => c.id === comment.id);
      return idx > -1 ? prev.map((c: any) => (c.id === comment.id ? comment : c)) : [...prev, comment];
    });
    try {
      await db.upsertComment(comment);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: `Comment posted on this device but not to the server${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const deleteComment = async (commentId: string): Promise<MutationResult> => {
    const previous = comments;
    setComments((prev) => prev.filter((c: any) => c.id !== commentId));
    try {
      await db.deleteCommentDb(commentId);
      return { ok: true };
    } catch (e: any) {
      setComments(previous);
      return { ok: false, error: `Could not delete the comment${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const archiveClassroom = (classroomId: string) => {
    setClassrooms((prev) => {
      const updated = prev.map((c) => (c.id === classroomId ? { ...c, isArchived: true } : c));
      const target = updated.find((c) => c.id === classroomId);
      if (target) db.upsertClassroom(target);
      return updated;
    });
  };

  const unarchiveClassroom = (classroomId: string) => {
    setClassrooms((prev) => {
      const updated = prev.map((c) => (c.id === classroomId ? { ...c, isArchived: false } : c));
      const target = updated.find((c) => c.id === classroomId);
      if (target) db.upsertClassroom(target);
      return updated;
    });
  };

  const assignExamToClassroom = (examId: string, classroomId: string, options: AssignmentOptions) => {
    const repoExam = savedExams.find((e) => e.id === examId);
    if (repoExam) {
      const activeExam = {
        ...repoExam,
        id: crypto.randomUUID(),
        sourceExamId: repoExam.id,
        classroomId,
        isPublished: true,
        // A blank override keeps the template's own title/points, so an instructor who
        // fills in nothing gets exactly the previous behaviour.
        title: options.title?.trim() || repoExam.title,
        instructions: options.instructions?.trim() || '',
        topicId: options.topicId || undefined,
        totalPoints: options.totalPoints ?? repoExam.totalPoints,
        allowedAttempts: options.allowedAttempts ?? 1,
        allowLate: !!options.allowLate,
        shuffleQuestions: !!options.shuffleQuestions,
        postDate: new Date(options.postDate),
        dueDate: new Date(options.dueDate),
        createdAt: new Date(),
      };
      setExams((prev) => [...prev, activeExam]);
      db.upsertExam(activeExam);
    }
  };

  const submitExamAttempt = (attempt: any) => {
    setExamAttempts((prev) => {
      const idx = prev.findIndex((a) => a.id === attempt.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = attempt;
        return updated;
      }
      return [...prev, attempt];
    });
    db.upsertExamAttempt(attempt);
  };

  const saveQuestionBankItem = (item: any) => {
    setQuestionBank((prev) => {
      const idx = prev.findIndex((q) => q.id === item.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = item;
        return updated;
      }
      return [item, ...prev];
    });
    db.upsertQuestionBankItem(item);
  };

  const deleteQuestionBankItem = (itemId: string) => {
    setQuestionBank((prev) => prev.filter((q) => q.id !== itemId));
    db.deleteQuestionBankItemDb(itemId);
  };

  const saveReviewer = (reviewer: any) => {
    setReviewers((prev) => [...prev, reviewer]);
    db.upsertReviewer(reviewer);
  };

  const deleteReviewer = (reviewerId: string) => {
    setReviewers((prev) => prev.filter((r) => r.id !== reviewerId));
    db.deleteReviewerDb(reviewerId);
  };

  const updateReviewer = (reviewer: any) => {
    setReviewers((prev) => prev.map((r) => r.id === reviewer.id ? reviewer : r));
    db.upsertReviewer(reviewer);
  };

  /**
   * Optimistic insert, then write through. The write is AWAITED and its failure reported,
   * because these were previously fire-and-forget: a failed insert (RLS refusal, FK violation
   * against a classroom that only exists in localStorage, network error) only reached a
   * console.warn, so the instructor saw the row appear and assumed it had saved.
   */
  const addClassroomMaterial = async (classroomId: string, material: any): Promise<MutationResult> => {
    setClassroomMaterials((prev) => ({
      ...prev,
      [classroomId]: [material, ...(prev[classroomId] || [])],
    }));
    try {
      await db.insertClassroomMaterial(classroomId, material);
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        error:
          `"${material?.name ?? 'File'}" is available on this device but could not be saved to the server` +
          `${e?.message ? ` (${e.message})` : ''}. It may not appear for other users.`,
      };
    }
  };

  const deleteClassroomMaterial = async (classroomId: string, materialId: string): Promise<MutationResult> => {
    const previous = classroomMaterials[classroomId] || [];
    const target = previous.find((m: any) => m.id === materialId);
    setClassroomMaterials((prev) => ({
      ...prev,
      [classroomId]: (prev[classroomId] || []).filter((m: any) => m.id !== materialId),
    }));
    try {
      await db.deleteClassroomMaterialDb(materialId);
      // Only drop the stored object once the row is gone, so a failed delete cannot orphan it.
      await removeClassroomFile(target?.storagePath);
      return { ok: true };
    } catch (e: any) {
      // Roll the row back into view rather than leaving a "zombie" that reappears on reload.
      setClassroomMaterials((prev) => ({ ...prev, [classroomId]: previous }));
      return { ok: false, error: `Could not remove "${target?.name ?? 'the file'}"${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  const saveAnnouncement = async (announcement: any): Promise<MutationResult> => {
    const classroomId = announcement.classroomId;
    setAnnouncements((prev) => {
      const existing = prev[classroomId] || [];
      const idx = existing.findIndex((a: any) => a.id === announcement.id);
      const next = idx > -1
        ? existing.map((a: any) => (a.id === announcement.id ? announcement : a))
        : [announcement, ...existing];
      return { ...prev, [classroomId]: next };
    });
    try {
      await db.upsertAnnouncement(announcement);
      // Email the class, but only for a NEW post — editing or pinning must not re-notify.
      // Deliberately not awaited: email is a notification channel, and a mail outage must
      // never make posting an announcement appear to fail.
      if (!announcement.updatedAt) {
        const classroom = classrooms.find((c: any) => c.id === classroomId);
        if (classroom) void notifyAnnouncement(classroom, users, announcement);
      }
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        error: `The announcement is shown on this device but could not be saved to the server${e?.message ? ` (${e.message})` : ''}.`,
      };
    }
  };

  const deleteAnnouncement = async (classroomId: string, announcementId: string): Promise<MutationResult> => {
    const previous = announcements[classroomId] || [];
    const target = previous.find((a: any) => a.id === announcementId);
    setAnnouncements((prev) => ({
      ...prev,
      [classroomId]: (prev[classroomId] || []).filter((a: any) => a.id !== announcementId),
    }));
    try {
      await db.deleteAnnouncementDb(announcementId);
      await Promise.all(
        (target?.attachments || []).map((att: any) => removeClassroomFile(att?.storagePath))
      );
      return { ok: true };
    } catch (e: any) {
      setAnnouncements((prev) => ({ ...prev, [classroomId]: previous }));
      return { ok: false, error: `Could not delete the announcement${e?.message ? ` (${e.message})` : ''}.` };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        login,
        loginWithGoogle,
        updateProfile,
        changePassword,
        logout,
        switchAccount,
        isAuthenticated: !!currentUser,

        classrooms,
        exams,
        savedExams,
        examAttempts,
        reviewers,
        questionBank,
        classroomMaterials,
        announcements,
        topics,
        classwork,
        submissions,
        comments,

        addClassroom,
        joinClassroom,
        saveExamToRepository,
        assignExamToClassroom,
        submitExamAttempt,
        saveReviewer,
        saveQuestionBankItem,
        deleteQuestionBankItem,
        deleteReviewer,
        updateReviewer,
        updateExamInRepository,
        deleteExamFromRepository,
        addClassroomMaterial,
        deleteClassroomMaterial,
        saveAnnouncement,
        deleteAnnouncement,
        saveTopic,
        deleteTopic,
        saveClasswork,
        deleteClasswork,
        saveSubmission,
        saveComment,
        deleteComment,
        archiveClassroom,
        unarchiveClassroom,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { mockUsers, mockClassrooms, mockExams, mockQuestionBank, mockExamAttempts };
