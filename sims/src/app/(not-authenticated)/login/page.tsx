"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "./_components/LoginForm";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import Loading from "@/components/loading/Loading";
import { getDefaultRoute } from "@/utils/getDefaultRoute";

export default function LoginPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const defaultRoute = getDefaultRoute(user.roles);
      router.push(defaultRoute);
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <AuthPageLayout
      title="SIMS Portal"
      description="Student Information Management System"
      subtitle="Sign in to your account"
      footer={
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <a
            href="/register"
            className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Contact your administrator
          </a>
        </p>
      }
    >
      <LoginForm />
    </AuthPageLayout>
  );
}
