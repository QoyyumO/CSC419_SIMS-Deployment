/**
 * Program Mutations
 * 
 * Transactional operations for program management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateCreateProgram, validateUpdateProgram, NotFoundError } from "../lib/aggregates";
import { logProgramCreated, logProgramUpdated } from "../lib/services/auditLogService";

/**
 * Create a new program
 */
export const createProgram = mutation({
  args: {
    departmentId: v.id("departments"),
    code: v.string(),
    name: v.string(),
    requirements: v.any(),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateProgram(
      ctx.db,
      args.departmentId,
      args.code,
      args.requirements
    );

    // Create the program
    const programId = await ctx.db.insert("programs", {
      departmentId: args.departmentId,
      code: args.code,
      name: args.name,
      requirements: args.requirements,
    });

    // Create audit log
    await logProgramCreated(
      ctx.db,
      args.createdByUserId,
      programId,
      {
        departmentId: args.departmentId,
        code: args.code,
        name: args.name,
        requirements: args.requirements,
      }
    );

    return { success: true, programId };
  },
});

/**
 * Update an existing program
 */
export const updateProgram = mutation({
  args: {
    programId: v.id("programs"),
    departmentId: v.optional(v.id("departments")),
    code: v.optional(v.string()),
    name: v.optional(v.string()),
    requirements: v.optional(v.any()),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get current program to capture previous values
    const program = await ctx.db.get(args.programId);
    if (!program) {
      throw new NotFoundError("Program", args.programId);
    }

    // Validate all invariants before updating
    await validateUpdateProgram(
      ctx.db,
      args.programId,
      args.departmentId,
      args.code,
      args.requirements
    );

    // Build update object with only provided fields
    const updates: {
      departmentId?: typeof args.departmentId;
      code?: string;
      name?: string;
      requirements?: unknown;
    } = {};

    if (args.departmentId !== undefined) updates.departmentId = args.departmentId;
    if (args.code !== undefined) updates.code = args.code;
    if (args.name !== undefined) updates.name = args.name;
    if (args.requirements !== undefined) updates.requirements = args.requirements;

    // Update the program
    await ctx.db.patch(args.programId, updates);

    // Create audit log
    await logProgramUpdated(
      ctx.db,
      args.updatedByUserId,
      args.programId,
      {
        previousCode: program.code,
        newCode: args.code ?? program.code,
        previousName: program.name,
        newName: args.name ?? program.name,
        previousDepartmentId: program.departmentId,
        newDepartmentId: args.departmentId ?? program.departmentId,
        requirementsChanged: args.requirements !== undefined,
      }
    );

    return { success: true };
  },
});

