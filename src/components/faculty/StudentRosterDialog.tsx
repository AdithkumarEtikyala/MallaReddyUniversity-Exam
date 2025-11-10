'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { UserProfile, StudentExam, Exam } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
}

type RosterEntry = {
  student: UserProfile;
  hasAccess: boolean;
  submissionStatus: 'Not Started' | 'Completed' | 'Suspicious' | 'Graded';
  isAccessLocked: boolean; // True if status is graded or suspicious
};

export function StudentRosterDialog({ exam, isOpen, onClose }: Props) {
  const firestore = useFirestore();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const studentsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'users'), where('role', '==', 'student'));
  }, [firestore]);

  const examRosterQuery = useMemoFirebase(() => {
    return collection(firestore, `exams/${exam.id}/roster`);
  }, [firestore, exam.id]);

  const submissionsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'studentExams'), where('examId', '==', exam.id));
  }, [firestore, exam.id]);

  const { data: students, isLoading: isLoadingStudents } = useCollection<UserProfile>(studentsQuery);
  const { data: rosterData, isLoading: isLoadingRoster } = useCollection(examRosterQuery);
  const { data: submissions, isLoading: isLoadingSubmissions } = useCollection<StudentExam>(submissionsQuery);

  useEffect(() => {
    if (students && rosterData && submissions !== undefined) {
      const rosterMap = new Map(rosterData.map(r => [r.id, r.hasAccess]));
      const submissionMap = new Map(submissions.map(s => [s.studentId, s.status]));

      const combinedRoster = students.map(student => {
        const status = submissionMap.get(student.id);
        let submissionStatus: RosterEntry['submissionStatus'] = 'Not Started';
        let isAccessLocked = false;
        
        if (status === 'completed') {
            submissionStatus = 'Completed';
        } else if (status === 'suspicious') {
            submissionStatus = 'Suspicious';
            isAccessLocked = true;
        } else if (status === 'graded') {
            submissionStatus = 'Graded';
            isAccessLocked = true;
        }
        
        const rosterAccess = rosterMap.get(student.id);
        
        // If access is locked by status, default hasAccess to false. Otherwise, use roster data or default to true.
        const hasAccess = isAccessLocked ? false : (rosterAccess === undefined ? true : rosterAccess);
        
        return { student, hasAccess, submissionStatus, isAccessLocked };
      });
      setRoster(combinedRoster);
    }
  }, [students, rosterData, submissions]);


  const handleAccessChange = (studentId: string, newAccess: boolean) => {
    setRoster(currentRoster =>
      currentRoster.map(entry =>
        entry.student.id === studentId ? { ...entry, hasAccess: newAccess } : entry
      )
    );
  };
  
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        const promises = roster.map(entry => {
            const rosterDocRef = doc(firestore, `exams/${exam.id}/roster`, entry.student.id);
            return setDocumentNonBlocking(rosterDocRef, {
                studentId: entry.student.id,
                examId: exam.id,
                hasAccess: entry.hasAccess
            }, { merge: true });
        });
        await Promise.all(promises.map(p => p.catch(e => e)));
    } catch(e) {
        console.error(e)
    } finally {
        setIsSaving(false);
        onClose();
    }
  }

  const filteredRoster = useMemo(() => {
    if (!searchTerm) return roster;
    const lowercasedFilter = searchTerm.toLowerCase();
    return roster.filter(entry =>
      entry.student.name.toLowerCase().includes(lowercasedFilter) ||
      entry.student.email.toLowerCase().includes(lowercasedFilter) ||
      entry.submissionStatus.toLowerCase().includes(lowercasedFilter)
    );
  }, [roster, searchTerm]);


  const isLoading = isLoadingStudents || isLoadingRoster || isLoadingSubmissions;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage Student Roster</DialogTitle>
          <DialogDescription>
            Enable or disable access for students to the exam: "{exam.title}".
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <Input
            placeholder="Search by name, email, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Submission Status</TableHead>
                <TableHead className="text-right">Has Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                filteredRoster.map(entry => {
                  return (
                    <TableRow key={entry.student.id} className={cn(!entry.hasAccess && 'bg-muted/50 text-muted-foreground')}>
                      <TableCell className="font-medium">{entry.student.name}</TableCell>
                      <TableCell>{entry.student.email}</TableCell>
                      <TableCell>
                        <span className={cn('px-2 py-1 text-xs font-semibold rounded-full', {
                          'bg-green-100 text-green-800': entry.submissionStatus === 'Graded',
                          'bg-blue-100 text-blue-800': entry.submissionStatus === 'Completed',
                          'bg-red-100 text-red-800': entry.submissionStatus === 'Suspicious',
                          'bg-gray-100 text-gray-800': entry.submissionStatus === 'Not Started'
                        })}>
                          {entry.submissionStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Switch
                          checked={entry.hasAccess}
                          onCheckedChange={(checked) => handleAccessChange(entry.student.id, checked)}
                          aria-label={`Access for ${entry.student.name}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {!isLoading && filteredRoster.length === 0 && (
             <div className="text-center p-8 text-muted-foreground">
                No students found matching your search.
             </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
