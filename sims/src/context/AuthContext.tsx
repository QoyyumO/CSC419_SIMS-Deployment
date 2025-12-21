/**
 * Authentication Context
 * 
 * Provides authentication state and methods throughout the application.
 * Manages user session, login, logout, and authentication status.
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  register: (data: {
    email: string;
    password: string;
    roles: string[];
    profile: {
      firstName: string;
      middleName?: string;
      lastName: string;
    };
  }) => Promise<{ success: boolean; error?: string }>;
  
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);

  // Get stored session token from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("sims_session_token");
      if (token) {
        setStoredToken(token);
      }
    }
  }, []);

  // Query current user with stored session token
  const currentUser = useQuery(
    api.auth.getCurrentUser,
    storedToken ? { token: storedToken } : "skip"
  );
  
  // If there is no stored token, we know the user is unauthenticated.
  // Ensure state reflects that (avoid staying stuck in loading).
  useEffect(() => {
    if (storedToken === null) {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [storedToken]);

  // Mutations
  const loginMutation = useMutation(api.auth.login);
  const registerMutation = useMutation(api.auth.register);
  const logoutMutation = useMutation(api.auth.logout);

  // Update authentication state when user data changes
  useEffect(() => {
    if (currentUser === undefined) {
      // Still loading
      return;
    }

    if (currentUser === null) {
      // Not authenticated - token invalid or expired
      setIsAuthenticated(false);
      setUser(null);
      // Clear any stored session
      if (typeof window !== "undefined") {
        localStorage.removeItem("sims_session_token");
      }
      setStoredToken(null);
    } else {
      // Authenticated
      setIsAuthenticated(true);
      setUser({
        ...currentUser,
        roles: currentUser.roles as UserRole[],
      });
    }
  }, [currentUser]);

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
        
        // Update auth state immediately with returned user to avoid waiting for the follow-up query
        if (result.userId && result.email) {
          const userObj: User = {
            _id: result.userId,
            email: result.email,
            roles: (result.roles ?? []) as UserRole[],
            profile: result.profile ?? { firstName: "", lastName: "" },
          };
          setIsAuthenticated(true);
          setUser(userObj);
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
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [storedToken, logoutMutation]);

  // Register function
  const register = useCallback(async (data: {
    email: string;
    password: string;
    roles: string[];
    profile: {
      firstName: string;
      middleName?: string;
      lastName: string;
    };
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await registerMutation(data);
      
      if (result.success && result.token) {
        // Store session token from registration
        if (typeof window !== "undefined") {
          localStorage.setItem("sims_session_token", result.token);
        }
        setStoredToken(result.token);
        
        // Update auth state immediately with returned user
        if (result.userId && result.email) {
          const userObj: User = {
            _id: result.userId,
            email: result.email,
            roles: (result.roles ?? []) as UserRole[],
            profile: result.profile ?? { firstName: "", lastName: "" },
          };
          setIsAuthenticated(true);
          setUser(userObj);
        }
        
        return { success: true };
      }
      
      return { success: false, error: "Registration failed" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred during registration";
      return { success: false, error: errorMessage };
    }
  }, [registerMutation]);

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

  // Consider ourselves not loading if we didn't query (no stored token).
  const isLoading = storedToken === null ? false : currentUser === undefined;

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    register,
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

