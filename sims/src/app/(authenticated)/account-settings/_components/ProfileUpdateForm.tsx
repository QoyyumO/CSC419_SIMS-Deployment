"use client";

import { useState, FormEvent, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import EmptyState from "@/components/empty-state/EmptyState";

interface ProfileUpdateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProfileUpdateForm({ onSuccess, onCancel }: ProfileUpdateFormProps) {
  const currentUser = useCurrentUser();
  const updateProfileMutation = useMutation(api.functions.users.updateProfile);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    firstName?: string;
    lastName?: string;
  }>({});

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.profile.firstName || "");
      setMiddleName(currentUser.profile.middleName || "");
      setLastName(currentUser.profile.lastName || "");
    }
  }, [currentUser]);

  const validate = (): boolean => {
    const errors: { firstName?: string; lastName?: string } = {};

    if (!firstName.trim()) {
      errors.firstName = "First name is required";
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (
    field: "firstName" | "middleName" | "lastName",
    value: string
  ) => {
    if (field === "firstName") {
      setFirstName(value);
    } else if (field === "middleName") {
      setMiddleName(value);
    } else {
      setLastName(value);
    }

    if ((field === "firstName" || field === "lastName") && validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setValidationErrors({});

    if (!validate() || !currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await updateProfileMutation({
        userId: currentUser._id,
        profile: {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
        },
      });

      if (result.success) {
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setApiError("Failed to update profile. Please try again.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <EmptyState
        title="Authentication Required"
        description="Please log in to update your profile."
        status="error"
      />
    );
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {apiError && (
            <div className="mb-6">
              <Alert variant="error" title="Error" message={apiError} />
            </div>
          )}

          <div>
            <Label>
              First Name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="firstName"
              placeholder="Enter your first name"
              type="text"
              value={firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              error={!!validationErrors.firstName}
              disabled={isLoading}
              autoComplete="given-name"
            />
            {validationErrors.firstName && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.firstName}</p>
            )}
          </div>

          <div>
            <Label>Middle Name</Label>
            <Input
              id="middleName"
              placeholder="Enter your middle name (optional)"
              type="text"
              value={middleName}
              onChange={(e) => handleInputChange("middleName", e.target.value)}
              disabled={isLoading}
              autoComplete="additional-name"
            />
          </div>

          <div>
            <Label>
              Last Name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="lastName"
              placeholder="Enter your last name"
              type="text"
              value={lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              error={!!validationErrors.lastName}
              disabled={isLoading}
              autoComplete="family-name"
            />
            {validationErrors.lastName && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.lastName}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  Updating...
                </span>
              ) : (
                "Update Profile"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

