'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Exam } from '@/types';
import { Loader2 } from 'lucide-react';
import { CodingExamInterface } from '@/components/student/CodingExamInterface';
import { ExamInterface } from '@/components/student/ExamInterface';

export function ExamPageClient({ examId }: { examId: string }) {
  const firestore = useFirestore();
  const [examType, setExamType] = useState<Exam['examType'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExamType = async () => {
      if (!firestore) return;
      try {
        const examRef = doc(firestore, 'exams', examId);
        const examSnap = await getDoc(examRef);
        if (examSnap.exists()) {
          setExamType(examSnap.data().examType as Exam['examType']);
        } else {
          setError('Exam not found.');
        }
      } catch (err) {
        console.error('Failed to fetch exam type:', err);
        setError('Failed to load exam details.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExamType();
  }, [firestore, examId]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Exam...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center">
        <h2 className="text-2xl font-bold text-destructive">{error}</h2>
        <p className="mt-2 text-muted-foreground">Please check the exam ID or contact support.</p>
      </div>
    );
  }

  if (examType === 'coding') {
    return <CodingExamInterface examId={examId} />;
  }

  // Default to the standard MCQ/long-answer interface
  return <ExamInterface examId={examId} />;
}
