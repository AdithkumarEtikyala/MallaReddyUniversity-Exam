
'use client';
import { CreateExam } from '@/components/faculty/CreateExam';
import { ExamList } from '@/components/faculty/ExamList';
import { ContactSupportCard } from '@/components/shared/ContactSupportCard';
import { ExamResults } from '@/components/faculty/ExamResults';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';
import { useState, useEffect } from 'react';

export default function FacultyDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      })
    }
  }, [user, firestore]);

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Exams</h1>
        <CreateExam />
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <ExamList />
            {userProfile?.role === 'super-admin' && <ExamResults />}
        </div>
        <div className="lg:col-span-1">
            <ContactSupportCard />
        </div>
      </div>
    </div>
  );
}
