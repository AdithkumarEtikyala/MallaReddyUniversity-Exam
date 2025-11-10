
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Trash2, PlusCircle, Save, Loader2, Upload, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, Timestamp } from 'firebase/firestore';
import { useFirestore, useDoc, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { Exam, Question, TestCase } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GenerateQuestionsDialog } from './GenerateQuestionsDialog';
import { Skeleton } from '../ui/skeleton';
import { ExamResultsForExam } from './ExamResultsForExam';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { QuestionFileUploadDialog } from './QuestionFileUploadDialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { Separator } from '../ui/separator';

const testCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expectedOutput: z.string().min(1, 'Expected output is required'),
});

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Question text is required.'),
  options: z.array(z.string().min(1, 'Option text cannot be empty.')).optional(),
  correctOption: z.coerce.number().min(0).max(3).optional(),
  testCases: z.array(testCaseSchema).optional(),
});

const examSchema = z.object({
  title: z.string().min(3, 'Title is required.'),
  description: z.string().optional(),
  duration: z.coerce.number().int().min(1, 'Duration must be at least 1 minute.'),
  examType: z.enum(['mcq', 'coding', 'long-answer']),
  questions: z.array(questionSchema),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  language: z.enum(['python', 'javascript', 'java', 'cpp']).optional(),
});

type ExamFormData = z.infer<typeof examSchema>;

