'use client';

import { User, Shield, Book, CheckSquare, BarChart3, Building, Users as UsersIcon, HelpCircle, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Exam, StudentExam, UserProfile } from '@/types';
import { UsersTable } from '@/components/super-admin/UsersTable';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useMemo, useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function StatCard({ title, value, icon: Icon, isLoading }: { title: string; value: string | number; icon: React.ElementType; isLoading: boolean; }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted"></div>
        ) : (
            <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ExamsOverview({ exams, submissions, isLoading }: { exams: Exam[] | null, submissions: StudentExam[] | null, isLoading: boolean }) {
    
    const examSubmissionCounts = useMemo(() => {
        if (!submissions) return new Map<string, number>();
        const counts = new Map<string, number>();
        submissions.forEach(sub => {
            counts.set(sub.examId, (counts.get(sub.examId) || 0) + 1);
        });
        return counts;
    }, [submissions]);

    if (isLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!exams || exams.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8">
                <p>No exams found.</p>
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Exam Title</TableHead>
                        <TableHead className="text-center">Questions</TableHead>
                        <TableHead className="text-center">Duration</TableHead>
                        <TableHead className="text-center">Submissions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {exams.map(exam => (
                        <TableRow key={exam.id}>
                            <TableCell className="font-medium">{exam.title}</TableCell>
                            <TableCell className="text-center">{exam.questions?.length || 0}</TableCell>
                            <TableCell className="text-center">{exam.duration} mins</TableCell>
                            <TableCell className="text-center">{examSubmissionCounts.get(exam.id) || 0}</TableCell>
                             <TableCell className="text-right">
                                <Button asChild variant="ghost" size="icon">
                                    <Link href={`/faculty/exam/${exam.id}`}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">View Exam</span>
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function SuperAdminDashboard() {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const examsQuery = useMemoFirebase(() => query(collection(firestore, 'exams'), orderBy('createdAt', 'desc')), [firestore]);
    const submissionsQuery = useMemoFirebase(() => collection(firestore, 'studentExams'), [firestore]);

    const { data: users, isLoading: usersLoading, forceRefetch: refetchUsers } = useCollection<UserProfile>(usersQuery);
    const { data: exams, isLoading: examsLoading } = useCollection<Exam>(examsQuery);
    const { data: submissions, isLoading: submissionsLoading } = useCollection<StudentExam>(submissionsQuery);

    const students = useMemo(() => users?.filter(u => u.role === 'student') || [], [users]);
    const faculties = useMemo(() => users?.filter(u => u.role === 'faculty') || [], [users]);

    const isLoading = usersLoading || examsLoading || submissionsLoading;
    
    // Callback to refetch users after one is deleted
    const handleUserDeleted = useCallback(() => {
        // The useCollection hook does not have a manual refetch. 
        // This is a placeholder for a potential implementation or page reload.
        // For now, the real-time listener of useCollection should handle the update automatically.
    }, []);

    return (
        <div className="container py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Shield className="h-8 w-8 text-primary" />
                    Super Admin Dashboard
                </h1>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard title="Total Students" value={students.length} icon={UsersIcon} isLoading={isLoading} />
                <StatCard title="Total Faculties" value={faculties.length} icon={Building} isLoading={isLoading} />
                <StatCard title="Total Exams" value={exams?.length ?? 0} icon={Book} isLoading={isLoading} />
                <StatCard title="Total Submissions" value={submissions?.length ?? 0} icon={CheckSquare} isLoading={isLoading} />
            </div>

            <Accordion type="multiple" defaultValue={['students', 'faculties']} className="w-full space-y-4">
                <AccordionItem value="students">
                    <AccordionTrigger className="text-xl font-semibold p-4 bg-muted/50 rounded-md">
                        <div className="flex items-center gap-2">
                            <UsersIcon className="h-6 w-6" />
                            Registered Students
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4">
                        <UsersTable users={students} isLoading={usersLoading} onUserDeleted={handleUserDeleted} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faculties">
                    <AccordionTrigger className="text-xl font-semibold p-4 bg-muted/50 rounded-md">
                         <div className="flex items-center gap-2">
                            <Building className="h-6 w-6" />
                            Registered Faculties
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4">
                        <UsersTable users={faculties} isLoading={usersLoading} onUserDeleted={handleUserDeleted} />
                    </AccordionContent>
                </AccordionItem>
                
                 <AccordionItem value="exams">
                    <AccordionTrigger className="text-xl font-semibold p-4 bg-muted/50 rounded-md">
                         <div className="flex items-center gap-2">
                            <Book className="h-6 w-6" />
                            Exams Overview
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4">
                         <ExamsOverview exams={exams} submissions={submissions} isLoading={examsLoading || submissionsLoading} />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
