/**
 * useHasRole Hook
 *
 * Provides role-based access control checks.
 * Includes hooks for checking single roles, multiple roles, and permissions.
 */

import { useAuth } from "./useAuth";
import { UserRole } from "../../convex/lib/aggregates/types";

/**
 * Check if the current user has a specific role
 */
export function useHasRole(role: UserRole): boolean {
  const { hasRole } = useAuth();
  return hasRole(role);
}

/**
 * Check if the current user has any of the specified roles
 */
export function useHasAnyRole(roles: UserRole[]): boolean {
  const { hasAnyRole } = useAuth();
  return hasAnyRole(roles);
}

/**
 * Check if the current user has all of the specified roles
 */
export function useHasAllRoles(roles: UserRole[]): boolean {
  const { hasAllRoles } = useAuth();
  return hasAllRoles(roles);
}

/**
 * Hook for checking permissions (alias for role checking)
 */
export function usePermissions(permission: UserRole): boolean {
  return useHasRole(permission);
}

