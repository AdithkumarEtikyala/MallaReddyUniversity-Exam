'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Question } from '@/types';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Props = {
  onQuestionsGenerated: (questions: Omit<Question, 'id'>[]) => void;
};

// This type represents the raw row from the uploaded file
type QuestionRow = {
    Question: string;
    OptionA: string;
    OptionB: string;
    OptionC: string;
    OptionD: string;
    Correct: 'A' | 'B' | 'C' | 'D';
};

export function QuestionFileUploadDialog({ onQuestionsGenerated }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const processAndValidateRows = (rows: QuestionRow[]): Omit<Question, 'id'>[] => {
    const requiredColumns = ['Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'Correct'];
    const validQuestions: Omit<Question, 'id'>[] = [];

    for (const row of rows) {
        // Check if all required columns exist and are not empty for the current row
        const hasAllColumns = requiredColumns.every(col => row[col as keyof QuestionRow] !== undefined && row[col as keyof QuestionRow] !== '');
        if (!hasAllColumns) {
            console.warn("Skipping row due to missing data:", row);
            continue; // Skip this row
        }
        
        const correctOptionMap = { A: 0, B: 1, C: 2, D: 3 };
        const correctOptionIndex = correctOptionMap[row.Correct.toUpperCase() as 'A' | 'B' | 'C' | 'D'];

        if (correctOptionIndex === undefined) {
            console.warn("Skipping row due to invalid 'Correct' value:", row);
            continue; // Skip if the 'Correct' column is not A, B, C, or D
        }

        validQuestions.push({
            text: row.Question,
            options: [row.OptionA, row.OptionB, row.OptionC, row.OptionD],
            correctOption: correctOptionIndex,
        });
    }

    return validQuestions;
  }

  const handleProcessFile = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: 'No file selected', description: 'Please select a file to process.' });
      return;
    }
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result;
        if (!fileContent) {
            throw new Error("File content is empty.");
        }

        let rows: QuestionRow[] = [];
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(fileContent as string, { header: true, skipEmptyLines: true });
          rows = result.data as QuestionRow[];
        } else { // .xlsx, .xls
          const workbook = XLSX.read(fileContent, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json<QuestionRow>(worksheet);
        }

        if (rows.length === 0) {
            toast({ variant: 'destructive', title: 'Empty or Invalid File', description: 'The file contains no data or is not formatted correctly.' });
            return;
        }
        
        const questions = processAndValidateRows(rows);

        if (questions.length > 0) {
            onQuestionsGenerated(questions);
            toast({ title: 'File Processed', description: `${questions.length} questions have been successfully imported.` });
            setFile(null);
            setOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'No Valid Questions Found', description: 'Please check your file for missing data or incorrect formatting.' });
        }

      } catch (error) {
        console.error("File parsing error:", error);
        toast({ variant: 'destructive', title: 'Error Parsing File', description: 'Could not parse the file. Please ensure it is a valid CSV or Excel file.' });
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
        console.error("FileReader error");
        toast({ variant: 'destructive', title: 'Error Reading File', description: 'Could not read the selected file.' });
        setIsProcessing(false);
    }
    
    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setFile(null); // Reset file when dialog is closed
      }
    }}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <Upload className="mr-2 h-4 w-4" /> Upload File
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Question File</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Required columns: Question, OptionA, OptionB, OptionC, OptionD, Correct (A, B, C, or D).
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {!file ? (
            <div {...getRootProps()} className={cn(
              "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer hover:border-primary transition-colors",
              isDragActive ? "border-primary bg-primary/10" : "border-input"
            )}>
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              {isDragActive ? (
                <p>Drop the file here ...</p>
              ) : (
                <p>Drag 'n' drop a file here, or click to select</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Supported: CSV, XLSX, XLS</p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={isProcessing}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleProcessFile} disabled={isProcessing || !file}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isProcessing ? 'Processing...' : 'Process File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
