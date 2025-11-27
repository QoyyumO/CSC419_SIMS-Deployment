/**
 * User Mutations
 * 
 * Transactional operations for user management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError } from "../lib/errors";
import { validateUpdateUser } from "../lib/aggregates";
import { logUserRoleChanged } from "../lib/services/auditLogService";
import { UserRole } from "../lib/aggregates/types";

/**
 * Change user roles
 * 
 * This operation:
 * 1. Validates user exists
 * 2. Validates new roles
 * 3. Updates user roles
 * 4. Creates audit log
 */
export const changeUserRoles = mutation({
  args: {
    targetUserId: v.id("users"),
    newRoles: v.array(v.string()),
    changedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.targetUserId);
    if (!user) {
      throw new NotFoundError("User", args.targetUserId);
    }

    const previousRoles = [...user.roles];

    // Validate and update user roles
    await validateUpdateUser(
      ctx.db,
      args.targetUserId,
      undefined, // username
      undefined, // hashedPassword
      args.newRoles,
      undefined // profile
    );

    // Update user roles
    await ctx.db.patch(args.targetUserId, {
      roles: args.newRoles as UserRole[],
    });

    // Create audit log
    await logUserRoleChanged(
      ctx.db,
      args.changedByUserId,
      args.targetUserId,
      previousRoles,
      args.newRoles
    );

    return {
      success: true,
      previousRoles,
      newRoles: args.newRoles,
    };
  },
});

