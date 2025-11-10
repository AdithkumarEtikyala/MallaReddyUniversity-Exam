'use client';

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { StudentExam, UserProfile } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpenCheck, User, Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';

export function ExamResults() {
  const firestore = useFirestore();

  const studentExamsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'studentExams'), orderBy('timeFinished', 'desc'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    return collection(firestore, 'users');
  }, [firestore]);

  const { data: studentExams, isLoading: isLoadingExams } = useCollection<StudentExam>(studentExamsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const isLoading = isLoadingExams || isLoadingUsers;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!studentExams || studentExams.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Results</CardTitle>
                <CardDescription>View real-time results from student exam submissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
                    <BookOpenCheck className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No student submissions yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Results will appear here as students complete their exams.</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Student Results</CardTitle>
            <CardDescription>View real-time results from student exam submissions.</CardDescription>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><User className="inline-block mr-2" />Student</TableHead>
              <TableHead><Mail className="inline-block mr-2" />Email</TableHead>
              <TableHead><BookOpenCheck className="inline-block mr-2" />Exam</TableHead>
              <TableHead><Clock className="inline-block mr-2" />Completed</TableHead>
              <TableHead className="text-right"><Award className="inline-block mr-2" />Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentExams.map(exam => {
              const student = userMap.get(exam.studentId);
              return (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{student?.name || 'Unknown Student'}</TableCell>
                  <TableCell>{student?.email || 'N/A'}</TableCell>
                  <TableCell>{exam.examTitle || 'Untitled Exam'}</TableCell>
                  <TableCell>{exam.timeFinished ? format(exam.timeFinished.toDate(), 'PPp') : 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold">{exam.score?.toFixed(0) ?? 'N/A'}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
