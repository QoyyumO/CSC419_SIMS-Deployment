/**
 * User Management Functions
 *
 * Provides queries and mutations for user profile management,
 * user lookup, and role-based filtering.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { NotFoundError, ValidationError } from "./lib/errors";
import { validateUpdateUser } from "./lib/aggregates";
import { UserRole } from "./lib/aggregates/types";

/**
 * Get user by ID (without password)
 */
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    return {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
    };
  },
});

/**
 * Get user by email (without password)
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
    };
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    profile: v.object({
      firstName: v.optional(v.string()),
      middleName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    const updatedProfile = {
      ...user.profile,
      ...(args.profile.firstName !== undefined && { firstName: args.profile.firstName }),
      ...(args.profile.middleName !== undefined && { middleName: args.profile.middleName }),
      ...(args.profile.lastName !== undefined && { lastName: args.profile.lastName }),
    };

    await validateUpdateUser(
      ctx.db,
      args.userId,
      undefined, // email
      undefined, // hashedPassword
      undefined, // roles
      updatedProfile
    );

    await ctx.db.patch(args.userId, {
      profile: updatedProfile,
    });

    return {
      success: true,
      profile: updatedProfile,
    };
  },
});

/**
 * Get all users (admin use)
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
    }));
  },
});

/**
 * Check if email is available
 */
export const checkEmailAvailability = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return {
      available: !existing,
    };
  },
});

/**
 * Get users by role
 */
export const getUsersByRole = query({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();

    const usersWithRole = allUsers.filter((user) =>
      user.roles.includes(args.role as UserRole)
    );

    return usersWithRole.map((user) => ({
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
    }));
  },
});

