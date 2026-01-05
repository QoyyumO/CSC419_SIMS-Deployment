/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Manages user session, login, logout, and authentication status.
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { UserRole } from "../../convex/lib/aggregates/types";

export interface User {
  _id: Id<"users">;
  email: string;
  roles: UserRole[];
  profile: {
    firstName: string;
    middleName?: string;
    lastName: string;
  };
}

interface AuthContextType {
  // Authentication state
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  
  // Authentication methods
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  
  // Role checking
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasAllRoles: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialize with null to ensure server and client render the same initially
  // We'll read from localStorage after mount to prevent hydration mismatch
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Read from localStorage after mount to prevent hydration mismatch
  // This is necessary to sync with external system (localStorage) and prevent hydration errors
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("sims_session_token");
      setStoredToken(token);
      setIsInitialized(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Query current user with stored session token
  const currentUser = useQuery(
    api.functions.auth.getCurrentUser,
    storedToken ? { token: storedToken } : "skip"
  );

  // Mutations
  const loginMutation = useMutation(api.functions.auth.login);
  const logoutMutation = useMutation(api.functions.auth.logout);

  // Derive authentication state directly from query result
  const { isAuthenticated, user } = useMemo(() => {
    if (storedToken === null) {
      return { isAuthenticated: false, user: null as User | null };
    }
    if (currentUser === undefined) {
      // Still loading
      return { isAuthenticated: false, user: null as User | null };
    }
    if (currentUser === null) {
      // Not authenticated - token invalid or expired
      return { isAuthenticated: false, user: null as User | null };
    }
    // Authenticated
    return {
      isAuthenticated: true,
      user: {
        ...currentUser,
        roles: currentUser.roles as UserRole[],
      } as User,
    };
  }, [currentUser, storedToken]);

  // Track if token should be cleared (when currentUser becomes null)
  const shouldClearToken = storedToken !== null && currentUser === null;
  
  // Clear localStorage and token state when token becomes invalid
  // This is a legitimate case of syncing with external system (query result)
  // We need to clear the token when the query indicates it's invalid
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (shouldClearToken) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("sims_session_token");
      }
      setStoredToken(null);
    }
  }, [shouldClearToken]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Login function
  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      const result = await loginMutation({ email, password });
      
      if (result.success && result.token) {
        // Store session token for session management
        if (typeof window !== "undefined") {
          localStorage.setItem("sims_session_token", result.token);
        }
        setStoredToken(result.token);
        
        // State will be updated automatically via the query
        if (result.userId && result.email) {
          const userObj: User = {
            _id: result.userId,
            email: result.email,
            roles: (result.roles ?? []) as UserRole[],
            profile: result.profile ?? { firstName: "", lastName: "" },
          };
          return { success: true, user: userObj };
        }

        // Fallback
        return { success: true };
      }
      
      return { success: false, error: "Login failed" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during login";
      return { success: false, error: errorMessage };
    }
  }, [loginMutation]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Invalidate session on server if we have a token
      if (storedToken) {
        try {
          await logoutMutation({ token: storedToken });
        } catch (error) {
          // Log but don't fail logout if server call fails
          console.error("Error invalidating session on server:", error);
        }
      }
      
      // Clear session from client
      if (typeof window !== "undefined") {
        localStorage.removeItem("sims_session_token");
      }
      setStoredToken(null);
      // State will be updated automatically via the query
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [storedToken, logoutMutation]);

  // Role checking functions
  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const hasAnyRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.some(role => user.roles.includes(role));
  }, [user]);

  const hasAllRoles = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.every(role => user.roles.includes(role));
  }, [user]);

  // Consider ourselves loading if:
  // 1. Not yet initialized (haven't read from localStorage)
  // 2. Have a token but query is still loading
  const isLoading = !isInitialized || (storedToken !== null && currentUser === undefined);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    hasRole,
    hasAnyRole,
    hasAllRoles,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

