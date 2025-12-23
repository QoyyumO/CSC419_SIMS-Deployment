/**
 * Authentication Functions
 * 
 * Handles user authentication including login, logout, and session management.
 * Uses password hashing with Web Crypto API (compatible with Convex environment).
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { NotFoundError, ValidationError } from "./lib/errors";
import {
  createSession,
  validateSessionToken,
  deleteSessionByToken,
  deleteAllUserSessions,
} from "./lib/session";

/**
 * Hash a password using Web Crypto API (PBKDF2)
 * This is compatible with Convex's server environment
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const key = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  // Return in format: $pbkdf2$iterations$salt$hash
  return `$pbkdf2$100000$${saltHex}$${hashHex}`;
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Parse the hash format: $pbkdf2$iterations$salt$hash
  const parts = hash.split("$");
  if (parts.length !== 5 || parts[1] !== "pbkdf2") {
    return false;
  }
  
  const iterations = parseInt(parts[2], 10);
  const saltHex = parts[3];
  const hashHex = parts[4];
  
  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  const key = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedHash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256",
    },
    key,
    256
  );
  
  const derivedHashArray = Array.from(new Uint8Array(derivedHash));
  const derivedHashHex = derivedHashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  return derivedHashHex === hashHex;
}

/**
 * Login with email and password
 * 
 * Authenticates a user and returns user information if credentials are valid.
 */
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new NotFoundError("User", args.email);
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      args.password,
      user.hashedPassword
    );

    if (!isValidPassword) {
      throw new ValidationError(
        "password",
        "Invalid email or password"
      );
    }

    // Create a new session for the authenticated user
    const token = await createSession(ctx.db, user._id);

    // Return user data (excluding password) with session token
    return {
      success: true,
      userId: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      token,
    };
  },
});

/**
 * Change password (with user ID)
 *
 * Requires userId, validates current password, and updates to new password.
 */
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    const isValid = await verifyPassword(args.currentPassword, user.hashedPassword);
    if (!isValid) {
      throw new ValidationError("currentPassword", "Current password is incorrect");
    }

    const hashedPassword = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, { hashedPassword });

    return { success: true };
  },
});

/**
 * Get current authenticated user
 * 
 * Returns the currently authenticated user based on the session token.
 * Validates the session token and returns user information if valid.
 */
export const getCurrentUser = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token
    if (!args.token) {
      return null;
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    
    if (!user) {
      return null;
    }

    // Return user data (excluding password)
    return {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
    };
  },
});

/**
 * Request password reset
 *
 * NOTE: Placeholder implementation. In production, generate a token
 * and send via email/SMS.
 */
export const requestPasswordReset = mutation({
  args: {
    username: v.string(), // Keep for backward compatibility, but it's actually email
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.username))
      .first();

    // Do not leak existence
    if (!user) {
      return { success: true, message: "If the account exists, reset instructions were sent." };
    }

    // Placeholder token — in production store and email it.
    const resetToken = "dev-reset-token";

    return {
      success: true,
      message: "If the account exists, reset instructions were sent.",
      resetToken, // for dev/testing
    };
  },
});

/**
 * Reset password with token
 *
 * NOTE: Placeholder implementation. Validates against dev token only.
 */
export const resetPassword = mutation({
  args: {
    username: v.string(), // Keep for backward compatibility, but it's actually email
    resetToken: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // For development only: accept the static token
    if (args.resetToken !== "dev-reset-token") {
      throw new ValidationError("resetToken", "Invalid or expired reset token");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.username))
      .first();

    if (!user) {
      throw new NotFoundError("User", args.username);
    }

    const hashedPassword = await hashPassword(args.newPassword);
    await ctx.db.patch(user._id, { hashedPassword });

    // Invalidate all existing sessions for security
    await deleteAllUserSessions(ctx.db, user._id);

    return { success: true };
  },
});

/**
 * Logout - invalidate session token
 * 
 * Deletes the session associated with the provided token.
 */
export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    await deleteSessionByToken(ctx.db, args.token);
    return { success: true };
  },
});

