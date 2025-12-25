'use client';

import React, { useState, useRef } from 'react';
import { Id } from '@/lib/convex';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import FileInput from '@/components/form/input/FileInput';
import Label from '@/components/form/Label';

// Extend FileInput to support ref and accept props
const FileInputWithRef = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof FileInput> & { accept?: string; disabled?: boolean }>(
  ({ accept, disabled, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="file"
        accept={accept}
        disabled={disabled}
        className={`focus:border-ring-brand-300 shadow-theme-xs focus:file:ring-brand-300 h-11 w-full overflow-hidden rounded-lg border border-gray-300 bg-transparent text-sm text-gray-500 transition-colors file:mr-5 file:border-collapse file:cursor-pointer file:rounded-l-lg file:border-0 file:border-r file:border-solid file:border-gray-200 file:bg-gray-50 file:py-3 file:pr-3 file:pl-3.5 file:text-sm file:text-gray-700 placeholder:text-gray-400 hover:file:bg-gray-100 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:text-white/90 dark:file:border-gray-800 dark:file:bg-white/[0.03] dark:file:text-gray-400 dark:placeholder:text-gray-400 ${props.className || ''}`}
        onChange={props.onChange}
      />
    );
  }
);
FileInputWithRef.displayName = 'FileInputWithRef';

type Assessment = {
  _id: Id<"assessments">;
  title: string;
  totalPoints: number;
  weight: number;
};

type EnrollmentGrade = {
  enrollmentId: Id<"enrollments">;
  studentId: Id<"students">;
  studentNumber: string;
  studentName: string;
  grades: Array<{
    assessmentId: Id<"assessments">;
    score: number;
    gradeId: Id<"grades">;
  }>;
};

interface BulkGradeUploadProps {
  sectionId: Id<"sections">;
  gradebookData: {
    enrollments: EnrollmentGrade[];
    assessments: Assessment[];
  };
  onUploadComplete: () => void;
  onSaveGrades: (grades: Array<{
    enrollmentId: Id<"enrollments">;
    assessmentId: Id<"assessments">;
    score: number;
  }>) => Promise<void>;
}

type ValidationError = {
  row: number;
  studentNumber?: string;
  assessmentName?: string;
  message: string;
};

type ParsedRow = {
  studentNumber: string;
  assessmentScores: Map<string, number>; // assessment title -> score
};

