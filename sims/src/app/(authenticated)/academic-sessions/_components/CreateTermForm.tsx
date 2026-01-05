'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import DatePicker from '@/components/form/date-picker';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';

type AcademicSession = {
  _id: Id<'academicSessions'>;
  yearLabel: string;
  startDate: number;
  endDate: number;
};

interface CreateTermFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessions: AcademicSession[] | undefined;
}

export default function CreateTermForm({ isOpen, onClose, onSuccess, sessions }: CreateTermFormProps) {
  const [formData, setFormData] = useState({
    sessionId: '',
    name: '',
    startDate: '',
    endDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    sessionId?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [datePickerKey, setDatePickerKey] = useState(0);

  const createTermMutation = useMutation(api.functions.academicSessions.createTerm);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        sessionId: '',
        name: '',
        startDate: '',
        endDate: '',
      });
      setValidationErrors({});
      setApiError(null);
      setDatePickerKey(prev => prev + 1); // Force DatePicker remount
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.sessionId) {
      errors.sessionId = 'Academic session is required';
    }

    if (!formData.name.trim()) {
      errors.name = 'Term name is required';
    }

    if (!formData.startDate.trim()) {
      errors.startDate = 'Start date is required';
    }

    if (!formData.endDate.trim()) {
      errors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        errors.endDate = 'End date must be after start date';
      }

      // Validate dates are within session range if session is selected
      if (formData.sessionId && sessions) {
        const session = sessions.find(s => s._id === formData.sessionId);
        if (session) {
          const sessionStart = new Date(session.startDate);
          const sessionEnd = new Date(session.endDate);
          if (start < sessionStart || end > sessionEnd) {
            errors.startDate = 'Term dates must be within the academic session date range';
            errors.endDate = 'Term dates must be within the academic session date range';
          }
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (apiError) {
      setApiError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});

    if (!validate()) {
      setIsLoading(false);
      return;
    }

    try {
      const startDate = new Date(formData.startDate).getTime();
      const endDate = new Date(formData.endDate).getTime();

      await createTermMutation({
        sessionId: formData.sessionId as Id<'academicSessions'>,
        name: formData.name.trim(),
        startDate,
        endDate,
      });

      // Reset form and close modal
      setFormData({
        sessionId: '',
        name: '',
        startDate: '',
        endDate: '',
      });
      onClose();
      // Notify parent of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      let message = 'An unexpected error occurred. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('overlap') || error.message.includes('Non-Overlapping Terms')) {
          message = 'Term dates overlap with an existing term in this session';
        } else {
          message = error.message;
        }
      }
      
      setApiError(message);
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
            Create New Term
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new term to an academic session (e.g., Fall, Spring, Summer).
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
                <Label htmlFor="sessionId">
                  Academic Session <span className="text-error-500">*</span>
                </Label>
                <select
                  id="sessionId"
                  value={formData.sessionId}
                  onChange={(e) => handleInputChange('sessionId', e.target.value)}
                  className={`h-10 w-full rounded-lg border px-3 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 ${
                    validationErrors.sessionId
                      ? 'border-error-500 focus:border-error-500 focus:ring-error-500/10'
                      : 'border-gray-300 dark:border-gray-700'
                  }`}
                  disabled={isLoading}
                >
                  <option value="">Select an academic session</option>
                  {sessions?.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.yearLabel}
                    </option>
                  ))}
                </select>
                {validationErrors.sessionId && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.sessionId}</p>
                )}
              </div>

              <div>
                <Label htmlFor="name">
                  Term Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Fall, Spring, Summer"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!validationErrors.name}
                  disabled={isLoading}
                />
                {validationErrors.name && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="termStartDate">
                    Start Date <span className="text-error-500">*</span>
                  </Label>
                  <div className={validationErrors.startDate ? 'relative' : ''}>
                    <DatePicker
                      key={`termStartDate-${datePickerKey}`}
                      id={`termStartDate-${datePickerKey}`}
                      mode="single"
                      placeholder="Select start date"
                      defaultDate={formData.startDate || undefined}
                      onChange={(dates, currentDateString) => {
                        if (currentDateString) {
                          handleInputChange('startDate', currentDateString);
                        }
                      }}
                    />
                  </div>
                  {validationErrors.startDate && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.startDate}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="termEndDate">
                    End Date <span className="text-error-500">*</span>
                  </Label>
                  <div className={validationErrors.endDate ? 'relative' : ''}>
                    <DatePicker
                      key={`termEndDate-${datePickerKey}`}
                      id={`termEndDate-${datePickerKey}`}
                      mode="single"
                      placeholder="Select end date"
                      defaultDate={formData.endDate || undefined}
                      onChange={(dates, currentDateString) => {
                        if (currentDateString) {
                          handleInputChange('endDate', currentDateString);
                        }
                      }}
                    />
                  </div>
                  {validationErrors.endDate && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.endDate}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      Creating...
                    </span>
                  ) : (
                    'Create Term'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}

