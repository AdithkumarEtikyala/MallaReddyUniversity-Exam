
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type UserRole = 'student' | 'faculty' | 'super-admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface Question {
  id:string;
  text: string;
  // MCQ specific fields
  options?: string[];
  correctOption?: number;
  // Coding specific fields
  testCases?: TestCase[];
}

export type ExamType = 'mcq' | 'coding' | 'long-answer';

export interface Exam {
  id: string;
  title: string;
  description: string;
  facultyId: string;
  duration: number; // in minutes
  examType: ExamType;
  questions: Question[];
  createdAt: Timestamp;
  startTime?: Timestamp;
  endTime?: Timestamp;
  language?: 'python' | 'javascript' | 'java' | 'cpp';
}

export type QuestionStatus = 'answered' | 'not-answered' | 'marked-for-review' | 'not-visited';

export interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  isCorrect: boolean;
  error?: string;
}

export interface StudentAnswer {
  questionId: string;
  questionText: string;
  status: QuestionStatus;
  marks?: number; // Marks assigned by faculty for this specific answer
  
  // Answer for MCQ
  selectedOption?: number | null;
  correctOption?: number | null; // Storing the correct option for grading context
  options?: string[]; // Storing the options for grading context
  
  // Answer for "Answer the Question"
  textAnswer?: string;

  // Answer for "Coding"
  sourceCode?: string;
  actualOutput?: string;
  isCorrect?: boolean; // For single "run" action
  testResults?: TestResult[];
  totalPassed?: number;
  totalCases?: number;
}

export type StudentExamStatus = 'completed' | 'graded' | 'suspicious' | 'in-progress';

export interface StudentExam {
  id: string;
  studentId: string;
  examId: string;
  examTitle: string;
  status: StudentExamStatus;
  answers: StudentAnswer[];
  score?: number; // Overall score, as a percentage
  timeFinished?: Timestamp;
  lastSaved?: Timestamp;
  language?: 'python' | 'cpp' | 'java' | 'javascript';
  // Fields for fullscreen enforcement
  autoSubmitted?: boolean;
  exitCount?: number;
}

export interface ExamRoster {
    studentId: string;
    examId: string;
    hasAccess: boolean;
}

export const TestCaseSchema = z.object({
  id: z.string().optional(), // id might not be there when running code
  input: z.string(),
  expectedOutput: z.string(),
});

// Schemas for Code Execution Flow
export const ExecuteCodeInputSchema = z.object({
  language: z.string().describe('The programming language of the code.'),
  sourceCode: z.string().describe('The source code to execute.'),
  testCases: z.array(TestCaseSchema).describe('An array of test cases to run against the code.'),
});
export type ExecuteCodeInput = z.infer<typeof ExecuteCodeInputSchema>;

export const ExecuteCodeOutputSchema = z.object({
  results: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    actualOutput: z.string(),
    isCorrect: z.boolean(),
    error: z.string().optional(),
  })).describe('The results for each test case.'),
  totalPassed: z.number().int(),
  totalCases: z.number().int(),
});
export type ExecuteCodeOutput = z.infer<typeof ExecuteCodeOutputSchema>;

    