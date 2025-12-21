/**
 * RoleGuard Component
 *
 * Wrapper component that protects routes based on user roles.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useHasRole, useHasAnyRole, useHasAllRoles } from "../../hooks/useHasRole";
import { UserRole } from "../../../convex/lib/aggregates/types";
import Loading from "../loading/Loading";

interface RoleGuardProps {
  children: React.ReactNode;
  role?: UserRole;
  roles?: UserRole[];
  requireAll?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
  unauthorizedMessage?: string;
}

export function RoleGuard({
  children,
  role,
  roles,
  requireAll = false,
  redirectTo = "/unauthorized",
  fallback,
  unauthorizedMessage,
}: RoleGuardProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const hasSingleRole = role ? useHasRole(role) : false;
  const hasMultipleRoles = roles
    ? requireAll
      ? useHasAllRoles(roles)
      : useHasAnyRole(roles)
    : false;

  const hasAccess = hasSingleRole || hasMultipleRoles;

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasAccess) {
      if (unauthorizedMessage) return;
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, hasAccess, router, redirectTo, unauthorizedMessage]);

  if (isLoading) {
    return fallback ?? <Loading />;
  }

  if (!isAuthenticated || !hasAccess) {
    if (unauthorizedMessage) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4 dark:text-red-400">
              Access Denied
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{unauthorizedMessage}</p>
          </div>
        </div>
      );
    }
    return null;
  }

  return <>{children}</>;
}

