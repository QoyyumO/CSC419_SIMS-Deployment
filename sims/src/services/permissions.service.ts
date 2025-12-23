import { UserRole } from "../../convex/lib/aggregates/types";

/**
 * Check if user has student role
 * Equivalent to "isCandidate" in other systems
 */
export function isStudent(roles: UserRole[]): boolean {
  return roles.includes("student");
}

/**
 * Check if user has admin role
 */
export function isAdmin(roles: UserRole[]): boolean {
  return roles.includes("admin");
}

/**
 * Check if user has instructor role
 */
export function isInstructor(roles: UserRole[]): boolean {
  return roles.includes("instructor");
}

