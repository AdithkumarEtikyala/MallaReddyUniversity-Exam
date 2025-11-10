import { StudentExamList } from '@/components/student/StudentExamList';
import { ContactSupportCard } from '@/components/shared/ContactSupportCard';

export default function StudentDashboard() {
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Assigned Exams</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <StudentExamList />
        </div>
        <div className="lg:col-span-1">
            <ContactSupportCard />
        </div>
      </div>
    </div>
  );
}