export function ExamEditor({ examId }: { examId: string }) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const firestore = useFirestore();

  const examDocRef = useMemoFirebase(() => doc(firestore, 'exams', examId), [firestore, examId]);
  const { data: initialExam, isLoading: isExamLoading } = useDoc<Exam>(examDocRef);

  const form = useForm<ExamFormData>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      title: '',
      description: '',
      duration: 60,
      examType: 'mcq',
      questions: [],
    },
  });
  
  useEffect(() => {
    if (initialExam) {
      form.reset({
        ...initialExam,
        questions: initialExam.questions || [],
        startTime: initialExam.startTime ? initialExam.startTime.toDate() : undefined,
        endTime: initialExam.endTime ? initialExam.endTime.toDate() : undefined,
      });
    }
  }, [initialExam, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'questions',
  });
  
  const examType = form.watch('examType');

  const addQuestion = () => {
    if (examType === 'mcq') {
      append({
        id: uuidv4(),
        text: '',
        options: ['', '', '', ''],
        correctOption: 0,
      });
    } else if (examType === 'coding') {
        append({
            id: uuidv4(),
            text: '',
            testCases: [{ id: uuidv4(), input: '', expectedOutput: ''}]
        })
    } else { // For long-answer
      append({
        id: uuidv4(),
        text: '',
      });
    }
  };
  
  const addGeneratedQuestions = (newQuestions: Omit<Question, 'id'>[]) => {
    const questionsWithIds = newQuestions.map(q => ({...q, id: uuidv4()}));
    append(questionsWithIds);
    toast({
      title: `${newQuestions.length} questions added`,
      description: "The new questions have been added to the end of the exam.",
    });
  }

  const onSubmit = async (data: ExamFormData) => {
    setIsSaving(true);
    try {
      const examRef = doc(firestore, 'exams', examId);
      
      const updateData: Partial<Exam> = { ...data };

      if (data.startTime) {
        updateData.startTime = Timestamp.fromDate(data.startTime);
      } else {
        updateData.startTime = undefined;
      }
      
      if (data.endTime) {
        updateData.endTime = Timestamp.fromDate(data.endTime);
      } else {
          updateData.endTime = undefined;
      }

      updateDocumentNonBlocking(examRef, updateData);
      toast({
        title: 'Exam Saved',
        description: 'Your changes have been saved successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Saving Exam',
        description: 'Could not save changes. Please try again.',
      });
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const QuestionFields = ({ questionIndex }: { questionIndex: number }) => {
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: `questions.${questionIndex}.testCases`,
    });

    return (
        <div className="space-y-4">
            {fields.map((field, testCaseIndex) => (
                <div key={field.id} className="p-3 border rounded-md bg-muted/50 relative">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name={`questions.${questionIndex}.testCases.${testCaseIndex}.input`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Test Case Input</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Input for this test case" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`questions.${questionIndex}.testCases.${testCaseIndex}.expectedOutput`}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expected Output</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Expected output for this test case" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1"
                        onClick={() => remove(testCaseIndex)}
                    >
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ))}
             <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ id: uuidv4(), input: '', expectedOutput: '' })}
            >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Test Case
            </Button>
        </div>
    );
};


  if (isExamLoading) {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <Card>
                <CardHeader><CardTitle><Skeleton className="h-8 w-48" /></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-40" />
                        <div className='flex items-center gap-2'>
                           <Skeleton className="h-10 w-40" />
                           <Skeleton className="h-10 w-36" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                        <p className="mt-2">Loading exam questions...</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!initialExam) {
      return (
          <div className="text-center py-12">
              <h2 className="text-2xl font-bold">Exam not found</h2>
              <p className="text-muted-foreground">This exam may have been deleted or the link is incorrect.</p>
          </div>
      )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Exam Editor</h1>
            <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
            </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Exam Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Time</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                        format(field.value, "PPP HH:mm")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                />
                                <div className="p-2 border-t border-border">
                                    <Input
                                        type="time"
                                        defaultValue={field.value ? format(field.value, 'HH:mm') : ''}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const newDate = new Date(field.value || new Date());
                                            newDate.setHours(hours, minutes);
                                            field.onChange(newDate);
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Time</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                        format(field.value, "PPP HH:mm")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < (form.getValues('startTime') || new Date(0))}
                                    initialFocus
                                />
                                 <div className="p-2 border-t border-border">
                                    <Input
                                        type="time"
                                        defaultValue={field.value ? format(field.value, 'HH:mm') : ''}
                                        onChange={(e) => {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const newDate = new Date(field.value || new Date());
                                            newDate.setHours(hours, minutes);
                                            field.onChange(newDate);
                                        }}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="examType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Exam Type</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an exam type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="mcq">MCQ</SelectItem>
                      <SelectItem value="coding">Coding</SelectItem>
                      <SelectItem value="long-answer">Answer the Question</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="duration" render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (minutes)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
             {examType === 'coding' && (
                <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select language for the exam" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="javascript">JavaScript</SelectItem>
                                <SelectItem value="python">Python</SelectItem>
                                <SelectItem value="java">Java</SelectItem>
                                <SelectItem value="cpp">C++</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
             )}
          </CardContent>
        </Card>

        <ExamResultsForExam exam={initialExam} examId={examId} />
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Questions</CardTitle>
              <div className='flex items-center gap-2'>
                {examType === 'mcq' && (
                  <>
                    <QuestionFileUploadDialog onQuestionsGenerated={addGeneratedQuestions} />
                    <GenerateQuestionsDialog onQuestionsGenerated={addGeneratedQuestions} />
                  </>
                )}
                <Button type="button" variant="outline" onClick={addQuestion}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Question
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {fields.map((field, index) => (
              <Card key={field.id} className="p-4 bg-background">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Question {index + 1}</h3>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="destructive" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogDescription>
                        This will permanently delete this question. This action cannot be undone.
                      </AlertDialogDescription>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(index)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name={`questions.${index}.text`} render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Text</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {examType === 'mcq' && (
                    <FormField control={form.control} name={`questions.${index}.correctOption`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Options (select the correct answer)</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()} className="space-y-2">
                            {[...Array(4)].map((_, optionIndex) => (
                              <div key={optionIndex} className="flex items-center gap-2">
                                <RadioGroupItem value={optionIndex.toString()} id={`q${index}-o${optionIndex}`} />
                                <FormField control={form.control} name={`questions.${index}.options.${optionIndex}`} render={({ field: optionField }) => (
                                  <FormItem className="flex-1">
                                    <FormControl><Input {...optionField} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )} />
                  )}

                  {examType === 'coding' && (
                    <div>
                        <Separator className="my-4" />
                        <h4 className="font-medium mb-2">Test Cases</h4>
                        <QuestionFields questionIndex={index} />
                    </div>
                  )}
                </div>
              </Card>
            ))}
             {fields.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    <p>No questions yet.</p>
                    <p>Add questions manually {examType === 'mcq' && 'or use the AI generator'}.</p>
                </div>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
