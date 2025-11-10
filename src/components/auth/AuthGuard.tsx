'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { UserRole, UserProfile } from '@/types';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          // User doc not found, maybe sign out
          router.push('/login');
        }
      }
      setProfileLoading(false);
    };

    if (!isUserLoading) {
      fetchProfile();
    }
  }, [user, isUserLoading, firestore, router]);

  useEffect(() => {
    if (!isUserLoading && !profileLoading) {
      if (!user) {
        router.push('/login');
      } else if (userProfile && !allowedRoles.includes(userProfile.role) && userProfile.role !== 'super-admin') {
        // If user's role is not in allowedRoles AND they are not a super-admin, redirect.
        const home = userProfile.role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard';
        router.push(home);
      } else if (userProfile && allowedRoles.includes('faculty') && userProfile.role === 'super-admin') {
        // This is a faculty-only route, but the user is a super-admin, so allow access.
        // Do nothing, access is granted.
      } else if (userProfile && !allowedRoles.includes(userProfile.role) && userProfile.role === 'super-admin' && !allowedRoles.includes('faculty')) {
        // A super-admin trying to access a non-faculty, non-super-admin page (e.g., student dashboard)
        router.push('/super-admin/dashboard');
      }
    }
  }, [user, userProfile, isUserLoading, profileLoading, router, allowedRoles]);

  const isLoading = isUserLoading || profileLoading;
  
  // Determine if user is allowed
  const isExplicitlyAllowed = userProfile && allowedRoles.includes(userProfile.role);
  const isSuperAdminOnFacultyRoute = userProfile && userProfile.role === 'super-admin' && allowedRoles.includes('faculty');
  const isSuperAdminOnSuperAdminRoute = userProfile && userProfile.role === 'super-admin' && allowedRoles.includes('super-admin');

  const isAllowed = isExplicitlyAllowed || isSuperAdminOnFacultyRoute || isSuperAdminOnSuperAdminRoute;


  if (isLoading || !isAllowed) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
