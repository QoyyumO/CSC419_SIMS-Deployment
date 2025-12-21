/**
 * User Service
 * 
 * Service functions for user-related operations.
 */

import { User } from '@/context/AuthContext';

/**
 * Get the current authenticated user
 * 
 * Note: This function expects the user to be passed in from a component
 * that has access to the auth context via useAuth hook.
 * 
 * @param user - The user from useAuth hook
 * @returns The current user or null if not authenticated
 */
export function getUser(user: User | null): User | null {
  return user;
}

