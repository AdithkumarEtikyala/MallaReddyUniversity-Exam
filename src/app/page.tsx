'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, BookMarked } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const [role, setRole] = useState<UserProfile['role'] | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userProfile = userDoc.data() as UserProfile;
            setRole(userProfile.role);
          } else {
            setRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        }
      }
      setRoleLoading(false);
    };

    if (!isUserLoading) {
      fetchUserRole();
    }
  }, [user, isUserLoading, firestore]);

  useEffect(() => {
    const isReadyForRedirect = !isUserLoading && !roleLoading;
    if (isReadyForRedirect && user && role) {
      let dashboardUrl = '/student/dashboard';
      if (role === 'faculty') {
        dashboardUrl = '/faculty/dashboard';
      } else if (role === 'super-admin') {
        dashboardUrl = '/super-admin/dashboard';
      }
      router.push(dashboardUrl);
    }
  }, [user, role, isUserLoading, roleLoading, router]);

  const isLoading = isUserLoading || roleLoading;
  const isAuthenticated = user && role;

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{isAuthenticated ? 'Redirecting...' : 'Loading your experience...'}</p>
      </div>
    );
  }
  
  return (
      <div className="relative flex min-h-screen flex-col bg-gray-950 text-white">
        <header className="container z-40 bg-transparent">
            <div className="flex h-20 items-center justify-between py-6">
                 <Link href="/" className="flex items-center space-x-2">
                    <BookMarked className="h-6 w-6 text-primary" />
                    <span className="font-bold">MRUH-Exampartner</span>
                </Link>
                <nav className='space-x-2'>
                </nav>
            </div>
        </header>
        <main className="flex-1 flex items-center">
            <section className="container flex min-h-full flex-col justify-center text-center">
                <div className="mx-auto max-w-[980px] space-y-6">
                    <h1 className="text-4xl font-extrabold leading-tight tracking-tighter text-white drop-shadow-md md:text-6xl lg:text-7xl font-headline">
                        The Modern Examination Platform for <br /> Malla Reddy University
                    </h1>
                    <p className="max-w-[700px] mx-auto text-lg text-white/80 drop-shadow-sm">
                        Streamline your examination process, from creation to evaluation. Built for both faculty and students with a focus on security, ease-of-use, and powerful features.
                    </p>
                    <div className="flex flex-col items-center gap-4">
                      <Button asChild size="lg" className="bg-primary text-white hover:bg-primary/90 font-bold">
                          <Link href="/login">Log In</Link>
                      </Button>
                      <p className="text-sm text-white/60">designed and developed by students of AIML department</p>
                    </div>
                </div>
            </section>
        </main>
      </div>
    );
}
