"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Switch from "@/components/form/switch/Switch";
import Select from "@/components/form/Select";

interface NotificationSettingsFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function NotificationSettingsForm({ onSuccess, onCancel }: NotificationSettingsFormProps) {
  const [sessionToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sims_session_token');
    }
    return null;
  });

  const prefs = useQuery(
    api.functions.notifications.getNotificationPreferences,
    sessionToken ? { token: sessionToken } : 'skip'
  ) || { email: true, frequency: "immediate" };
  
  const [local, setLocal] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const save = useMutation(api.functions.notifications.saveNotificationPreferences);

  // Use prefs as the source of truth, merged with any local changes
  const currentValues = { ...prefs, ...local };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => { 
    e.preventDefault();
    setIsLoading(true);
    setApiError(null);

    if (!sessionToken) {
      setApiError("Session token not found. Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      await save({ 
        preferences: {
          email: currentValues.email as boolean | undefined,
          frequency: currentValues.frequency as string | undefined,
        },
        token: sessionToken 
      });
      
      setLocal({}); // Clear local changes after save
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {apiError && (
            <div className="mb-6">
              <Alert variant="error" title="Error" message={apiError} />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Switch
                label="Email notifications"
                defaultChecked={!!currentValues.email}
                onChange={(checked) => setLocal({...local, email: checked})}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-frequency">
                Notification Frequency
              </Label>
              <Select
                options={[
                  { value: "immediate", label: "Immediate" },
                  { value: "daily", label: "Daily digest" },
                  { value: "weekly", label: "Weekly" }
                ]}
                placeholder="Select notification frequency"
                defaultValue={currentValues.frequency as string || "immediate"}
                onChange={(e) => setLocal({...local, frequency: e.target.value})}
                disabled={isLoading}
              />
            </div>
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
                  Saving...
                </span>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
