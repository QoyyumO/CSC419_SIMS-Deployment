"use client";

import { useState, FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Loading from "@/components/loading/Loading";

export function ForgotPasswordForm() {
  const requestReset = useMutation(api.functions.auth.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
  }>({});

  const handleInputChange = (value: string) => {
    setEmail(value);
    if (validationErrors.email) {
      setValidationErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);
    setApiMessage(null);
    setValidationErrors({});

    // Comprehensive email regex pattern
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!email.trim()) {
      setValidationErrors({ email: "Email is required" });
      setIsLoading(false);
      return;
    } else if (!emailRegex.test(email.trim())) {
      setValidationErrors({ email: "Please enter a valid email address" });
      setIsLoading(false);
      return;
    }

    try {
      // Convert email to lowercase for case-insensitive lookup
      const res = await requestReset({ username: email.toLowerCase().trim() });
      setApiMessage(res?.message ?? "If the account exists, reset instructions were sent.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {apiError && (
          <div className="mb-6">
            <Alert variant="error" title="Error" message={apiError} />
          </div>
        )}

        {apiMessage && (
          <div className="mb-6">
            <Alert variant="success" title="Success" message={apiMessage} />
          </div>
        )}

        <div>
          <Label>
            Email <span className="text-error-500">*</span>
          </Label>
          <Input
            id="email"
            placeholder="Enter your email"
            type="email"
            value={email}
            onChange={(e) => handleInputChange(e.target.value)}
            error={!!validationErrors.email}
            disabled={isLoading}
            autoComplete="email"
          />
          {validationErrors.email && (
            <p className="text-error-500 mt-1 text-sm">{validationErrors.email}</p>
          )}
        </div>

        <div>
          <Button type="submit" className="w-full" disabled={isLoading} size="full">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loading />
                Sending...
              </span>
            ) : (
              "Send Reset Link"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

