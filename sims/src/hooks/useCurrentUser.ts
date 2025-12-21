/**
 * useCurrentUser Hook
 * 
 * Provides access to the current authenticated user's data.
 * Returns null if the user is not authenticated.
 */

import { useAuth } from "./useAuth";
import { User } from "../context/AuthContext";

/**
 * Hook to get the current authenticated user
 * 
 * @returns The current user object or null if not authenticated
 * 
 * @example
 * ```tsx
 * function UserProfile() {
 *   const user = useCurrentUser();
 *   
 *   if (!user) {
 *     return <div>Please log in</div>;
 *   }
 *   
 *   return (
 *     <div>
 *       <h1>{user.profile.firstName} {user.profile.lastName}</h1>
 *       <p>Email: {user.email}</p>
 *       <p>Roles: {user.roles.join(", ")}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCurrentUser(): User | null {
  const { user } = useAuth();
  return user;
}

