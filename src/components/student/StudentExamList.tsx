'use client';

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { Exam } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, HelpCircle, FileText, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// In a real app, you would have a `studentExams` collection linking students to exams.
// For this demo, we will fetch all exams and pretend they are assigned to the current student.
// This is NOT secure for a production app.

export function StudentExamList() {
  const { user } = useUser();
  const firestore = useFirestore();

  const examsQuery = useMemoFirebase(() => {
    if (!user) return null;
    // NOTE: In a real app, you'd likely query a 'studentExams' collection that references exams.
    // For this demo, we just show all available exams.
    return query(collection(firestore, 'exams'), orderBy('createdAt', 'desc'));
  }, [firestore, user]);
  
  const { data: exams, isLoading } = useCollection<Exam>(examsQuery);

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
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-28" />
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
            <h3 className="mt-2 text-sm font-medium text-gray-900">No exams assigned</h3>
            <p className="mt-1 text-sm text-gray-500">Check back later for new exams.</p>
        </div>
    )
  }

  const now = new Date();
  
  const upcomingExams = exams.filter(exam => {
    const startTime = exam.startTime?.toDate();
    return startTime && startTime > now;
  });

  const activeExams = exams.filter(exam => {
    const startTime = exam.startTime?.toDate();
    const endTime = exam.endTime?.toDate();
    if (!startTime && !endTime) return true; // Always active if no dates
    if (startTime && !endTime) return startTime <= now; // Active after start time
    if (!startTime && endTime) return endTime >= now; // Active before end time
    if (startTime && endTime) return startTime <= now && endTime >= now;
    return false;
  });
  
  const expiredExams = exams.filter(exam => {
    const endTime = exam.endTime?.toDate();
    return endTime && endTime < now;
  });


  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-2xl font-bold mb-4">Active Exams</h2>
            {activeExams.length > 0 ? (
                <div className="space-y-4">
                    {activeExams.map(exam => (
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
                            </div>
                            {exam.endTime && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                    <Calendar className="h-4 w-4" />
                                    <span className='font-medium'>Ends:</span>
                                    <span>{format(exam.endTime.toDate(), "PPP p")}</span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button asChild>
                            <Link href={`/student/exam/${exam.id}`}>Start Exam</Link>
                            </Button>
                        </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground">No exams are currently active.</p>
            )}
        </div>
        <div>
            <h2 className="text-2xl font-bold mb-4">Upcoming Exams</h2>
            {upcomingExams.length > 0 ? (
                <div className="space-y-4">
                    {upcomingExams.map(exam => (
                        <Card key={exam.id} className="opacity-70">
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
                                </div>
                                {exam.startTime && (
                                    <div className="flex items-center gap-1 text-sm text-green-700">
                                        <Calendar className="h-4 w-4" />
                                        <span className='font-medium'>Starts:</span>
                                        <span>{format(exam.startTime.toDate(), "PPP p")}</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button disabled>Not Yet Started</Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                 <p className="text-muted-foreground">No upcoming exams scheduled.</p>
            )}
        </div>
         <div>
            <h2 className="text-2xl font-bold mb-4">Expired Exams</h2>
            {expiredExams.length > 0 ? (
                <div className="space-y-4">
                    {expiredExams.map(exam => (
                        <Card key={exam.id} className="opacity-50 bg-muted/50">
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
                                </div>
                                {exam.endTime && (
                                    <div className="flex items-center gap-1 text-sm text-red-600">
                                        <Calendar className="h-4 w-4" />
                                        <span className='font-medium'>Ended:</span>
                                        <span>{format(exam.endTime.toDate(), "PPP p")}</span>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button disabled>Exam Ended</Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                 <p className="text-muted-foreground">No exams have expired.</p>
            )}
        </div>
    </div>
  );
}
