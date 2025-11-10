import { ExamPageClient } from '@/components/student/ExamPageClient';

// This is a Server Component. It no longer fetches data.
// It simply renders the client component responsible for fetching and displaying the correct exam interface.

export default function ExamPage({ params }: { params: { id: string } }) {
  // We pass the ID to the client component, which will handle its own data fetching.
  return <ExamPageClient examId={params.id} />;
}
