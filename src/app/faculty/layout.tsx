import { AuthGuard } from "@/components/auth/AuthGuard";
import { Header } from "@/components/layout/Header";

export default function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard allowedRoles={['faculty']}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
            {children}
        </main>
      </div>
    </AuthGuard>
  );
}
