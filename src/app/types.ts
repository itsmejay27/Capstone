export type UserRole = 'instructor' | 'student';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  section: string;
  instructorId: string;
  classCode: string;
  students: string[];
  createdAt: Date;
  description?: string;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'essay' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer?: string | number;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
  cognitiveLevel?: string;
  itemPlacement?: number | string;
  createdBy: string;
  createdAt: Date;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  classroomId: string;
  questions: Question[];
  totalPoints: number;
  duration: number;
  createdBy: string;
  createdAt: Date;
  dueDate?: Date;
  isPublished: boolean;
  allowedAttempts: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, any>;
  score?: number;
  submittedAt?: Date;
  startedAt: Date;
}

export interface QuestionBankItem extends Question {
  tags?: string[];
  subject?: string;
}
