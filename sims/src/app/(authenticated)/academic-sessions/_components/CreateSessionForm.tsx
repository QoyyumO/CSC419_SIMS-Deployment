'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import DatePicker from '@/components/form/date-picker';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';

interface CreateSessionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateSessionForm({ isOpen, onClose, onSuccess }: CreateSessionFormProps) {
  const [formData, setFormData] = useState({
    yearLabel: '',
    startDate: '',
    endDate: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    yearLabel?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [datePickerKey, setDatePickerKey] = useState(0);

  const createSessionMutation = useMutation(api.functions.academicSessions.createSession);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        yearLabel: '',
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

    if (!formData.yearLabel.trim()) {
      errors.yearLabel = 'Year label is required';
    } else if (!/^\d{4}\/\d{4}$/.test(formData.yearLabel.trim())) {
      errors.yearLabel = 'Year label must be in format YYYY/YYYY (e.g., 2024/2025)';
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

      await createSessionMutation({
        yearLabel: formData.yearLabel.trim(),
        startDate,
        endDate,
      });

      // Reset form and close modal
      setFormData({
        yearLabel: '',
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
        // Check if it's a uniqueness error
        if (error.message.includes('Year Label Uniqueness') || error.message.includes('already exists')) {
          message = 'An academic session with this year label already exists';
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
            Create New Academic Session
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new academic session with its year label and date range.
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
                <Label htmlFor="yearLabel">
                  Year Label <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="yearLabel"
                  type="text"
                  placeholder="e.g., 2024/2025"
                  value={formData.yearLabel}
                  onChange={(e) => handleInputChange('yearLabel', e.target.value)}
                  error={!!validationErrors.yearLabel}
                  disabled={isLoading}
                />
                {validationErrors.yearLabel && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.yearLabel}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Format: YYYY/YYYY (e.g., 2024/2025)
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="startDate">
                    Start Date <span className="text-error-500">*</span>
                  </Label>
                  <div className={validationErrors.startDate ? 'relative' : ''}>
                    <DatePicker
                      key={`startDate-${datePickerKey}`}
                      id={`startDate-${datePickerKey}`}
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
                  <Label htmlFor="endDate">
                    End Date <span className="text-error-500">*</span>
                  </Label>
                  <div className={validationErrors.endDate ? 'relative' : ''}>
                    <DatePicker
                      key={`endDate-${datePickerKey}`}
                      id={`endDate-${datePickerKey}`}
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
                    'Create Session'
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

