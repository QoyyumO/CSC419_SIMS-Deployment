'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import Button from '@/components/ui/button/Button';
import GradebookMatrixTable from '@/components/tables/GradebookMatrixTable';
import Alert from '@/components/ui/alert/Alert';
import BulkGradeUpload from './BulkGradeUpload';
import { Modal } from '@/components/ui/modal';

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

type GradebookData = {
  enrollments: EnrollmentGrade[];
  assessments: Assessment[];
  section?: {
    finalGradesPosted: boolean;
    gradesEditable: boolean;
  };
};

interface GradebookMatrixProps {
  sectionId: Id<"sections">;
}

export default function GradebookMatrix({ sectionId }: GradebookMatrixProps) {
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  });

  // Fetch gradebook data
  const gradebookData = useQuery(
    api.grades.getBySection,
    sessionToken && sectionId
      ? { sectionId, token: sessionToken }
      : "skip"
  ) as GradebookData | undefined;

  // Mutation for updating grades
  // @ts-expect-error - Convex API path with slashes
  const updateGradesMutation = useMutation(api["mutations/gradeMutations"].updateGrades);
  
  // Mutation for posting final grades
  const postFinalGradeMutation = useMutation(api.enrollments.postFinalGrade);

  // Local state for editing grades
  const [gradeValues, setGradeValues] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showPostFinalGradesModal, setShowPostFinalGradesModal] = useState(false);
  const [isPostingFinalGrades, setIsPostingFinalGrades] = useState(false);
  
  // Alert state
  const [alertMessage, setAlertMessage] = useState<{ variant: 'error' | 'success' | 'warning' | 'info'; title: string; message: string } | null>(null);

  // Initialize grade values from fetched data
  useEffect(() => {
    if (gradebookData) {
      const newGradeValues = new Map<string, string>();
      gradebookData.enrollments.forEach((enrollment) => {
        gradebookData.assessments.forEach((assessment) => {
          const grade = enrollment.grades.find((g) => g.assessmentId === assessment._id);
          const key = `${enrollment.enrollmentId}-${assessment._id}`;
          // Format score to avoid floating-point precision issues
          // Round to 2 decimal places
          if (grade) {
            // Round to 2 decimal places to fix floating-point precision
            const rounded = Math.round(grade.score * 100) / 100;
            // Convert to string, removing unnecessary trailing zeros
            const formattedScore = parseFloat(rounded.toFixed(2)).toString();
            newGradeValues.set(key, formattedScore);
          } else {
            newGradeValues.set(key, '');
          }
        });
      });
      setGradeValues(newGradeValues);
      setHasChanges(false);
    }
  }, [gradebookData]);

  // Check if grades are editable
  const gradesEditable = gradebookData?.section?.gradesEditable ?? true;
  const finalGradesPosted = gradebookData?.section?.finalGradesPosted ?? false;

  // Handle input change
  const handleScoreChange = (enrollmentId: Id<"enrollments">, assessmentId: Id<"assessments">, value: string) => {
    if (!gradesEditable) return; // Prevent changes if grades are not editable
    
    const key = `${enrollmentId}-${assessmentId}`;
    const newGradeValues = new Map(gradeValues);
    newGradeValues.set(key, value);
    setGradeValues(newGradeValues);
    setHasChanges(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!gradebookData || !sessionToken) return;

    // Client-side validation: Check for scores exceeding maximum
    const validationErrors: string[] = [];
    
    gradebookData.enrollments.forEach((enrollment) => {
      gradebookData.assessments.forEach((assessment) => {
        const key = `${enrollment.enrollmentId}-${assessment._id}`;
        const value = gradeValues.get(key)?.trim();
        
        if (value && value !== '') {
          const score = parseFloat(value);
          if (!isNaN(score)) {
            if (score < 0) {
              validationErrors.push(
                `Score cannot be negative for ${enrollment.studentName} - ${assessment.title}`
              );
            } else if (score > assessment.totalPoints) {
              validationErrors.push(
                `Score (${score}) exceeds maximum score (${assessment.totalPoints}) for ${enrollment.studentName} - ${assessment.title}`
              );
            }
          }
        }
      });
    });

    // If validation errors exist, show them and stop
    if (validationErrors.length > 0) {
      setAlertMessage({
        variant: 'error',
        title: 'Validation Error',
        message: validationErrors.join('\n'),
      });
      // Auto-dismiss after 10 seconds
      setTimeout(() => setAlertMessage(null), 10000);
      return;
    }

    setIsSaving(true);
    try {
      // Build array of grade updates
      const gradesToUpdate: Array<{
        enrollmentId: Id<"enrollments">;
        assessmentId: Id<"assessments">;
        score: number;
      }> = [];

      gradebookData.enrollments.forEach((enrollment) => {
        gradebookData.assessments.forEach((assessment) => {
          const key = `${enrollment.enrollmentId}-${assessment._id}`;
          const value = gradeValues.get(key)?.trim();
          
          if (value && value !== '') {
            const score = parseFloat(value);
            if (!isNaN(score) && score >= 0) {
              gradesToUpdate.push({
                enrollmentId: enrollment.enrollmentId,
                assessmentId: assessment._id,
                score,
              });
            }
          }
        });
      });

      if (gradesToUpdate.length > 0) {
        await updateGradesMutation({
          grades: gradesToUpdate,
          token: sessionToken,
        });
        setHasChanges(false);
        setAlertMessage({
          variant: 'success',
          title: 'Success',
          message: 'Grades saved successfully!',
        });
        // Auto-dismiss after 5 seconds
        setTimeout(() => setAlertMessage(null), 5000);
      }
    } catch (error) {
      console.error('Error saving grades:', error);
      
      // Parse error message for user-friendly display
      let errorTitle = 'Error Saving Grades';
      let errorMessage = 'Failed to save grades. Please try again.';
      
      if (error instanceof Error) {
        const errorStr = error.message;
        
        // Check for score validation errors
        if (errorStr.includes('exceeds maximum score')) {
          // Extract score and max score from error message
          const scoreMatch = errorStr.match(/Score \((\d+(?:\.\d+)?)\) exceeds maximum score \((\d+(?:\.\d+)?)\)/);
          if (scoreMatch) {
            errorTitle = 'Invalid Score';
            errorMessage = `The score ${scoreMatch[1]} exceeds the maximum allowed score of ${scoreMatch[2]}. Please enter a score between 0 and ${scoreMatch[2]}.`;
          } else {
            errorTitle = 'Invalid Score';
            errorMessage = 'One or more scores exceed the maximum allowed points. Please check your entries and ensure all scores are within the valid range.';
          }
        } else if (errorStr.includes('Score cannot be negative')) {
          errorTitle = 'Invalid Score';
          errorMessage = 'Scores cannot be negative. Please enter a score of 0 or higher.';
        } else if (errorStr.includes('Access denied')) {
          errorTitle = 'Access Denied';
          errorMessage = 'You do not have permission to update grades for this section.';
        } else {
          // Generic error message
          errorMessage = errorStr;
        }
      }
      
      setAlertMessage({
        variant: 'error',
        title: errorTitle,
        message: errorMessage,
      });
      // Auto-dismiss after 10 seconds
      setTimeout(() => setAlertMessage(null), 10000);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate class average for an assessment
  const calculateAverage = (assessmentId: Id<"assessments">): number | null => {
    if (!gradebookData) return null;

    const scores: number[] = [];
    gradebookData.enrollments.forEach((enrollment) => {
      const key = `${enrollment.enrollmentId}-${assessmentId}`;
      const value = gradeValues.get(key)?.trim();
      if (value && value !== '') {
        const score = parseFloat(value);
        if (!isNaN(score)) {
          scores.push(score);
        }
      }
    });

    if (scores.length === 0) return null;
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  };

  // Calculate final grade for an enrollment (projected based on current data)
  const calculateFinalGrade = (enrollmentId: Id<"enrollments">): { percentage: number; letter: string; points: number } | null => {
    if (!gradebookData) return null;

    const enrollment = gradebookData.enrollments.find((e) => e.enrollmentId === enrollmentId);
    if (!enrollment) return null;

    // Calculate weighted average: Sum(score / totalPoints * weight)
    let totalWeightedPoints = 0;
    let totalWeight = 0;
    let hasAllGrades = true;

    for (const assessment of gradebookData.assessments) {
      const key = `${enrollmentId}-${assessment._id}`;
      const value = gradeValues.get(key)?.trim();
      
      if (value && value !== '') {
        const score = parseFloat(value);
        if (!isNaN(score) && score >= 0) {
          // Calculate contribution: (score / totalPoints) * weight
          const assessmentPercentage = (score / assessment.totalPoints) * 100;
          const weightedContribution = (assessmentPercentage / 100) * assessment.weight;
          totalWeightedPoints += weightedContribution;
          totalWeight += assessment.weight;
        } else {
          hasAllGrades = false;
        }
      } else {
        // Check if there's an existing grade
        const existingGrade = enrollment.grades.find((g) => g.assessmentId === assessment._id);
        if (existingGrade) {
          const assessmentPercentage = (existingGrade.score / assessment.totalPoints) * 100;
          const weightedContribution = (assessmentPercentage / 100) * assessment.weight;
          totalWeightedPoints += weightedContribution;
          totalWeight += assessment.weight;
        } else {
          hasAllGrades = false;
        }
      }
    }

    // Only calculate if we have grades for all assessments
    if (!hasAllGrades || totalWeight === 0) {
      return null;
    }

    const finalPercentage = Math.round(totalWeightedPoints * 100) / 100;
    
    // Map percentage to letter grade and grade point using the new mapping
    let letter: string;
    let points: number;

    if (finalPercentage >= 70) {
      letter = "A";
      points = 5.0;
    } else if (finalPercentage >= 60) {
      letter = "B";
      points = 4.0;
    } else if (finalPercentage >= 50) {
      letter = "C";
      points = 3.0;
    } else if (finalPercentage >= 45) {
      letter = "D";
      points = 2.0;
    } else if (finalPercentage >= 40) {
      letter = "E";
      points = 1.0;
    } else {
      letter = "F";
      points = 0.0;
    }

    return {
      percentage: finalPercentage,
      letter,
      points,
    };
  };

  // Handle posting final grades
  const handlePostFinalGrades = async () => {
    if (!sessionToken) {
      setAlertMessage({
        variant: 'error',
        title: 'Authentication Required',
        message: 'Please log in again.',
      });
      setTimeout(() => setAlertMessage(null), 5000);
      return;
    }

    setIsPostingFinalGrades(true);
    try {
      await postFinalGradeMutation({
        sectionId,
        token: sessionToken,
      });

      setShowPostFinalGradesModal(false);
      setAlertMessage({
        variant: 'success',
        title: 'Success',
        message: 'Final grades have been posted successfully. All enrollments have been marked as completed.',
      });
      setTimeout(() => setAlertMessage(null), 5000);
      
      // Refresh the gradebook data
      // The useQuery will automatically refetch
    } catch (error) {
      console.error('Error posting final grades:', error);
      
      let errorTitle = 'Error Posting Final Grades';
      let errorMessage = 'Failed to post final grades. Please try again.';
      
      if (error instanceof Error) {
        const errorStr = error.message;
        
        if (errorStr.includes('Missing grades')) {
          errorTitle = 'Missing Grades';
          errorMessage = 'All assessments must have grades recorded before posting final grades.';
        } else if (errorStr.includes('weights sum')) {
          errorTitle = 'Invalid Assessment Weights';
          errorMessage = 'Assessment weights must sum to 100%. Please check your assessment configuration.';
        } else if (errorStr.includes('Access denied')) {
          errorTitle = 'Access Denied';
          errorMessage = 'You do not have permission to post final grades for this section.';
        } else {
          errorMessage = errorStr;
        }
      }
      
      setAlertMessage({
        variant: 'error',
        title: errorTitle,
        message: errorMessage,
      });
      setTimeout(() => setAlertMessage(null), 10000);
    } finally {
      setIsPostingFinalGrades(false);
    }
  };

  if (!gradebookData) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p>Loading gradebook...</p>
      </div>
    );
  }

  if (gradebookData.assessments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">No assessments found</p>
        <p className="text-sm">Create assessments to start entering grades</p>
      </div>
    );
  }

  if (gradebookData.enrollments.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium mb-2">No students enrolled</p>
        <p className="text-sm">Students will appear here once they enroll in this section</p>
      </div>
    );
  }

  // Handle bulk upload save
  const handleBulkSave = async (grades: Array<{
    enrollmentId: Id<"enrollments">;
    assessmentId: Id<"assessments">;
    score: number;
  }>) => {
    if (!sessionToken) return;

    setIsSaving(true);
    try {
      await updateGradesMutation({
        grades,
        token: sessionToken,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving bulk grades:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle bulk upload completion
  const handleBulkUploadComplete = () => {
    // Refresh the gradebook data by triggering a re-render
    // The useQuery will automatically refetch
    setShowBulkUpload(false);
  };

  return (
    <div className="space-y-4">
      {/* Alert messages */}
      {alertMessage && (
        <Alert
          variant={alertMessage.variant}
          title={alertMessage.title}
          message={alertMessage.message}
        />
      )}

      {/* Warning message when grades are not editable */}
      {finalGradesPosted && !gradesEditable && (
        <Alert
          variant="warning"
          title="Grade Editing Locked"
          message="Final grades have been posted for this section. Grade editing is currently disabled. Please contact the registrar if you need to make changes."
        />
      )}

      {/* Toggle between manual entry and bulk upload */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={!showBulkUpload ? "primary" : "outline"}
            onClick={() => setShowBulkUpload(false)}
          >
            Manual Entry
          </Button>
          <Button
            size="sm"
            variant={showBulkUpload ? "primary" : "outline"}
            onClick={() => setShowBulkUpload(true)}
            disabled={!gradesEditable}
          >
            Bulk Upload
          </Button>
        </div>
        <div className="flex gap-2">
          {!showBulkUpload && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || isSaving || !gradesEditable}
            >
              {isSaving ? 'Saving...' : 'Save Grades'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPostFinalGradesModal(true)}
            disabled={isPostingFinalGrades || finalGradesPosted}
            className="bg-red-50 hover:bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-700"
          >
            {finalGradesPosted ? 'Final Grades Posted' : 'Post Final Grades'}
          </Button>
        </div>
      </div>

      {showBulkUpload ? (
        <BulkGradeUpload
          sectionId={sectionId}
          gradebookData={gradebookData}
          onUploadComplete={handleBulkUploadComplete}
          onSaveGrades={handleBulkSave}
        />
      ) : (
        <GradebookMatrixTable
          enrollments={gradebookData.enrollments}
          assessments={gradebookData.assessments}
          gradeValues={gradeValues}
          onScoreChange={handleScoreChange}
          calculateAverage={calculateAverage}
          calculateFinalGrade={calculateFinalGrade}
          disabled={!gradesEditable}
        />
      )}

      {/* Post Final Grades Confirmation Modal */}
      <Modal
        isOpen={showPostFinalGradesModal}
        onClose={() => setShowPostFinalGradesModal(false)}
        className="max-w-[500px] p-5 lg:p-10"
      >
        <h4 className="text-title-sm mb-4 font-semibold text-gray-800 dark:text-white/90">
          Post Final Grades
        </h4>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          This will finalize the term and publish grades to student transcripts. Cannot be undone.
        </p>
        <p className="mb-6 text-xs text-warning-600 dark:text-warning-400">
          <strong>Warning:</strong> This action will:
          <ul className="mt-2 ml-4 list-disc">
            <li>Calculate final grades for all students based on current assessment grades</li>
            <li>Mark all enrollments as &quot;completed&quot;</li>
            <li>Publish grades to student transcripts</li>
            <li>This action cannot be reversed</li>
          </ul>
        </p>
        <div className="flex w-full items-center justify-end gap-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowPostFinalGradesModal(false)}
            disabled={isPostingFinalGrades}
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handlePostFinalGrades}
            disabled={isPostingFinalGrades}
            className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          >
            {isPostingFinalGrades ? 'Posting...' : 'Post Final Grades'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