export default function BulkGradeUpload({
  gradebookData,
  onUploadComplete,
  onSaveGrades,
}: BulkGradeUploadProps) {
  const [, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ variant: 'error' | 'success' | 'warning' | 'info'; title: string; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create student number to enrollment map
  const studentNumberMap = new Map(
    gradebookData.enrollments.map((e) => [e.studentNumber, e])
  );

  // Create assessment title to assessment map
  const assessmentTitleMap = new Map(
    gradebookData.assessments.map((a) => [a.title, a])
  );

  // Download template CSV
  const downloadTemplate = () => {
    // Create CSV header
    const headers = ['Student Number', ...gradebookData.assessments.map((a) => a.title)];
    
    // Create rows with student numbers and empty score cells
    const rows = gradebookData.enrollments.map((enrollment) => {
      const studentNumber = enrollment.studentNumber;
      // Add empty cells for each assessment (scores will be filled by user)
      const emptyScores = gradebookData.assessments.map(() => '').join(',');
      return `${studentNumber},${emptyScores}`;
    });

    // Combine header and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'gradebook_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV file
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // End of line
        if (currentField || currentLine.length > 0) {
          currentLine.push(currentField.trim());
          currentField = '';
        }
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = [];
        }
        // Skip \r\n combination
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }

    // Add last field and line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  };

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.csv')) {
      setAlertMessage({
        variant: 'error',
        title: 'Invalid File Type',
        message: 'Please upload a CSV file (.csv)',
      });
      setTimeout(() => setAlertMessage(null), 5000);
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);
    setValidationErrors([]);
    setParsedData([]);
    setIsValid(false);

    try {
      const text = await selectedFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      // First row should be headers
      const headers = rows[0];
      if (headers[0]?.toLowerCase() !== 'student number') {
        throw new Error('First column must be "Student Number"');
      }

      // Extract assessment names from headers (skip first column)
      const assessmentNames = headers.slice(1);
      const errors: ValidationError[] = [];
      const parsed: ParsedRow[] = [];

      // Process data rows (skip header row)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 1; // 1-indexed for display

        if (row.length === 0 || row.every((cell) => !cell)) {
          continue; // Skip empty rows
        }

        const studentNumber = row[0]?.trim();
        if (!studentNumber) {
          errors.push({
            row: rowNumber,
            message: 'Student Number is required',
          });
          continue;
        }

        // Check if student exists
        const enrollment = studentNumberMap.get(studentNumber);
        if (!enrollment) {
          errors.push({
            row: rowNumber,
            studentNumber,
            message: `Student with number "${studentNumber}" not found in this section`,
          });
          continue;
        }

        // Parse assessment scores
        const assessmentScores = new Map<string, number>();
        let hasErrors = false;

        for (let j = 0; j < assessmentNames.length; j++) {
          const assessmentName = assessmentNames[j]?.trim();
          if (!assessmentName) continue;

          // Check if assessment exists
          const assessment = assessmentTitleMap.get(assessmentName);
          if (!assessment) {
            errors.push({
              row: rowNumber,
              studentNumber,
              assessmentName,
              message: `Assessment "${assessmentName}" not found in this section`,
            });
            hasErrors = true;
            continue;
          }

          // Parse score
          const scoreStr = row[j + 1]?.trim(); // +1 because first column is student number
          if (!scoreStr) continue; // Empty score is allowed (will be skipped)

          const score = parseFloat(scoreStr);
          if (isNaN(score)) {
            errors.push({
              row: rowNumber,
              studentNumber,
              assessmentName,
              message: `Invalid score "${scoreStr}" for assessment "${assessmentName}". Must be a number.`,
            });
            hasErrors = true;
            continue;
          }

          if (score < 0) {
            errors.push({
              row: rowNumber,
              studentNumber,
              assessmentName,
              message: `Score cannot be negative for "${assessmentName}"`,
            });
            hasErrors = true;
            continue;
          }

          if (score > assessment.totalPoints) {
            errors.push({
              row: rowNumber,
              studentNumber,
              assessmentName,
              message: `Score ${score} exceeds maximum ${assessment.totalPoints} for "${assessmentName}"`,
            });
            hasErrors = true;
            continue;
          }

          assessmentScores.set(assessmentName, score);
        }

        if (!hasErrors) {
          parsed.push({
            studentNumber,
            assessmentScores,
          });
        }
      }

      setParsedData(parsed);
      setValidationErrors(errors);
      setIsValid(errors.length === 0 && parsed.length > 0);

      if (errors.length > 0) {
        setAlertMessage({
          variant: 'warning',
          title: 'Validation Warnings',
          message: `Found ${errors.length} error(s) in the uploaded file. Please review and fix them before saving.`,
        });
      } else if (parsed.length > 0) {
        setAlertMessage({
          variant: 'success',
          title: 'File Processed Successfully',
          message: `Successfully parsed ${parsed.length} student record(s). Ready to save.`,
        });
      } else {
        setAlertMessage({
          variant: 'warning',
          title: 'No Valid Data',
          message: 'No valid student records found in the uploaded file.',
        });
      }

      setTimeout(() => setAlertMessage(null), 8000);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setAlertMessage({
        variant: 'error',
        title: 'Error Processing File',
        message: error instanceof Error ? error.message : 'Failed to process CSV file. Please check the file format.',
      });
      setTimeout(() => setAlertMessage(null), 8000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid || parsedData.length === 0) return;

    try {
      const gradesToSave: Array<{
        enrollmentId: Id<"enrollments">;
        assessmentId: Id<"assessments">;
        score: number;
      }> = [];

      parsedData.forEach((row) => {
        const enrollment = studentNumberMap.get(row.studentNumber);
        if (!enrollment) return;

        row.assessmentScores.forEach((score, assessmentTitle) => {
          const assessment = assessmentTitleMap.get(assessmentTitle);
          if (!assessment) return;

          gradesToSave.push({
            enrollmentId: enrollment.enrollmentId,
            assessmentId: assessment._id,
            score,
          });
        });
      });

      if (gradesToSave.length > 0) {
        await onSaveGrades(gradesToSave);
        setAlertMessage({
          variant: 'success',
          title: 'Success',
          message: `Successfully saved ${gradesToSave.length} grade(s) for ${parsedData.length} student(s).`,
        });
        setTimeout(() => {
          setAlertMessage(null);
          setFile(null);
          setParsedData([]);
          setValidationErrors([]);
          setIsValid(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          onUploadComplete();
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving grades:', error);
      setAlertMessage({
        variant: 'error',
        title: 'Error Saving Grades',
        message: error instanceof Error ? error.message : 'Failed to save grades. Please try again.',
      });
      setTimeout(() => setAlertMessage(null), 8000);
    }
  };

  return (
    <div className="space-y-4">
      {alertMessage && (
        <Alert
          variant={alertMessage.variant}
          title={alertMessage.title}
          message={alertMessage.message}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Bulk Grade Upload
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Upload a CSV file with student numbers and assessment scores
            </p>
          </div>
          <Button size="sm" onClick={downloadTemplate} variant="outline">
            Download Template
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Upload CSV File</Label>
          <FileInputWithRef
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            CSV format: Student Number, Assessment Name 1, Assessment Name 2, ...
          </p>
        </div>

        {isProcessing && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Processing file...
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
              Validation Errors ({validationErrors.length})
            </h4>
            <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="space-y-2">
                {validationErrors.map((error, index) => (
                  <div
                    key={index}
                    className="text-sm text-error-600 dark:text-error-400 bg-error-50 dark:bg-error-900/20 p-2 rounded"
                  >
                    <span className="font-medium">Row {error.row}:</span>{' '}
                    {error.studentNumber && (
                      <span className="font-medium">Student {error.studentNumber} - </span>
                    )}
                    {error.assessmentName && (
                      <span className="font-medium">{error.assessmentName} - </span>
                    )}
                    {error.message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {parsedData.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                Ready to Save ({parsedData.length} student record(s))
              </h4>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isValid || isProcessing}
              >
                Save Grades
              </Button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {parsedData.reduce((total, row) => total + row.assessmentScores.size, 0)} grade(s) will be saved
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

