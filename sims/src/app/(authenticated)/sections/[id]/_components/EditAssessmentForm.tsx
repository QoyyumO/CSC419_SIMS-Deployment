'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';
import DatePicker from '@/components/form/date-picker';

type Assessment = {
  _id: Id<"assessments">;
  sectionId: Id<"sections">;
  title: string;
  weight: number;
  totalPoints: number;
  dueDate: number;
};

interface EditAssessmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  assessment: Assessment | null;
  existingAssessments: Array<{ _id: Id<"assessments">; weight: number }>;
}

export default function EditAssessmentForm({ 
  isOpen, 
  onClose, 
  onSuccess,
  assessment,
  existingAssessments 
}: EditAssessmentFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    weight: '',
    totalPoints: '',
    dueDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    title?: string;
    weight?: string;
    totalPoints?: string;
    dueDate?: string;
  }>({});
  const [weightWarning, setWeightWarning] = useState<string | null>(null);
  const [datePickerKey, setDatePickerKey] = useState(0);

  // @ts-expect-error - Convex API path with slashes
  const updateAssessmentMutation = useMutation(api["mutations/assessmentMutations"].updateAssessment);

  // Get session token from localStorage
  const getSessionToken = (): string | null => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sims_session_token");
    }
    return null;
  };

  // Populate form when assessment changes
  useEffect(() => {
    if (assessment && isOpen) {
      const dueDate = new Date(assessment.dueDate);
      const dateString = dueDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      
      setFormData({
        title: assessment.title,
        weight: assessment.weight.toString(),
        totalPoints: assessment.totalPoints.toString(),
        dueDate: dateString,
      });
      setValidationErrors({});
      setApiError(null);
      setWeightWarning(null);
      setDatePickerKey(prev => prev + 1);
    }
  }, [assessment, isOpen]);

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};
    let warning: string | null = null;

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.weight.trim()) {
      errors.weight = 'Weight is required';
    } else {
      const weight = parseFloat(formData.weight);
      if (isNaN(weight) || weight < 0 || weight > 100) {
        errors.weight = 'Weight must be a number between 0 and 100';
      } else {
        // Check if total weight would exceed 100% (excluding current assessment)
        const otherAssessments = existingAssessments.filter(a => a._id !== assessment?._id);
        const currentTotal = otherAssessments.reduce((sum, a) => sum + a.weight, 0);
        const newTotal = currentTotal + weight;
        if (newTotal > 100) {
          warning = `Warning: Total weight would be ${newTotal.toFixed(1)}%, exceeding 100%`;
        }
      }
    }

    if (!formData.totalPoints.trim()) {
      errors.totalPoints = 'Total points is required';
    } else {
      const totalPoints = parseFloat(formData.totalPoints);
      if (isNaN(totalPoints) || totalPoints <= 0) {
        errors.totalPoints = 'Total points must be a positive number';
      }
    }

    if (!formData.dueDate.trim()) {
      errors.dueDate = 'Due date is required';
    } else {
      const dueDate = new Date(formData.dueDate);
      if (isNaN(dueDate.getTime())) {
        errors.dueDate = 'Invalid date';
      }
    }

    setValidationErrors(errors);
    setWeightWarning(warning);
    // Block submission if there are errors OR if weight exceeds 100%
    return Object.keys(errors).length === 0 && !warning;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (apiError) {
      setApiError(null);
    }
    if (weightWarning && field === 'weight') {
      setWeightWarning(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessment) return;

    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});
    setWeightWarning(null);

    if (!validate()) {
      setIsLoading(false);
      return;
    }

    try {
      const token = getSessionToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const dueDateTimestamp = new Date(formData.dueDate).getTime();

      await updateAssessmentMutation({
        assessmentId: assessment._id,
        title: formData.title.trim(),
        weight: parseFloat(formData.weight),
        totalPoints: parseFloat(formData.totalPoints),
        dueDate: dueDateTimestamp,
        token,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      // Parse error message to extract user-friendly message
      let errorMessage = 'An error occurred while updating the assessment. Please try again.';
      
      if (error instanceof Error) {
        const errorStr = error.message;
        
        // If it's a weight validation error, show the warning instead of the raw error
        if (errorStr.includes('total weight') || errorStr.includes('exceeding 100%')) {
          const weight = parseFloat(formData.weight);
          if (!isNaN(weight)) {
            const otherAssessments = existingAssessments.filter(a => a._id !== assessment._id);
            const currentTotal = otherAssessments.reduce((sum, a) => sum + a.weight, 0);
            const newTotal = currentTotal + weight;
            setWeightWarning(`Warning: Total weight would be ${newTotal.toFixed(1)}%, exceeding 100%`);
          }
          return; // Don't set apiError for weight warnings
        } else if (errorStr.includes('Validation error')) {
          // Extract user-friendly message from ValidationError
          const match = errorStr.match(/Validation error for field '[^']+': (.+)/);
          if (match) {
            errorMessage = match[1];
          } else {
            errorMessage = errorStr.replace(/Validation error for field '[^']+': /, '');
          }
        } else if (errorStr.includes('Access denied')) {
          errorMessage = 'You do not have permission to update assessments for this section.';
        } else if (errorStr.includes('Authentication required') || errorStr.includes('Invalid session token')) {
          errorMessage = 'Your session has expired. Please log in again to continue.';
        } else if (errorStr.includes('not found')) {
          errorMessage = 'The assessment could not be found. Please refresh the page and try again.';
        } else {
          errorMessage = errorStr;
        }
      }
      
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        title: '',
        weight: '',
        totalPoints: '',
        dueDate: '',
      });
      setValidationErrors({});
      setApiError(null);
      setWeightWarning(null);
      setDatePickerKey(prev => prev + 1);
      onClose();
    }
  };

  if (!assessment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      className="max-w-[600px] p-5 lg:p-10"
    >
      <h4 className="text-title-sm mb-6 font-semibold text-gray-800 dark:text-white/90">
        Edit Assessment
      </h4>

      {apiError && (
        <Alert variant="error" title="Error" message={apiError} className="mb-4" />
      )}

      {weightWarning && (
        <Alert variant="warning" title="Weight Warning" message={weightWarning} className="mb-4" />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">
            Title <span className="text-error-500">*</span>
          </Label>
          <Input
            id="title"
            type="text"
            placeholder="e.g., Midterm Exam, Final Project"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            error={!!validationErrors.title}
            disabled={isLoading}
          />
          {validationErrors.title && (
            <p className="text-error-500 mt-1 text-sm">{validationErrors.title}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="weight">
              Weight (%) <span className="text-error-500">*</span>
            </Label>
            <Input
              id="weight"
              type="number"
              placeholder="e.g., 30"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              error={!!validationErrors.weight}
              disabled={isLoading}
              min="0"
              max="100"
              step="0.1"
            />
            {validationErrors.weight && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.weight}</p>
            )}
          </div>

          <div>
            <Label htmlFor="totalPoints">
              Total Points <span className="text-error-500">*</span>
            </Label>
            <Input
              id="totalPoints"
              type="number"
              placeholder="e.g., 100"
              value={formData.totalPoints}
              onChange={(e) => handleInputChange('totalPoints', e.target.value)}
              error={!!validationErrors.totalPoints}
              disabled={isLoading}
              min="1"
              step="0.1"
            />
            {validationErrors.totalPoints && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.totalPoints}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="dueDate">
            Due Date <span className="text-error-500">*</span>
          </Label>
          <DatePicker
            key={`dueDate-${datePickerKey}`}
            id={`dueDate-${datePickerKey}`}
            mode="single"
            placeholder="Select due date"
            defaultDate={formData.dueDate || undefined}
            onChange={(dates, currentDateString) => {
              if (currentDateString) {
                handleInputChange('dueDate', currentDateString);
              }
            }}
          />
          {validationErrors.dueDate && (
            <p className="text-error-500 mt-1 text-sm">{validationErrors.dueDate}</p>
          )}
        </div>

        <div className="mt-6 flex w-full items-center justify-end gap-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Update Assessment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

