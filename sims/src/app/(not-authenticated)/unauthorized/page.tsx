"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/ui/button/Button";
import { useAuth } from "@/hooks/useAuth";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-red-600 dark:text-red-400 mb-4">
          403
        </h1>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
          Access Denied
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          You don't have permission to access this resource.
          {user && (
            <span className="block mt-2">
              Your current role(s): {user.roles.join(", ")}
            </span>
          )}
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            onClick={() => router.push("/account-settings")}
          >
            Go to Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

