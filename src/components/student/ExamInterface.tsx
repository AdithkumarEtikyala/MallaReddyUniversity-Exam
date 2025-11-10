
'use client';

import { useEffect, useReducer, useState, useMemo, useCallback } from 'react';
import type { Exam, StudentAnswer, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Check, ChevronLeft, ChevronRight, Flag, Loader2, Monitor, MonitorOff, AlertTriangle, User as UserIcon, Mail, ShieldAlert, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestionStatus, Question } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { useFullscreenEnforcement } from '@/hooks/use-fullscreen-enforcement';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

type AnswerPayload = 
  | { type: 'mcq', questionId: string; optionIndex: number }
  | { type: 'long-answer', questionId: string; textAnswer: string };

type QuestionForStudent = Omit<Question, 'correctOption'>;
export type ExamForStudent = Omit<Exam, 'questions'> & {
  questions: QuestionForStudent[];
};


// --- State Management ---
type State = {
  currentQuestionIndex: number;
  answers: Map<string, number | string | null>;
  statuses: Map<string, QuestionStatus>;
  timeLeft: number;
  examStarted: boolean;
  examFinished: boolean;
  totalQuestions: number;
};

type Action =
  | { type: 'INITIALIZE'; payload: State }
  | { type: 'START_EXAM' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'JUMP_TO_QUESTION'; payload: number }
  | { type: 'ANSWER'; payload: AnswerPayload }
  | { type: 'CLEAR_ANSWER'; payload: string }
  | { type: 'TOGGLE_MARK_FOR_REVIEW'; payload: string }
  | { type: 'TICK_TIMER' }
  | { type: 'FINISH_EXAM' };

function examReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INITIALIZE':
      return action.payload;
    case 'START_EXAM': {
        if (!state.statuses.size) return { ...state, examStarted: true };
        const firstQuestionId = Array.from(state.statuses.keys())[0];
        
        const newStatuses = new Map(state.statuses);
        if (newStatuses.get(firstQuestionId) === 'not-visited') {
            newStatuses.set(firstQuestionId, 'not-answered');
        }
        return { ...state, examStarted: true, statuses: newStatuses };
    }
    case 'NEXT_QUESTION': {
      const nextIndex = Math.min(state.currentQuestionIndex + 1, state.totalQuestions - 1);
      const questionId = Array.from(state.statuses.keys())[nextIndex];
      const newStatuses = new Map(state.statuses);
      if (newStatuses.get(questionId) === 'not-visited') {
        newStatuses.set(questionId, 'not-answered');
      }
      return { ...state, currentQuestionIndex: nextIndex, statuses: newStatuses };
    }
    case 'PREV_QUESTION': {
      const prevIndex = Math.max(state.currentQuestionIndex - 1, 0);
      return { ...state, currentQuestionIndex: prevIndex };
    }
    case 'JUMP_TO_QUESTION': {
      const questionId = Array.from(state.statuses.keys())[action.payload];
      const newStatuses = new Map(state.statuses);
      if (newStatuses.get(questionId) === 'not-visited') {
        newStatuses.set(questionId, 'not-answered');
      }
      return { ...state, currentQuestionIndex: action.payload, statuses: newStatuses };
    }
    case 'ANSWER': {
      const newAnswers = new Map(state.answers);
      const { payload } = action;
      if (payload.type === 'mcq') {
        newAnswers.set(payload.questionId, payload.optionIndex);
      } else {
        newAnswers.set(payload.questionId, payload.textAnswer);
      }

      const newStatuses = new Map(state.statuses);
      if (newStatuses.get(payload.questionId) !== 'marked-for-review') {
        newStatuses.set(payload.questionId, 'answered');
      }
      return { ...state, answers: newAnswers, statuses: newStatuses };
    }
    case 'CLEAR_ANSWER': {
      const newAnswers = new Map(state.answers);
      newAnswers.set(action.payload, null);

      const newStatuses = new Map(state.statuses);
      // Only change status if it's not marked for review
      if (newStatuses.get(action.payload) !== 'marked-for-review') {
        newStatuses.set(action.payload, 'not-answered');
      }
      return { ...state, answers: newAnswers, statuses: newStatuses };
    }
    case 'TOGGLE_MARK_FOR_REVIEW': {
      const newStatuses = new Map(state.statuses);
      const currentStatus = state.statuses.get(action.payload);
      if (currentStatus === 'marked-for-review') {
        newStatuses.set(action.payload, state.answers.get(action.payload) != null ? 'answered' : 'not-answered');
      } else {
        newStatuses.set(action.payload, 'marked-for-review');
      }
      return { ...state, statuses: newStatuses };
    }
    case 'TICK_TIMER': {
        if (state.timeLeft <= 1) { 
            return { ...state, timeLeft: 0, examFinished: true };
        }
        return { ...state, timeLeft: state.timeLeft - 1 };
    }
    case 'FINISH_EXAM':
        return { ...state, examFinished: true, timeLeft: 0 };
    default:
      return state;
  }
}

