'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { Id } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Input from '@/components/form/input/InputField';
import Select from '@/components/form/Select';
import Label from '@/components/form/Label';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';

interface CreateProgramProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Department = {
  _id: Id<'departments'>;
  name: string;
};

type Course = {
  _id: Id<'courses'>;
  code: string;
  title: string;
  status?: string;
};

export default function CreateProgram({ isOpen, onClose, onSuccess }: CreateProgramProps) {
  const [formData, setFormData] = useState({
    name: '',
    departmentId: '',
    durationYears: '',
    creditRequirements: '',
    requiredCourses: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    departmentId?: string;
    durationYears?: string;
    creditRequirements?: string;
    requiredCourses?: string;
  }>({});

  const createProgramMutation = useMutation(api.programs.create);
  
  // Fetch departments and courses for dropdowns
  const departments = useQuery(api.departments.list) as Department[] | undefined;
  const courses = useQuery(api.courses.listPublic, {}) as Course[] | undefined;

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Program name is required';
    }

    if (!formData.departmentId) {
      errors.departmentId = 'Department is required';
    }

    const duration = parseFloat(formData.durationYears);
    if (!formData.durationYears || isNaN(duration) || duration <= 0) {
      errors.durationYears = 'Duration must be a positive number';
    }

    const credits = parseFloat(formData.creditRequirements);
    if (!formData.creditRequirements || isNaN(credits) || credits <= 0) {
      errors.creditRequirements = 'Credit requirements must be a positive number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string | string[]) => {
    setFormData({ ...formData, [field]: value });
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (apiError) {
      setApiError(null);
    }
  };

  const handleCourseToggle = (courseId: string) => {
    const currentCourses = formData.requiredCourses;
    const newCourses = currentCourses.includes(courseId)
      ? currentCourses.filter((id) => id !== courseId)
      : [...currentCourses, courseId];
    handleInputChange('requiredCourses', newCourses);
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
      await createProgramMutation({
        name: formData.name.trim(),
        departmentId: formData.departmentId as Id<'departments'>,
        durationYears: parseFloat(formData.durationYears),
        creditRequirements: parseFloat(formData.creditRequirements),
        requiredCourses: formData.requiredCourses.map((id) => id as Id<'courses'>),
      });

      // Reset form and close modal
      setFormData({
        name: '',
        departmentId: '',
        durationYears: '',
        creditRequirements: '',
        requiredCourses: [],
      });
      onClose();
      // Notify parent of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      let message = 'An unexpected error occurred. Please try again.';
      
      if (error instanceof Error) {
        message = error.message;
      }
      
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare options for dropdowns
  const departmentOptions =
    departments?.map((dept) => ({
      value: dept._id,
      label: dept.name,
    })) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[800px] p-6 lg:p-10"
    >
      <div className="w-full">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create New Program
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new academic program. Select the department it belongs to, set duration and credit requirements, and choose required courses.
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
                <Label htmlFor="name">
                  Program Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., BSc Computer Science"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  error={!!validationErrors.name}
                  disabled={isLoading}
                />
                {validationErrors.name && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="departmentId">
                  Department <span className="text-error-500">*</span>
                </Label>
                <Select
                  options={[
                    { value: '', label: 'Select a department' },
                    ...departmentOptions,
                  ]}
                  placeholder="Select a department"
                  defaultValue={formData.departmentId}
                  onChange={(e) => handleInputChange('departmentId', e.target.value)}
                  disabled={isLoading || !departments}
                />
                {validationErrors.departmentId && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.departmentId}</p>
                )}
                {!departments && (
                  <p className="text-gray-500 mt-1 text-sm">Loading departments...</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="durationYears">
                    Duration (Years) <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="durationYears"
                    type="number"
                    placeholder="e.g., 4"
                    value={formData.durationYears}
                    onChange={(e) => handleInputChange('durationYears', e.target.value)}
                    error={!!validationErrors.durationYears}
                    disabled={isLoading}
                    min="1"
                    step="0.5"
                  />
                  {validationErrors.durationYears && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.durationYears}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="creditRequirements">
                    Credit Requirements <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="creditRequirements"
                    type="number"
                    placeholder="e.g., 120"
                    value={formData.creditRequirements}
                    onChange={(e) => handleInputChange('creditRequirements', e.target.value)}
                    error={!!validationErrors.creditRequirements}
                    disabled={isLoading}
                    min="1"
                  />
                  {validationErrors.creditRequirements && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.creditRequirements}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="requiredCourses">
                  Required Courses
                </Label>
                <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {!courses ? (
                    <p className="text-gray-500 text-sm">Loading courses...</p>
                  ) : courses.length === 0 ? (
                    <p className="text-gray-500 text-sm">No courses available</p>
                  ) : (
                    <div className="space-y-2">
                      {courses.map((course) => (
                        <label
                          key={course._id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.requiredCourses.includes(course._id)}
                            onChange={() => handleCourseToggle(course._id)}
                            disabled={isLoading}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm flex items-center gap-2">
                            <span className="font-medium">{course.code}</span> - {course.title}
                            {course.status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                course.status === 'C' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                course.status === 'R' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                              }`}>
                                {course.status === 'C' ? 'Core' : course.status === 'R' ? 'Required' : 'Elective'}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.requiredCourses.length > 0 && (
                  <p className="text-gray-500 mt-2 text-sm">
                    {formData.requiredCourses.length} course{formData.requiredCourses.length !== 1 ? 's' : ''} selected
                  </p>
                )}
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
                    'Create Program'
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

