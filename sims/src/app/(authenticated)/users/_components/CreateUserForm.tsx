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

interface CreateUserProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const createRoleOptions: { value: string; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'student', label: 'Student' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'department_head', label: 'Department Head' },
];

const levelOptions: { value: string; label: string }[] = [
  { value: '100', label: '100 Level' },
  { value: '200', label: '200 Level' },
  { value: '300', label: '300 Level' },
  { value: '400', label: '400 Level' },
  { value: '500', label: '500 Level' },
];

const statusOptions: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'graduated', label: 'Graduated' },
];

export default function CreateUser({ isOpen, onClose, onSuccess }: CreateUserProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: '',
    studentNumber: '',
    departmentId: '',
    level: '',
    status: 'active',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    studentNumber?: string;
    departmentId?: string;
    level?: string;
  }>({});

  const createUserMutation = useMutation(api.functions.users.createUser);
  const departments = useQuery(api.functions.departments.list);

  const isStudentRole = formData.role === 'student';
  const isInstructorRole = formData.role === 'instructor';

  const validate = (): boolean => {
    const errors: { 
      firstName?: string; 
      lastName?: string; 
      email?: string; 
      role?: string;
      studentNumber?: string;
      departmentId?: string;
      level?: string;
    } = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.role) {
      errors.role = 'Role is required';
    }

    // Validate student-specific fields if role is student
    if (isStudentRole) {
      if (!formData.studentNumber.trim()) {
        errors.studentNumber = 'Student number is required';
      }

      if (!formData.departmentId) {
        errors.departmentId = 'Department is required';
      }

      if (!formData.level) {
        errors.level = 'Level is required';
      }
    }

    // Validate instructor-specific fields if role is instructor
    if (isInstructorRole) {
      if (!formData.departmentId) {
        errors.departmentId = 'Department is required';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (validationErrors[field as keyof typeof validationErrors]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (apiError) {
      setApiError(null);
    }
  };

  // Prepare department options for select
  const departmentOptions = departments?.map((department) => ({
    value: department._id,
    label: `${department.name}${department.schoolName ? ` (${department.schoolName})` : ''}`,
  })) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});

    if (!validate()) {
      setIsLoading(false);
      return;
    }

    // Generate a temporary password if not provided
    const password = formData.password || `Temp${Math.random().toString(36).slice(-8)}!`;

    try {
      const mutationData: {
        email: string;
        password: string;
        roles: string[];
        profile: {
          firstName: string;
          lastName: string;
        };
        studentData?: {
          studentNumber: string;
          departmentId: Id<'departments'>;
          level: string;
          status: string;
        };
        instructorData?: {
          departmentId: Id<'departments'>;
        };
      } = {
        email: formData.email.trim(),
        password: password,
        roles: [formData.role],
        profile: {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
        },
      };

      // Include student data if role is student
      if (isStudentRole) {
        mutationData.studentData = {
          studentNumber: formData.studentNumber.trim(),
          departmentId: formData.departmentId as Id<'departments'>,
          level: formData.level,
          status: formData.status,
        };
      }

      // Include instructor data if role is instructor
      if (isInstructorRole) {
        mutationData.instructorData = {
          departmentId: formData.departmentId as Id<'departments'>,
        };
      }

      await createUserMutation(mutationData);

      // Reset form and close modal
      setFormData({ 
        firstName: '', 
        lastName: '', 
        email: '', 
        password: '', 
        role: '',
        studentNumber: '',
        departmentId: '',
        level: '',
        status: 'active',
      });
      onClose();
      // Notify parent of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[800px] p-6 lg:p-10"
    >
      <div className="w-full">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create New User
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new user to the system with their profile information and role.
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
              <Label htmlFor="firstName">
                First Name <span className="text-error-500">*</span>
              </Label>
              <Input
                id="firstName"
                type="text"
                placeholder="Enter first name"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                error={!!validationErrors.firstName}
                disabled={isLoading}
                autoComplete="given-name"
              />
              {validationErrors.firstName && (
                <p className="text-error-500 mt-1 text-sm">{validationErrors.firstName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">
                Last Name <span className="text-error-500">*</span>
              </Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                error={!!validationErrors.lastName}
                disabled={isLoading}
                autoComplete="family-name"
              />
              {validationErrors.lastName && (
                <p className="text-error-500 mt-1 text-sm">{validationErrors.lastName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">
                Email <span className="text-error-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!validationErrors.email}
                disabled={isLoading}
                autoComplete="email"
              />
              {validationErrors.email && (
                <p className="text-error-500 mt-1 text-sm">{validationErrors.email}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">
                Password <span className="text-gray-500 text-xs font-normal">(Leave empty for auto-generated)</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password (optional)"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            <div>
              <Label htmlFor="role">
                Role <span className="text-error-500">*</span>
              </Label>
              <Select
                options={createRoleOptions}
                placeholder="Select a role"
                defaultValue={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                disabled={isLoading}
              />
              {validationErrors.role && (
                <p className="text-error-500 mt-1 text-sm">{validationErrors.role}</p>
              )}
            </div>

            {/* Student-specific fields */}
            {isStudentRole && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h5 className="text-sm font-semibold text-gray-800 mb-4 dark:text-white/90">
                    Student Information
                  </h5>
                </div>

                <div>
                  <Label htmlFor="studentNumber">
                    Student Number <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="studentNumber"
                    type="text"
                    placeholder="Enter student number"
                    value={formData.studentNumber}
                    onChange={(e) => handleInputChange('studentNumber', e.target.value)}
                    error={!!validationErrors.studentNumber}
                    disabled={isLoading}
                  />
                  {validationErrors.studentNumber && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.studentNumber}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="departmentId">
                    Department <span className="text-error-500">*</span>
                  </Label>
                  <Select
                    options={departmentOptions}
                    placeholder="Select a department"
                    defaultValue={formData.departmentId}
                    onChange={(e) => handleInputChange('departmentId', e.target.value)}
                    disabled={isLoading || !departments}
                    error={!!validationErrors.departmentId}
                  />
                  {validationErrors.departmentId && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.departmentId}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="level">
                    Level <span className="text-error-500">*</span>
                  </Label>
                  <Select
                    options={levelOptions}
                    placeholder="Select level"
                    defaultValue={formData.level}
                    onChange={(e) => handleInputChange('level', e.target.value)}
                    disabled={isLoading}
                    error={!!validationErrors.level}
                  />
                  {validationErrors.level && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.level}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="status">
                    Status
                  </Label>
                  <Select
                    options={statusOptions}
                    placeholder="Select status"
                    defaultValue={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {/* Instructor-specific fields */}
            {isInstructorRole && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h5 className="text-sm font-semibold text-gray-800 mb-4 dark:text-white/90">
                    Instructor Information
                  </h5>
                </div>

                <div>
                  <Label htmlFor="departmentId">
                    Department <span className="text-error-500">*</span>
                  </Label>
                  <Select
                    options={departmentOptions}
                    placeholder="Select a department"
                    defaultValue={formData.departmentId}
                    onChange={(e) => handleInputChange('departmentId', e.target.value)}
                    disabled={isLoading || !departments}
                    error={!!validationErrors.departmentId}
                  />
                  {validationErrors.departmentId && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.departmentId}</p>
                  )}
                </div>
              </>
            )}

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
                  'Create User'
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

