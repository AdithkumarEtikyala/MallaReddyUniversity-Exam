import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/layout/Header";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['student']}>
      <div className="flex min-h-screen flex-col">
        {/* The header is hidden on the exam page itself by the ExamInterface component */}
        <div className="exam-layout-header">
            <Header />
        </div>
        <main className="flex-1">
            {children}
        </main>
      </div>
    </AuthGuard>
  );
}
