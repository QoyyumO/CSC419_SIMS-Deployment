/**
 * useAuth Hook
 * 
 * Main authentication hook that provides access to authentication state and methods.
 * This is a convenience wrapper around the AuthContext.
 */

import { useAuth as useAuthContext } from "../context/AuthContext";

/**
 * Main authentication hook
 * 
 * Provides:
 * - Authentication state (isAuthenticated, isLoading, user)
 * - Authentication methods (login, logout, register)
 * - Role checking methods (hasRole, hasAnyRole, hasAllRoles)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAuthenticated, user, login, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <LoginForm onLogin={login} />;
 *   }
 *   
 *   return <div>Welcome, {user?.profile.firstName}!</div>;
 * }
 * ```
 */
export function useAuth() {
  return useAuthContext();
}

