"use client";

import { useState, FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import EmptyState from "@/components/empty-state/EmptyState";
import { EyeCloseIcon, EyeIcon } from "@/icons";

interface ChangePasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChangePasswordForm({ onSuccess, onCancel }: ChangePasswordFormProps) {
  const currentUser = useCurrentUser();
  const changePasswordMutation = useMutation(api.functions.auth.changePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const handleInputChange = (
    field: "currentPassword" | "newPassword" | "confirmPassword",
    value: string
  ) => {
    if (field === "currentPassword") {
      setCurrentPassword(value);
    } else if (field === "newPassword") {
      setNewPassword(value);
    } else {
      setConfirmPassword(value);
    }

    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = "Current password is required";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required";
    } else if (newPassword.length < 6) {
      errors.newPassword = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (currentPassword === newPassword) {
      errors.newPassword = "New password must be different from current password";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
      const result = await changePasswordMutation({
        userId: currentUser._id,
        currentPassword,
        newPassword,
      });

      if (result.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");

        if (onSuccess) {
          onSuccess();
        }
      } else {
        setApiError("Failed to change password. Please try again.");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      if (errorMessage.includes("Current password is incorrect")) {
        setValidationErrors((prev) => ({
          ...prev,
          currentPassword: "Current password is incorrect",
        }));
      } else {
        setApiError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <EmptyState
        title="Authentication Required"
        description="Please log in to change your password."
        status="error"
      />
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {apiError && (
            <div className="mb-6">
              <Alert variant="error" title="Error" message={apiError} />
            </div>
          )}

          <div>
            <Label>
              Current Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => handleInputChange("currentPassword", e.target.value)}
                error={!!validationErrors.currentPassword}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <span
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
              >
                {showCurrentPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                )}
              </span>
            </div>
            {validationErrors.currentPassword && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <Label>
              New Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => handleInputChange("newPassword", e.target.value)}
                error={!!validationErrors.newPassword}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <span
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
              >
                {showNewPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                )}
              </span>
            </div>
            {validationErrors.newPassword && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.newPassword}</p>
            )}
          </div>

          <div>
            <Label>
              Confirm New Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                error={!!validationErrors.confirmPassword}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <span
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
              >
                {showConfirmPassword ? (
                  <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                )}
              </span>
            </div>
            {validationErrors.confirmPassword && (
              <p className="text-error-500 mt-1 text-sm">{validationErrors.confirmPassword}</p>
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
                  Changing...
                </span>
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

