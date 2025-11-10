'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { StudentExam, UserProfile, Exam } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Eye, BookOpenCheck, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { GradeSubmissionDialog } from './GradeSubmissionDialog';


type EditableResult = StudentExam & {
  studentName?: string;
  studentEmail?: string;
};

export function ExamResultsForExam({ exam, examId }: { exam: Exam, examId: string }) {
  const firestore = useFirestore();
  const [results, setResults] = useState<EditableResult[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<StudentExam | null>(null);

  const studentExamsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'studentExams'), where('examId', '==', examId));
  }, [firestore, examId]);

  const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);

  const { data: studentExams, isLoading: isLoadingExams } = useCollection<StudentExam>(studentExamsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  useEffect(() => {
    if (studentExams && users) {
      const userMap = new Map(users.map(u => [u.id, u]));
      const combinedResults = studentExams.map(exam => ({
        ...exam,
        studentName: userMap.get(exam.studentId)?.name || 'Unknown Student',
        studentEmail: userMap.get(exam.studentId)?.email || 'N/A',
      }));
      setResults(combinedResults);
    }
  }, [studentExams, users]);

  const downloadCSV = () => {
    const headers = ['Student Name', 'Email', 'Student ID', 'Score (%)', 'Status', 'Completed At'];
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        `"${r.studentName}"`,
        r.studentEmail,
        r.studentId,
        r.score?.toFixed(2) ?? 'N/A',
        r.status,
        r.timeFinished ? `"${format(r.timeFinished.toDate(), 'yyyy-MM-dd HH:mm:ss')}"` : 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${exam.title.replace(/\s+/g, '_')}_results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleGradeSubmission = (submission: StudentExam) => {
    setSelectedSubmission(submission);
  };

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

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Student Results</CardTitle>
          <CardDescription>View and manage student submissions for this exam.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
            <BookOpenCheck className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No submissions yet</h3>
            <p className="mt-1 text-sm text-gray-500">Results will appear here as students complete the exam.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Student Results</CardTitle>
          <CardDescription>View and manage student submissions for this exam.</CardDescription>
        </div>
        <Button onClick={downloadCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead><Mail className="inline-block mr-2" />Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Completed At</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="w-[180px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.id}>
                <TableCell className="font-medium">{result.studentName}</TableCell>
                <TableCell>{result.studentEmail}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    result.status === 'graded' ? 'bg-green-100 text-green-800' :
                    result.status === 'completed' ? 'bg-yellow-100 text-yellow-800' :
                    result.status === 'suspicious' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status}
                  </span>
                </TableCell>
                <TableCell>{result.timeFinished ? format(result.timeFinished.toDate(), 'PPp') : 'In Progress'}</TableCell>
                <TableCell className="text-right font-bold">
                    {result.score !== undefined ? `${result.score.toFixed(0)}%` : 'N/A'}
                </TableCell>
                <TableCell className="text-center">
                    {(exam.examType === 'long-answer' || exam.examType === 'coding' || exam.examType === 'mcq' || result.status === 'suspicious') && (
                        <Button size="sm" variant="outline" onClick={() => handleGradeSubmission(result)}>
                            <Eye className="mr-2 h-4 w-4" /> 
                            {result.status === 'graded' ? 'View & Edit' : 'View & Grade'}
                        </Button>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    {selectedSubmission && (
        <GradeSubmissionDialog
            submission={selectedSubmission}
            examType={exam.examType}
            isOpen={!!selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
        />
    )}
    </>
  );
}