// --- Components ---

const StudentDetailsCard = ({ profile, isLoading }: { profile: UserProfile | null, isLoading: boolean }) => {
  const getInitials = (name: string | undefined) => {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Student Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-lg">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
};


const QuestionPalette = ({ statuses, currentIndex, dispatch }: { statuses: Map<string, QuestionStatus>, currentIndex: number, dispatch: React.Dispatch<Action> }) => {
    const statusArray = Array.from(statuses.entries());
    return (
        <Card>
            <CardHeader><CardTitle>Question Palette</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-5 gap-2">
                {statusArray.map(([questionId, status], index) => (
                    <Button
                        key={questionId}
                        variant={currentIndex === index ? 'default' : 'outline'}
                        className={cn('h-10 w-10 relative', {
                            'bg-green-100 border-green-400 text-green-800 hover:bg-green-200': status === 'answered' && currentIndex !== index,
                            'bg-purple-100 border-purple-400 text-purple-800 hover:bg-purple-200': status === 'marked-for-review' && currentIndex !== index,
                            'bg-gray-100 border-gray-400 text-gray-800 hover:bg-gray-200': status === 'not-answered' && currentIndex !== index,
                            'bg-white border-gray-300 text-gray-600': status === 'not-visited' && currentIndex !== index,
                        })}
                        onClick={() => dispatch({ type: 'JUMP_TO_QUESTION', payload: index })}
                    >
                        {index + 1}
                        {status === 'marked-for-review' && <Flag className="absolute top-0 right-0 h-3 w-3 text-purple-600" fill="currentColor" />}
                        {status === 'answered' && <Check className="absolute bottom-0 right-0 h-3 w-3 text-green-600" />}
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
};

const ExamTimer = ({ timeLeft }: { timeLeft: number }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={cn("text-2xl font-bold font-mono", timeLeft < 300 && 'text-destructive')}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
};

const FullscreenStatus = ({ isFullscreen, isPageVisible, exitCount, maxExits }: { isFullscreen: boolean, isPageVisible: boolean, exitCount: number, maxExits: number}) => {
  const warningsLeft = maxExits - exitCount;
  const isSecure = isFullscreen && isPageVisible;
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
            {isSecure ? <Monitor className="h-5 w-5 text-green-600" /> : <MonitorOff className="h-5 w-5 text-destructive" />}
            <span className={cn("font-semibold", isSecure ? "text-green-700" : "text-destructive")}>
                {isSecure ? "Secure Mode Active" : "Insecure Mode"}
            </span>
        </div>
        <div className="text-right">
            <p className="text-sm font-medium">Warnings: <span className={cn(warningsLeft <= 1 && "text-destructive font-bold")}>{exitCount}/{maxExits}</span></p>
            <p className="text-xs text-muted-foreground">{warningsLeft > 0 ? `${warningsLeft} warnings left` : 'Next exit will submit'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export function ExamInterface({ examId }: { examId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examForStudent, setExamForStudent] = useState<ExamForStudent | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const examDocRef = useMemoFirebase(() => doc(firestore, 'exams', examId), [firestore, examId]);
  const { data: examData, isLoading: isExamLoading, error: examError } = useDoc<Exam>(examDocRef);
  
  const rosterDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, `exams/${examId}/roster`, user.uid);
  }, [firestore, examId, user]);
  const { data: rosterData, isLoading: isRosterLoading } = useDoc(rosterDocRef);

  const studentExamDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'studentExams', `${user.uid}_${examId}`);
  }, [firestore, examId, user]);
  const { data: studentExamData } = useDoc<StudentExam>(studentExamDocRef);

  useEffect(() => {
    if (rosterData === undefined || isRosterLoading) {
      setHasAccess(null); // Loading
    } else if (rosterData === null) {
      setHasAccess(true); // Default to has access if no roster entry exists. Change to false to deny by default.
    } else {
      setHasAccess((rosterData as any).hasAccess);
    }
  }, [rosterData, isRosterLoading]);

  useEffect(() => {
    if (examData) {
      const questions = Array.isArray(examData.questions) ? examData.questions : [];
      const questionsForStudent: QuestionForStudent[] = questions.map(q => {
        const { correctOption, ...rest } = q;
        return rest;
      });

      const preparedExam: ExamForStudent = {
        ...examData,
        questions: questionsForStudent,
      };
      setExamForStudent(preparedExam);
    } else if (!isExamLoading) {
        setExamForStudent(null);
    }
  }, [examData, isExamLoading]);
  
  useEffect(() => {
    const fetchProfile = async () => {
      setIsProfileLoading(true);
      if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          toast({ variant: "destructive", title: "Could not load user details." });
        }
      }
      setIsProfileLoading(false);
    };

    fetchProfile();
  }, [user, firestore, toast]);

  const initialState: State | null = useMemo(() => {
    if (!examForStudent) return null;
    const initialStatuses = new Map(examForStudent.questions.map(q => [q.id, 'not-visited'] as const));
    if(initialStatuses.size > 0) {
        const firstKey = initialStatuses.keys().next().value;
        initialStatuses.set(firstKey, 'not-answered');
    }

    return {
      currentQuestionIndex: 0,
      answers: new Map(),
      statuses: new Map(examForStudent.questions.map(q => [q.id, 'not-visited'])),
      timeLeft: examForStudent.duration * 60,
      examStarted: false,
      examFinished: false,
      totalQuestions: examForStudent.questions.length,
    };
  }, [examForStudent]);

  const [state, dispatch] = useReducer(examReducer, initialState as State);
  
  useEffect(() => {
    if (initialState) {
        dispatch({type: 'INITIALIZE', payload: initialState});
    }
  }, [initialState])

  const handleSubmitExam = useCallback(async (autoSubmitDetails?: { autoSubmitted: boolean, exitCount: number }) => {
    if (!state || !user || !examData || !Array.isArray(examData.questions)) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    toast({ title: "Submitting exam...", description: "Please wait." });

    try {
        let totalScore = 0;
        const studentAnswers: StudentAnswer[] = examData.questions.map(q => {
            const answer = state.answers.get(q.id) ?? null;
            let studentAnswer: Partial<StudentAnswer> = {
                questionId: q.id,
                questionText: q.text,
                status: state.statuses.get(q.id) || 'not-visited',
            };

            if (examData.examType === 'mcq') {
                const isCorrect = typeof answer === 'number' && typeof q.correctOption === 'number' && answer === q.correctOption;
                const marks = isCorrect ? 100 : 0;
                studentAnswer = {
                    ...studentAnswer,
                    selectedOption: typeof answer === 'number' ? answer : null,
                    correctOption: q.correctOption ?? null,
                    options: q.options ?? [],
                    marks: marks,
                };
                totalScore += marks;
            } else { // long-answer
                const isAnswered = typeof answer === 'string' && answer.trim() !== '';
                const marks = isAnswered ? 100 : 0; // Give full marks if answered, 0 otherwise
                studentAnswer = {
                    ...studentAnswer,
                    textAnswer: typeof answer === 'string' ? answer : '',
                    marks: marks,
                };
                totalScore += marks;
            }
            return studentAnswer as StudentAnswer;
        });

        const finalScore = examData.questions.length > 0 ? totalScore / examData.questions.length : 0;

        const studentExamSubmission: any = {
            studentId: user.uid,
            examId: examId,
            examTitle: examData.title,
            answers: studentAnswers,
            score: finalScore,
            timeFinished: serverTimestamp(),
            ...(autoSubmitDetails && {
                autoSubmitted: autoSubmitDetails.autoSubmitted,
                exitCount: autoSubmitDetails.exitCount,
            }),
        }

        if (autoSubmitDetails?.autoSubmitted) {
            studentExamSubmission.status = 'suspicious';
        } else if (examData.examType === 'mcq') {
            studentExamSubmission.status = 'graded';
        } else { // long-answer
            studentExamSubmission.status = 'completed'; // Requires manual review
        }
        
        // Clean up undefined values before submission
        Object.keys(studentExamSubmission).forEach(key => {
            if ((studentExamSubmission as any)[key] === undefined) {
                delete (studentExamSubmission as any)[key];
            }
        });

        const studentExamDocRef = doc(firestore, 'studentExams', `${user.uid}_${examId}`);
        setDocumentNonBlocking(studentExamDocRef, studentExamSubmission, { merge: true });
        
        dispatch({ type: 'FINISH_EXAM' });

        toast({
            title: "Exam Submitted!",
            description: "Your responses have been recorded.",
            variant: 'default',
        });
        router.push(`/student/dashboard`);

    } catch (error) {
        console.error("Submission failed", error)
        toast({
            variant: 'destructive',
            title: 'Submission Failed',
            description: 'There was an error submitting your exam. Please try again.',
        });
        setIsSubmitting(false);
    }
  }, [state, user, examData, examId, isSubmitting, toast, firestore, router]);


  const handleAutoSubmit = useCallback(() => {
    const exitCount = parseInt(localStorage.getItem(`fullscreenExitCount_${examId}`) || '0', 10);
    handleSubmitExam({ autoSubmitted: true, exitCount: exitCount });
  }, [examId, handleSubmitExam]);

  const { isFullscreen, isPageVisible, exitCount, MAX_EXITS, enterFullscreen } = useFullscreenEnforcement(
      examId, 
      handleAutoSubmit,
      state?.examStarted,
      state?.examFinished
  );

  useEffect(() => {
    if (!state || !state.examStarted || state.examFinished) return;
    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);
    return () => clearInterval(timer);
  }, [state?.examStarted, state?.examFinished]);
  
  useEffect(() => {
    const header = document.querySelector('.exam-layout-header');
    
    if (state && state.examStarted && !state.examFinished) {
        header?.classList.add('hidden');
    }

    return () => {
        header?.classList.remove('hidden');
    };
  }, [state?.examStarted, state?.examFinished, toast]);

    useEffect(() => {
        const preventAction = (e: Event) => {
            e.preventDefault();
            toast({
                variant: 'destructive',
                title: 'Action Disabled',
                description: 'This action is not allowed during the exam.',
            });
        };

        if (state?.examStarted && !state.examFinished) {
            document.addEventListener('contextmenu', preventAction);
            document.addEventListener('copy', preventAction);
            document.addEventListener('paste', preventAction);
        }

        return () => {
            document.removeEventListener('contextmenu', preventAction);
            document.removeEventListener('copy', preventAction);
            document.removeEventListener('paste', preventAction);
        };
    }, [state?.examStarted, state?.examFinished, toast]);
  
  useEffect(() => {
    if(state && state.timeLeft <= 0 && !state.examFinished) {
        const currentExitCount = parseInt(localStorage.getItem(`fullscreenExitCount_${examId}`) || '0', 10);
        handleSubmitExam({ autoSubmitted: true, exitCount: currentExitCount });
    }
  }, [state?.timeLeft, state?.examFinished, handleSubmitExam, examId]);


  if (isExamLoading || isRosterLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Exam...</p>
      </div>
    );
  }
  
  if (studentExamData) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Exam Already Completed</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          You have already submitted this exam. You cannot take it again.
        </p>
        <Button onClick={() => router.push('/student/dashboard')} className="mt-6">
          Return to Dashboard
        </Button>
      </div>
    );
  }


  if (hasAccess === false) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          You do not have permission to take this exam. Please contact your faculty administrator if you believe this is an error.
        </p>
        <Button onClick={() => router.push('/student/dashboard')} className="mt-6">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (examError) {
      return (
          <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center">
              <h2 className="text-2xl font-bold text-destructive">Error Loading Exam</h2>
              <p className="mt-2 text-muted-foreground">There was a problem fetching the exam data. It might be due to a network issue or insufficient permissions.</p>
          </div>
      )
  }

  if (!examForStudent || !state) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center">
            <h2 className="text-2xl font-bold">Exam Not Found</h2>
            <p className="mt-2 text-muted-foreground">The exam you are looking for does not exist or has been removed.</p>
        </div>
    );
  }

  const currentQuestion = examForStudent.questions[state.currentQuestionIndex];

  if (!state.examStarted) {
      return (
          <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <CardTitle className="text-3xl">{examForStudent.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>{examForStudent.description}</p>
                    <div className="flex justify-center gap-8 text-lg">
                        <p><strong>Duration:</strong> {examForStudent.duration} minutes</p>
                        <p><strong>Questions:</strong> {examForStudent.questions.length}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">This exam will be conducted in fullscreen mode.</p>
                    <Button size="lg" onClick={() => {
                        enterFullscreen();
                        dispatch({type: 'START_EXAM'});
                    }}>Start Exam</Button>
                </CardContent>
            </Card>
          </div>
      );
  }

  if (state.examFinished) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{isSubmitting ? "Submitting your exam..." : "Exam Finished!"}</p>
        </div>
    );
  }

  if (state.examStarted && (!isFullscreen || !isPageVisible)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">You have left the secure exam environment.</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          To continue the exam, you must return to full-screen. Please be aware that exiting this secure mode multiple times will result in the automatic submission of your exam.
        </p>
        <p className="font-bold text-lg mt-4">
          Warnings used: <span className="text-destructive">{exitCount} / {MAX_EXITS}</span>
        </p>
        <Button onClick={enterFullscreen} size="lg" className="mt-6">
          Return to Exam
        </Button>
      </div>
    );
  }


  return (
    <div className="grid lg:grid-cols-12 gap-8 p-8 h-screen bg-muted/20">
      <div className="lg:col-span-8 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-4">Question {state.currentQuestionIndex + 1} of {examForStudent.questions.length}</h2>
          <Card>
            <CardContent className="p-6 text-lg">
              <p className="mb-6">{currentQuestion.text}</p>
              {examForStudent.examType === 'mcq' && currentQuestion.options && (
                <RadioGroup
                  key={currentQuestion.id} // This is the key change to fix the bug
                  value={(state.answers.get(currentQuestion.id) as number | undefined)?.toString()}
                  onValueChange={(value) => dispatch({ type: 'ANSWER', payload: { type: 'mcq', questionId: currentQuestion.id, optionIndex: parseInt(value) }})}
                >
                  {currentQuestion.options.map((option, index) => (
                    <div key={`${state.currentQuestionIndex}-${index}`} className="flex items-center space-x-2 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                      <RadioGroupItem value={index.toString()} id={`q${state.currentQuestionIndex}-o${index}`} />
                      <label htmlFor={`q${state.currentQuestionIndex}-o${index}`} className="flex-1 cursor-pointer">{option}</label>
                    </div>
                  ))}
                </RadioGroup>
              )}
               {examForStudent.examType === 'long-answer' && (
                <div>
                  <div className='bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-4 rounded-md mb-4 text-sm'>
                    <p className='font-bold'>Write your answer below:</p>
                    <ul className='list-disc list-inside mt-2'>
                        <li>Your response will be manually evaluated by the faculty.</li>
                        <li>Please ensure your answer is complete and accurate before submitting.</li>
                        <li>Click Submit when you are ready. No automatic checking will be performed.</li>
                    </ul>
                  </div>
                  <Textarea
                    value={(state.answers.get(currentQuestion.id) as string) || ''}
                    onChange={(e) => dispatch({ type: 'ANSWER', payload: { type: 'long-answer', questionId: currentQuestion.id, textAnswer: e.target.value }})}
                    className="min-h-[200px] text-base"
                    placeholder="Type your answer here..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-between items-center mt-6">
            <Button variant="outline" onClick={() => dispatch({ type: 'PREV_QUESTION' })} disabled={state.currentQuestionIndex === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <div className='flex gap-2'>
                <Button variant="ghost" onClick={() => dispatch({ type: 'CLEAR_ANSWER', payload: currentQuestion.id })}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Response
                </Button>
                <Button variant="outline" onClick={() => dispatch({ type: 'TOGGLE_MARK_FOR_REVIEW', payload: currentQuestion.id })}>
                    <Flag className="mr-2 h-4 w-4" /> Mark for Review
                </Button>
            </div>
            <Button onClick={() => dispatch({ type: 'NEXT_QUESTION' })} disabled={state.currentQuestionIndex === examForStudent.questions.length - 1}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </div>
      
      <div className="lg:col-span-4 flex flex-col gap-8">
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Time Left</CardTitle>
                <ExamTimer timeLeft={state.timeLeft} />
            </CardHeader>
        </Card>
        
        <StudentDetailsCard profile={userProfile} isLoading={isProfileLoading} />

        <FullscreenStatus 
            isFullscreen={isFullscreen}
            isPageVisible={isPageVisible} 
            exitCount={exitCount} 
            maxExits={MAX_EXITS} 
        />

        <QuestionPalette statuses={state.statuses} currentIndex={state.currentQuestionIndex} dispatch={dispatch} />
        
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg" disabled={isSubmitting}>
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   End Exam
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to end the exam?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have answered {Array.from(state.statuses.values()).filter(s => s === 'answered').length} out of {examForStudent.questions.length} questions. You cannot change your answers after submitting.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Return to Exam</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleSubmitExam({ autoSubmitted: false, exitCount: exitCount })} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
