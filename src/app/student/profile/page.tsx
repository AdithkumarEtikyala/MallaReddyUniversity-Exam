'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, QuerySnapshot, DocumentData, Timestamp } from 'firebase/firestore';
import { UserProfile, StudentExam, Exam } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


export default function ProfilePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [exams, setExams] = useState<Map<string, Exam>>(new Map());
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [areExamsLoading, setAreExamsLoading] = useState(true);

  const submissionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'studentExams'), where('studentId', '==', user.uid));
  }, [user, firestore]);

  const { data: submissions, isLoading: areSubmissionsLoading } = useCollection<StudentExam>(submissionsQuery);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        setIsProfileLoading(true);
        const profileDoc = await getDocs(query(collection(firestore, 'users'), where('id', '==', user.uid)));
        if (!profileDoc.empty) {
          setUserProfile(profileDoc.docs[0].data() as UserProfile);
        }
        setIsProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user, firestore]);

  useEffect(() => {
    const fetchExams = async () => {
      if (!submissions || submissions.length === 0) {
        setAreExamsLoading(false);
        return;
      }
      
      setAreExamsLoading(true);
      const examIds = [...new Set(submissions.map(s => s.examId))];
      
      if (examIds.length > 0) {
        try {
          const examsQuery = query(collection(firestore, 'exams'), where('__name__', 'in', examIds));
          const examsSnapshot = await getDocs(examsQuery);
          const examsMap = new Map<string, Exam>();
          examsSnapshot.forEach(doc => {
            examsMap.set(doc.id, doc.data() as Exam);
          });
          setExams(examsMap);
        } catch (error) {
          console.error("Error fetching exams:", error);
        }
      }
      setAreExamsLoading(false);
    };

    fetchExams();
  }, [submissions, firestore]);

  const getInitials = (name: string | undefined) => {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const isLoading = isProfileLoading || areSubmissionsLoading || areExamsLoading;

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return [];
    return [...submissions].sort((a, b) => {
        const timeA = a.timeFinished instanceof Timestamp ? a.timeFinished.toMillis() : 0;
        const timeB = b.timeFinished instanceof Timestamp ? b.timeFinished.toMillis() : 0;
        return timeB - timeA;
    });
  }, [submissions]);

  return (
    <div className="container py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Student Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isProfileLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          ) : userProfile ? (
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback>{getInitials(userProfile.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-2xl font-bold">{userProfile.name}</p>
                <p className="text-muted-foreground">{userProfile.email}</p>
              </div>
            </div>
          ) : (
            <p>Could not load user profile.</p>
          )}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-4">Exam History</h2>
      {isLoading ? (
        <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
        </div>
      ) : sortedSubmissions && sortedSubmissions.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
          {sortedSubmissions.map(submission => (
            <AccordionItem key={submission.id} value={submission.id}>
              <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                    <div className="text-left">
                        <p className="font-semibold">{submission.examTitle}</p>
                        {submission.timeFinished && (
                          <p className="text-sm text-muted-foreground">
                            Submitted on {format(submission.timeFinished.toDate(), 'PPp')}
                          </p>
                        )}
                    </div>
                    {submission.status === 'graded' && typeof submission.score === 'number' ? (
                       <div className="text-right">
                           <p className="font-semibold text-lg">{submission.score.toFixed(0)}%</p>
                           <p className="text-sm text-muted-foreground">Overall Score</p>
                       </div>
                    ) : (
                        <Badge variant={submission.status === 'in-progress' ? 'default' : 'secondary'}>
                          {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                        </Badge>
                    )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {submission.status === 'graded' ? (
                    <ResultsTable submission={submission} exam={exams.get(submission.examId)} />
                ) : (
                    <p className="text-muted-foreground text-center p-4">
                        Results are not yet available for this exam.
                    </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center text-muted-foreground py-12 rounded-lg border-2 border-dashed">
          <FileText className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">No Exams Attempted</h3>
          <p>Your submission history will appear here once you complete an exam.</p>
        </div>
      )}
    </div>
  );
}


function ResultsTable({ submission, exam }: { submission: StudentExam; exam?: Exam }) {
    if (!exam || !exam.questions) return <p>Loading exam details...</p>;
  
    const getAnswerForQuestion = (questionId: string) => {
      return submission.answers?.find(ans => ans.questionId === questionId);
    };

    return (
        <div className="p-4 bg-muted/50 rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Your Answer</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {exam.questions.map((question, index) => {
                    const answer = getAnswerForQuestion(question.id);
                    if (!answer) return null;

                    let displayAnswer = 'Not Answered';
                    let isCorrect = false;

                    if (exam.examType === 'mcq') {
                        displayAnswer = question.options?.[answer.selectedOption as number] || 'Not answered';
                        isCorrect = answer.selectedOption === question.correctOption;
                    } else if (exam.examType === 'long-answer') {
                        displayAnswer = answer.textAnswer || 'Not answered';
                        isCorrect = (answer.marks ?? 0) > 50; // Assume >50% is a "pass" for display
                    } else if (exam.examType === 'coding') {
                        displayAnswer = `${answer.totalPassed ?? 0}/${answer.totalCases ?? 0} cases passed`;
                        isCorrect = answer.totalPassed === answer.totalCases;
                    }

                    return (
                        <TableRow key={question.id}>
                        <TableCell className="font-medium">{index + 1}. {question.text}</TableCell>
                        <TableCell>{displayAnswer}</TableCell>
                        <TableCell>
                            <span className={cn('flex items-center gap-2', isCorrect ? 'text-green-600' : 'text-red-600')}>
                            {isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                            {isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                            {typeof answer.marks === 'number' ? `${answer.marks.toFixed(0)} / 100` : 'N/A'}
                        </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
