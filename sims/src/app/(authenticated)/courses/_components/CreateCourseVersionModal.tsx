'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Label from '@/components/form/Label';
import Input from '@/components/form/input/InputField';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';

interface CreateCourseVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  courseId: Id<'courses'>;
  currentCourse?: {
    title: string;
    description: string;
    credits: number;
    prerequisites: string[];
  };
}

export default function CreateCourseVersionModal({
  isOpen,
  onClose,
  onSuccess,
  courseId,
  currentCourse,
}: CreateCourseVersionModalProps) {
  // Initialize session token from localStorage
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    credits: '',
    prerequisites: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current course details if not provided
  const courseDetails = useQuery(
    api.functions.courses.getDetails,
    courseId ? { courseId } : 'skip'
  );

  // Initialize form with current course data
  useEffect(() => {
    if (currentCourse) {
      setFormData({
        title: currentCourse.title || '',
        description: currentCourse.description || '',
        credits: currentCourse.credits?.toString() || '',
        prerequisites: currentCourse.prerequisites?.join(', ') || '',
      });
    } else if (courseDetails) {
      setFormData({
        title: courseDetails.title || '',
        description: courseDetails.description || '',
        credits: '', // Don't pre-fill credits, let user enter
        prerequisites: courseDetails.prerequisites?.join(', ') || '',
      });
    }
  }, [currentCourse, courseDetails]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        description: '',
        credits: '',
        prerequisites: '',
      });
      setValidationErrors({});
      setApiError(null);
    }
  }, [isOpen]);

  // @ts-expect-error - Convex API path with slashes
  const createCourseVersion = useMutation(api["mutations/courseMutations"].createCourseVersion);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    const credits = parseFloat(formData.credits);
    if (!formData.credits || isNaN(credits) || credits <= 0) {
      errors.credits = 'Credits must be a positive number';
    }

    // Prerequisites are optional, but if provided, validate format
    if (formData.prerequisites.trim()) {
      const prereqs = formData.prerequisites.split(',').map((p) => p.trim()).filter((p) => p);
      if (prereqs.length === 0 && formData.prerequisites.trim()) {
        errors.prerequisites = 'Invalid prerequisites format. Use comma-separated course codes.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    if (!sessionToken) {
      setApiError('Authentication required. Please log in.');
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      // Parse prerequisites
      const prerequisites = formData.prerequisites
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);

      await createCourseVersion({
        token: sessionToken,
        courseId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        credits: parseFloat(formData.credits),
        prerequisites,
      });

      onSuccess();
      onClose();
    } catch (error) {
      let errorMessage = 'Failed to create course version';
      if (error instanceof Error) {
        const fullMessage = error.message;
        
        // Extract user-friendly error messages
        if (fullMessage.includes('Access denied')) {
          errorMessage = 'Access denied: Department head role required';
        } else if (fullMessage.includes('does not belong to your department')) {
          errorMessage = 'This course does not belong to your department';
        } else if (fullMessage.includes('Circular prerequisite')) {
          errorMessage = fullMessage;
        } else if (fullMessage.includes('Invalid prerequisite chain')) {
          errorMessage = fullMessage;
        } else {
          // Try to extract the error message after "Error: "
          const errorMatch = fullMessage.match(/(?:Uncaught )?Error:\s*(.+?)(?:\s+Called by client)?$/);
          if (errorMatch && errorMatch[1]) {
            errorMessage = errorMatch[1].trim();
          } else {
            errorMessage = fullMessage.replace(/\[CONVEX[^\]]+\]\s*/g, '').replace(/\[Request ID:[^\]]+\]\s*/g, '').trim();
          }
        }
      }
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[600px] p-6 lg:p-10"
    >
      <div className="w-full">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create New Course Version
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Create a new version of this course. The new version will become the active version, and previous active versions will be archived.
          </p>
        </div>
        <div className="px-2">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {apiError && (
                <div className="mb-6">
                  <Alert variant="error" title="Error" message={apiError} />
                </div>
              )}

              <div>
                <Label htmlFor="title">
                  Title <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="e.g., Introduction to Computer Science"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  error={!!validationErrors.title}
                  disabled={isLoading}
                />
                {validationErrors.title && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">
                  Description <span className="text-error-500">*</span>
                </Label>
                <textarea
                  id="description"
                  rows={4}
                  className={`w-full rounded-lg border px-4 py-3 text-sm ${
                    validationErrors.description
                      ? 'border-error-500'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-800 text-gray-800 dark:text-white/90 focus:outline-none focus:ring-2 focus:ring-brand-500`}
                  placeholder="Enter course description..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={isLoading}
                />
                {validationErrors.description && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="credits">
                  Credits <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g., 3"
                  value={formData.credits}
                  onChange={(e) => handleInputChange('credits', e.target.value)}
                  error={!!validationErrors.credits}
                  disabled={isLoading}
                />
                {validationErrors.credits && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.credits}</p>
                )}
              </div>

              <div>
                <Label htmlFor="prerequisites">
                  Prerequisites
                </Label>
                <Input
                  id="prerequisites"
                  type="text"
                  placeholder="e.g., COS 101, COS 102 (comma-separated course codes)"
                  value={formData.prerequisites}
                  onChange={(e) => handleInputChange('prerequisites', e.target.value)}
                  error={!!validationErrors.prerequisites}
                  disabled={isLoading}
                />
                {validationErrors.prerequisites && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.prerequisites}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter course codes separated by commas (e.g., COS 101, COS 102). Leave empty if there are no prerequisites.
                </p>
              </div>

              <div className="mt-6 flex w-full items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create Version'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
