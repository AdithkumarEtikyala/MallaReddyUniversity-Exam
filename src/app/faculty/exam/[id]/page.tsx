import { ExamEditor } from '@/components/faculty/ExamEditor';

// This page is a Server Component.
// It fetches nothing, it just renders the client component responsible for the editor.

export default function EditExamPage({ params }: { params: { id: string } }) {
  // We pass the ID to the editor, which will handle its own data fetching
  return (
    <div className="container py-8">
      <ExamEditor examId={params.id} />
    </div>
  );
}
