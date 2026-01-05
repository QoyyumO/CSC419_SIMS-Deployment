'use client';

import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Modal } from '@/components/ui/modal';
import Input from '@/components/form/input/InputField';
import Label from '@/components/form/Label';
import Button from '@/components/ui/button/Button';
import Alert from '@/components/ui/alert/Alert';

interface CreateSchoolProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateSchool({ isOpen, onClose, onSuccess }: CreateSchoolProps) {
  const [formData, setFormData] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    email: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    phone?: string;
  }>({});

  const createSchoolMutation = useMutation(api.functions.schools.create);

  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'School name is required';
    }

    if (!formData.street.trim()) {
      errors.street = 'Street address is required';
    }

    if (!formData.city.trim()) {
      errors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      errors.state = 'State is required';
    }

    if (!formData.postalCode.trim()) {
      errors.postalCode = 'Postal code is required';
    }

    if (!formData.country.trim()) {
      errors.country = 'Country is required';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
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
      await createSchoolMutation({
        name: formData.name.trim(),
        address: {
          street: formData.street.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
          country: formData.country.trim(),
        },
        contact: {
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        },
      });

      // Reset form and close modal
      setFormData({
        name: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        email: '',
        phone: '',
      });
      onClose();
      // Notify parent of success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      let message = 'An unexpected error occurred. Please try again.';
      
      if (error instanceof Error) {
        // Check if it's a school name uniqueness error
        if (error.message.includes('School Name Uniqueness') || error.message.includes('already exists')) {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-[800px] p-6 lg:p-10"
    >
      <div className="w-full">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            Create New School
          </h4>
          <p className="mb-6 text-sm text-gray-500 lg:mb-7 dark:text-gray-400">
            Add a new school to the system with its address and contact information.
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
                  School Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter school name"
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
                <div className="sm:col-span-2">
                  <Label htmlFor="street">
                    Street Address <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="street"
                    type="text"
                    placeholder="Enter street address"
                    value={formData.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    error={!!validationErrors.street}
                    disabled={isLoading}
                  />
                  {validationErrors.street && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.street}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city">
                    City <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Enter city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    error={!!validationErrors.city}
                    disabled={isLoading}
                  />
                  {validationErrors.city && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.city}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state">
                    State <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="state"
                    type="text"
                    placeholder="Enter state"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    error={!!validationErrors.state}
                    disabled={isLoading}
                  />
                  {validationErrors.state && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.state}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postalCode">
                    Postal Code <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="postalCode"
                    type="text"
                    placeholder="Enter postal code"
                    value={formData.postalCode}
                    onChange={(e) => handleInputChange('postalCode', e.target.value)}
                    error={!!validationErrors.postalCode}
                    disabled={isLoading}
                  />
                  {validationErrors.postalCode && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.postalCode}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="country">
                    Country <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="country"
                    type="text"
                    placeholder="Enter country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    error={!!validationErrors.country}
                    disabled={isLoading}
                  />
                  {validationErrors.country && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.country}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <Label htmlFor="phone">
                    Phone <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    error={!!validationErrors.phone}
                    disabled={isLoading}
                    autoComplete="tel"
                  />
                  {validationErrors.phone && (
                    <p className="text-error-500 mt-1 text-sm">{validationErrors.phone}</p>
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
                    'Create School'
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

