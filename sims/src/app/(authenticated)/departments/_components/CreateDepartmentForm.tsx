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

interface CreateDepartmentProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type School = {
  _id: Id<'schools'>;
  name: string;
};

type User = {
  _id: Id<'users'>;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
  };
};

export default function CreateDepartment({ isOpen, onClose, onSuccess }: CreateDepartmentProps) {
  const [formData, setFormData] = useState({
    name: '',
    schoolId: '',
    headId: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    schoolId?: string;
    headId?: string;
  }>({});

  const createDepartmentMutation = useMutation(api.functions.departments.create);
  
  // Fetch schools and users for dropdowns
  const schools = useQuery(api.functions.schools.list) as School[] | undefined;
  const users = useQuery(api.functions.users.getUsersByRole, { role: 'department_head' }) as User[] | undefined;

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Department name is required';
    }

    if (!formData.schoolId) {
      errors.schoolId = 'School is required';
    }

    if (!formData.headId) {
      errors.headId = 'Department head is required';
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
      await createDepartmentMutation({
        name: formData.name.trim(),
        schoolId: formData.schoolId as Id<'schools'>,
        headId: formData.headId as Id<'users'>,
      });

      // Reset form and close modal
      setFormData({
        name: '',
        schoolId: '',
        headId: '',
      });
      onClose();
      // Notify parent of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      let message = 'An unexpected error occurred. Please try again.';
      
      if (error instanceof Error) {
        // Check if it's a name uniqueness error
        if (error.message.includes('already exists') || error.message.includes('Uniqueness')) {
          message = 'Name already exists';
        } else {
          message = error.message;
        }
      }
      
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare options for dropdowns
  const schoolOptions =
    schools?.map((school) => ({
      value: school._id,
      label: school.name,
    })) || [];

  const userOptions =
    users?.map((user) => ({
      value: user._id,
      label: `${user.profile.firstName} ${user.profile.lastName} (${user.email})`,
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
            Create New Department
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new department to the system. Select the school it belongs to and assign a department head.
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
                  Department Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter department name"
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
                <Label htmlFor="schoolId">
                  School <span className="text-error-500">*</span>
                </Label>
                <Select
                  options={[
                    { value: '', label: 'Select a school' },
                    ...schoolOptions,
                  ]}
                  placeholder="Select a school"
                  defaultValue={formData.schoolId}
                  onChange={(e) => handleInputChange('schoolId', e.target.value)}
                  disabled={isLoading || !schools}
                />
                {validationErrors.schoolId && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.schoolId}</p>
                )}
                {!schools && (
                  <p className="text-gray-500 mt-1 text-sm">Loading schools...</p>
                )}
              </div>

              <div>
                <Label htmlFor="headId">
                  Department Head <span className="text-error-500">*</span>
                </Label>
                <Select
                  options={[
                    { value: '', label: 'Select a department head' },
                    ...userOptions,
                  ]}
                  placeholder="Select a department head"
                  defaultValue={formData.headId}
                  onChange={(e) => handleInputChange('headId', e.target.value)}
                  disabled={isLoading || !users}
                />
                {validationErrors.headId && (
                  <p className="text-error-500 mt-1 text-sm">{validationErrors.headId}</p>
                )}
                {!users && (
                  <p className="text-gray-500 mt-1 text-sm">Loading users...</p>
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
                    'Create Department'
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

