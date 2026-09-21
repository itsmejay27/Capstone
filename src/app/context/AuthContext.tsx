import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, MutationResult } from '../types';
import { mockUsers, mockClassrooms, mockExams, mockQuestionBank, mockExamAttempts } from '../data/mockData';
import { parseGoogleJwt } from '../utils/authUtils';
import * as db from '../services/supabaseData';
import { removeClassroomFile } from '../services/fileStorage';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (email: string, password: string) => boolean;
  loginWithGoogle: (credential: string, role?: UserRole) => boolean;
  logout: () => void;
  switchAccount: (userId: string) => void;
  isAuthenticated: boolean;

  // Reactive state, hydrated from Supabase when available and mirrored to localStorage as a fallback cache
  classrooms: any[];
  exams: any[];
  savedExams: any[];
  examAttempts: any[];
  reviewers: any[];
  classroomMaterials: Record<string, any[]>; // classroomId -> materials[]
  announcements: Record<string, any[]>; // classroomId -> announcements[]

  // Mutators
  addClassroom: (classroom: any) => void;
  joinClassroom: (classCode: string, studentId: string) => boolean;
  saveExamToRepository: (exam: any) => void;
  assignExamToClassroom: (examId: string, classroomId: string, postDate: string, dueDate: string) => void;
  submitExamAttempt: (attempt: any) => void;
  saveReviewer: (reviewer: any) => void;
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

  // ── Supabase hydration ──
  // Best-effort: if the Supabase project has rows for a given collection, prefer them.
  // Otherwise keep whatever localStorage/mock data was loaded above, so the app never
  // regresses to an empty state (e.g. if RLS blocks anonymous reads for a table).
  useEffect(() => {
    (async () => {
      const [dbUsers, dbClassrooms, dbExams, dbSavedExams, dbAttempts, dbReviewers, dbMaterials, dbAnnouncements] = await Promise.all([
        db.fetchUsers(),
        db.fetchClassrooms(),
        db.fetchExams(),
        db.fetchSavedExams(),
        db.fetchExamAttempts(),
        db.fetchReviewers(),
        db.fetchClassroomMaterials(),
        db.fetchAnnouncements(),
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

  const login = (email: string, password: string): boolean => {
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUserId', user.id);
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

  const assignExamToClassroom = (examId: string, classroomId: string, postDate: string, dueDate: string) => {
    const repoExam = savedExams.find((e) => e.id === examId);
    if (repoExam) {
      const activeExam = {
        ...repoExam,
        id: crypto.randomUUID(),
        sourceExamId: repoExam.id,
        classroomId,
        isPublished: true,
        allowedAttempts: 1,
        postDate: new Date(postDate),
        dueDate: new Date(dueDate),
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
        logout,
        switchAccount,
        isAuthenticated: !!currentUser,

        classrooms,
        exams,
        savedExams,
        examAttempts,
        reviewers,
        classroomMaterials,
        announcements,

        addClassroom,
        joinClassroom,
        saveExamToRepository,
        assignExamToClassroom,
        submitExamAttempt,
        saveReviewer,
        deleteReviewer,
        updateReviewer,
        updateExamInRepository,
        deleteExamFromRepository,
        addClassroomMaterial,
        deleteClassroomMaterial,
        saveAnnouncement,
        deleteAnnouncement,
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
