/**
 * ProtectedRoute Component
 *
 * Wrapper component that protects routes requiring authentication.
 * Redirects to login page if user is not authenticated.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import Loading from "../loading/Loading";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  redirectTo = "/login",
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  // If authenticated, show content even if still loading user details
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return fallback ?? <Loading />;
  }

  // Not authenticated and not loading - will redirect via useEffect
  return null;
}

