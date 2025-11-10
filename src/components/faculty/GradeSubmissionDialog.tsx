'use client';

import { useState, useEffect } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { StudentExam, StudentAnswer, ExamType, TestResult } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';

interface Props {
  submission: StudentExam;
  examType: ExamType;
  isOpen: boolean;
  onClose: () => void;
}

export function GradeSubmissionDialog({ submission, examType, isOpen, onClose }: Props) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  useEffect(() => {
    // Deep copy to avoid direct state mutation
    if (submission) {
      setAnswers(JSON.parse(JSON.stringify(submission.answers || [])));
    }
  }, [submission]);

  useEffect(() => {
    const validAnswers = answers?.filter(ans => typeof ans.marks === 'number');
    const totalMarks = validAnswers.reduce((acc, ans) => acc + (ans.marks || 0), 0);
    const percentage = answers.length > 0 ? (totalMarks / answers.length) : 0;
    setOverallScore(percentage);
  }, [answers]);

  const handleMarksChange = (questionId: string, marksValue: string) => {
    const newMarks = parseFloat(marksValue);
    if (marksValue !== '' && (isNaN(newMarks) || newMarks < 0 || newMarks > 100)) {
        toast({variant: 'destructive', title: "Invalid Marks", description: "Marks must be between 0 and 100."})
        return;
    };
    setAnswers(currentAnswers =>
      currentAnswers.map(ans =>
        ans.questionId === questionId ? { ...ans, marks: isNaN(newMarks) ? undefined : newMarks } : ans
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const submissionRef = doc(firestore, 'studentExams', submission.id);
      
      const updatePayload = {
        answers: answers,
        score: overallScore,
        status: 'graded' as const,
      };

      updateDocumentNonBlocking(submissionRef, updatePayload);
      
      toast({
        title: 'Grades Saved',
        description: "The student's submission has been successfully graded.",
      });
      onClose();
    } catch (error) {
      console.error('Error saving grades:', error);
      toast({
        variant: 'destructive',
        title: 'Error Saving Grades',
        description: 'Could not save the grades. Please check permissions and try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const TestCaseResult = ({ result }: { result: TestResult }) => (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>
          <div className="flex items-center justify-between w-full pr-4">
             <div className="flex items-center gap-2">
                {result.isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                <span className="font-semibold">Test Case</span>
             </div>
             <span className={cn("font-bold", result.isCorrect ? "text-green-600" : "text-red-600")}>
                {result.isCorrect ? 'Passed' : 'Failed'}
             </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-2">
          <div>
            <Label>Input</Label>
            <pre className="p-2 bg-muted rounded-md text-sm font-mono">{result.input || '""'}</pre>
          </div>
          <div>
            <Label>Expected Output</Label>
            <pre className="p-2 bg-muted rounded-md text-sm font-mono">{result.expectedOutput}</pre>
          </div>
          <div>
            <Label>Actual Output</Label>
            <pre className={cn("p-2 rounded-md text-sm font-mono", result.isCorrect ? "bg-green-100" : "bg-red-100")}>{result.actualOutput}</pre>
          </div>
          {result.error && (
            <div>
              <Label className="text-destructive">Error</Label>
              <pre className="p-2 bg-red-100 text-destructive rounded-md text-sm font-mono">{result.error}</pre>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Grade Submission</DialogTitle>
          <DialogDescription>Review the student's answers and assign marks for each question (out of 100).</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-6">
          {(answers || []).map((ans, index) => (
            <div key={ans.questionId}>
              <div className="font-semibold mb-2">
                Question {index + 1}: <span className="font-normal">{ans.questionText}</span>
              </div>
              
              {examType === 'mcq' && (
                <div className='space-y-2 mb-4'>
                    <RadioGroup value={ans.selectedOption?.toString()} disabled>
                        {(ans.options || []).map((option, optIndex) => {
                            const isSelected = ans.selectedOption === optIndex;
                            const isCorrect = ans.correctOption === optIndex;
                            return (
                                <div key={optIndex} className={cn(
                                    "flex items-center space-x-2 rounded-md border p-3",
                                    isSelected && isCorrect && "bg-green-100 border-green-300",
                                    isSelected && !isCorrect && "bg-red-100 border-red-300",
                                    !isSelected && isCorrect && "border-green-500 border-2"
                                )}>
                                    <RadioGroupItem value={optIndex.toString()} id={`q${index}-o${optIndex}`} />
                                    <Label htmlFor={`ans-${index}-opt-${optIndex}`} className="flex-1 cursor-default">
                                      {option}
                                    </Label>
                                    {isSelected && isCorrect && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                                    {isSelected && !isCorrect && <XCircle className="h-5 w-5 text-red-600" />}
                                    {!isSelected && isCorrect && <span className='text-sm font-bold text-green-700'>Correct Answer</span>}
                                </div>
                            )
                        })}
                    </RadioGroup>
                </div>
              )}

              {examType === 'long-answer' && (
                <p className="p-4 bg-muted rounded-md text-sm mb-4 border">{ans.textAnswer || <span className="text-muted-foreground">No answer provided.</span>}</p>
              )}

              {examType === 'coding' && (
                 <div className="space-y-4 mb-4">
                    <div className='p-4 bg-gray-800 text-white font-mono rounded-md text-sm overflow-x-auto'>
                      <pre><code>{ans.sourceCode || "// No code submitted."}</code></pre>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Test Case Results ({ans.totalPassed}/{ans.totalCases} Passed)</h4>
                      <div className="space-y-2">
                        {ans.testResults?.map((result, i) => <TestCaseResult key={i} result={result} />)}
                      </div>
                    </div>
                 </div>
              )}

              <div className="flex items-center gap-4">
                 <Label htmlFor={`marks-${ans.questionId}`} className="w-24">Marks (/100)</Label>
                 <Input
                    id={`marks-${ans.questionId}`}
                    type="number"
                    min="0"
                    max="100"
                    value={ans.marks ?? ''}
                    onChange={e => handleMarksChange(ans.questionId, e.target.value)}
                    className="w-24"
                />
              </div>
               {index < answers.length - 1 && <Separator className="mt-6" />}
            </div>
          ))}
        </div>
        <DialogFooter className='border-t pt-4 flex justify-between items-center w-full'>
            <div className='text-lg font-bold'>
                Overall Score: {overallScore.toFixed(0)}%
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Grades
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
