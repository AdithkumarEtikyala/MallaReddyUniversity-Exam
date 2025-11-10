'use client';

import { useMemo, useState } from 'react';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { Exam, StudentExam } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Clock, HelpCircle, Trash2, Loader2, Users, Calendar, UserCog } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { StudentRosterDialog } from './StudentRosterDialog';

export function ExamList() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [managingRosterExam, setManagingRosterExam] = useState<Exam | null>(null);

  const examsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'exams'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user]);
  
  const studentExamsQuery = useMemoFirebase(() => {
      if(!user) return null;
      return collection(firestore, 'studentExams');
  }, [firestore, user]);

  const { data: exams, isLoading: isLoadingExams } = useCollection<Exam>(examsQuery);
  const { data: studentExams, isLoading: isLoadingStudentExams } = useCollection<StudentExam>(studentExamsQuery);

  const studentCounts = useMemo(() => {
    if (!studentExams) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const submission of studentExams) {
        counts.set(submission.examId, (counts.get(submission.examId) || 0) + 1);
    }
    return counts;
  }, [studentExams]);
  
  const isLoading = isLoadingExams || isLoadingStudentExams;

  const handleDelete = (examId: string) => {
    if (!user) return;
    setDeletingId(examId);
    const examDocRef = doc(firestore, 'exams', examId);
    deleteDocumentNonBlocking(examDocRef);
    toast({
      title: "Exam Deleting",
      description: "The exam is being removed from your list.",
    });
    setDeletingId(null); 
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (!exams || exams.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No exams created</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new exam.</p>
        </div>
    )
  }

  return (
    <>
    <div className="space-y-4">
      {exams.map(exam => (
        <Card key={exam.id}>
          <CardHeader>
            <CardTitle>{exam.title}</CardTitle>
            <CardDescription>{exam.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                    <HelpCircle className="h-4 w-4" />
                    <span>{exam.questions?.length || 0} Questions</span>
                </div>
                <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{exam.duration} minutes</span>
                </div>
                 <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{studentCounts.get(exam.id) || 0} Submissions</span>
                </div>
            </div>
            {(exam.startTime || exam.endTime) && (
                 <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-2">
                    {exam.startTime && (
                        <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-green-600" />
                            <span className='font-medium'>Starts:</span>
                            <span>{format(exam.startTime.toDate(), "PPP p")}</span>
                        </div>
                    )}
                     {exam.endTime && (
                        <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-red-600" />
                             <span className='font-medium'>Ends:</span>
                            <span>{format(exam.endTime.toDate(), "PPP p")}</span>
                        </div>
                    )}
                 </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between flex-wrap gap-2">
            <div className='flex gap-2'>
              <Button asChild>
                  <Link href={`/faculty/exam/${exam.id}`}>View & Edit</Link>
              </Button>
               <Button variant="outline" onClick={() => setManagingRosterExam(exam)}>
                <UserCog className="mr-2 h-4 w-4" />
                Manage Students
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deletingId === exam.id}>
                  {deletingId === exam.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the exam
                    and all associated student results.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(exam.id)}>
                    Yes, delete exam
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        </Card>
      ))}
    </div>
    {managingRosterExam && (
        <StudentRosterDialog
            exam={managingRosterExam}
            isOpen={!!managingRosterExam}
            onClose={() => setManagingRosterExam(null)}
        />
    )}
    </>
  );
}

    