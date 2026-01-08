/**
 * Course Mutations
 * 
 * Transactional operations for course management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { validateCreateCourse, validateUpdateCourse, NotFoundError, validateCourseStatus, isRequiredCourse } from "../lib/aggregates";
import { logCourseCreated, logCourseUpdated } from "../lib/services/auditLogService";
import { courseCatalogService } from "../lib/services";
import { validateSessionToken } from "../lib/session";
import { ValidationError } from "../lib/errors";

/**
 * Create a new course
 */
export const createCourse = mutation({
  args: {
    code: v.string(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    prerequisites: v.array(v.string()), // Course codes instead of IDs
    departmentId: v.id("departments"),
    programIds: v.optional(v.array(v.id("programs"))), // Array of program IDs
    status: v.optional(v.string()), // Course status: "C" (Core/Required), "R" (Required), "E" (Elective)
    level: v.string(),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateCourse(
      ctx.db,
      args.code,
      args.credits,
      args.prerequisites
    );

    // Validate status if provided
    const courseStatus = args.status || "E";
    if (!validateCourseStatus(courseStatus)) {
      throw new Error(`Invalid course status: ${courseStatus}. Must be 'C', 'R', or 'E'`);
    }

    // Validate program IDs if provided
    if (args.programIds) {
      for (const programId of args.programIds) {
        const program = await ctx.db.get(programId);
        if (!program) {
          throw new NotFoundError("Program", programId);
        }
      }
    }

    // Create the course
    const courseId = await ctx.db.insert("courses", {
      code: args.code,
      title: args.title,
      description: args.description,
      credits: args.credits,
      prerequisites: args.prerequisites,
      departmentId: args.departmentId,
      programIds: args.programIds || [],
      status: courseStatus,
      level: args.level,
    });

    // Validate prerequisite chains for the newly created course
    const createValidation = await courseCatalogService.validatePrerequisiteChain(ctx.db, courseId);
    if (!createValidation.valid) {
      // Roll back the created course if validation fails
      await ctx.db.delete(courseId);
      if (createValidation.cycle) {
        throw new Error(`Circular prerequisite detected: ${createValidation.cycle.join(" -> ")}`);
      }
      throw new Error(createValidation.reason || "Invalid prerequisite chain");
    }

    // If course has status 'C' or 'R' and is associated with programs, add it to their requiredCourses
    if (isRequiredCourse(courseStatus) && args.programIds && args.programIds.length > 0) {
      for (const programId of args.programIds) {
        const program = await ctx.db.get(programId);
        if (program && !program.requiredCourses.includes(courseId)) {
          await ctx.db.patch(programId, {
            requiredCourses: [...program.requiredCourses, courseId],
          });
        }
      }
    }

    // Create audit log
    await logCourseCreated(
      ctx.db,
      args.createdByUserId,
      courseId,
      {
        code: args.code,
        title: args.title,
        credits: args.credits,
        prerequisitesCount: args.prerequisites.length,
        programIdsCount: args.programIds?.length || 0,
      }
    );

    return { success: true, courseId };
  },
});

/**
 * Update an existing course
 */
export const updateCourse = mutation({
  args: {
    courseId: v.id("courses"),
    code: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    credits: v.optional(v.number()),
    prerequisites: v.optional(v.array(v.string())), // Course codes instead of IDs
    departmentId: v.optional(v.id("departments")),
    programIds: v.optional(v.array(v.id("programs"))), // Array of program IDs
    status: v.optional(v.string()), // Course status: "C" (Core/Required), "R" (Required), "E" (Elective)
    level: v.optional(v.string()),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get current course to capture previous values
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new NotFoundError("Course", args.courseId);
    }

    // Validate all invariants before updating
    await validateUpdateCourse(
      ctx.db,
      args.courseId,
      args.code,
      args.credits,
      args.prerequisites
    );

    // Validate status if provided
    if (args.status !== undefined && !validateCourseStatus(args.status)) {
      throw new Error(`Invalid course status: ${args.status}. Must be 'C', 'R', or 'E'`);
    }

    // Validate program IDs if provided
    if (args.programIds) {
      for (const programId of args.programIds) {
        const program = await ctx.db.get(programId);
        if (!program) {
          throw new NotFoundError("Program", programId);
        }
      }
    }

    // Build update object with only provided fields
    const updates: {
      code?: string;
      title?: string;
      description?: string;
      credits?: number;
      prerequisites?: string[];
      departmentId?: Id<"departments">;
      programIds?: Id<"programs">[];
      status?: string;
      level?: string;
    } = {};

    if (args.code !== undefined) updates.code = args.code;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.credits !== undefined) updates.credits = args.credits;
    if (args.prerequisites !== undefined) updates.prerequisites = args.prerequisites;
    if (args.departmentId !== undefined) updates.departmentId = args.departmentId;
    if (args.programIds !== undefined) updates.programIds = args.programIds;
    if (args.status !== undefined) updates.status = args.status;
    if (args.level !== undefined) updates.level = args.level;

    // Get the final status (new status or current status)
    const finalStatus = args.status ?? course.status;
    const finalProgramIds = args.programIds ?? course.programIds ?? [];

    // Update the course
    await ctx.db.patch(args.courseId, updates);

    // If prerequisites were updated, validate the new chain and revert if invalid
    if (args.prerequisites !== undefined) {
      const validation = await courseCatalogService.validatePrerequisiteChain(ctx.db, args.courseId);
      if (!validation.valid) {
        // Revert prerequisites to previous value
        await ctx.db.patch(args.courseId, { prerequisites: course.prerequisites });
        if (validation.cycle) {
          throw new Error(`Circular prerequisite detected: ${validation.cycle.join(" -> ")}`);
        }
        throw new Error(validation.reason || "Invalid prerequisite chain");
      }
    }

    // Sync course with program requiredCourses based on status
    // If status is 'C' or 'R', add to requiredCourses; if 'E', remove from requiredCourses
    const isRequired = isRequiredCourse(finalStatus);
    
    // Handle all programs the course is associated with
    for (const programId of finalProgramIds) {
      const program = await ctx.db.get(programId);
      if (!program) continue;

      const currentRequiredCourses = program.requiredCourses;
      const isInRequired = currentRequiredCourses.includes(args.courseId);

      if (isRequired && !isInRequired) {
        // Add to requiredCourses if status is C or R and not already in list
        await ctx.db.patch(programId, {
          requiredCourses: [...currentRequiredCourses, args.courseId],
        });
      } else if (!isRequired && isInRequired) {
        // Remove from requiredCourses if status is E and currently in list
        await ctx.db.patch(programId, {
          requiredCourses: currentRequiredCourses.filter((id) => id !== args.courseId),
        });
      }
    }

    // If programIds changed, handle removed programs
    if (args.programIds !== undefined) {
      const previousProgramIds = course.programIds ?? [];
      const removedProgramIds = previousProgramIds.filter((id) => !finalProgramIds.includes(id));

      for (const programId of removedProgramIds) {
        const program = await ctx.db.get(programId);
        if (!program) continue;

        // Remove course from requiredCourses if it was there
        const currentRequiredCourses = program.requiredCourses;
        if (currentRequiredCourses.includes(args.courseId)) {
          await ctx.db.patch(programId, {
            requiredCourses: currentRequiredCourses.filter((id) => id !== args.courseId),
          });
        }
      }
    }

    // Create audit log
    await logCourseUpdated(
      ctx.db,
      args.updatedByUserId,
      args.courseId,
      {
        previousCode: course.code,
        newCode: args.code ?? course.code,
        previousTitle: course.title,
        newTitle: args.title ?? course.title,
        previousCredits: course.credits,
        newCredits: args.credits ?? course.credits,
        previousPrerequisitesCount: course.prerequisites.length,
        newPrerequisitesCount: args.prerequisites?.length ?? course.prerequisites.length,
        previousProgramIdsCount: course.programIds?.length ?? 0,
        newProgramIdsCount: args.programIds?.length ?? course.programIds?.length ?? 0,
      }
    );

    return { success: true };
  },
});

/**
 * Create a new course version
 * Restricted to department heads for courses in their department
 */
export const createCourseVersion = mutation({
  args: {
    token: v.optional(v.string()),
    courseId: v.id("courses"),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    prerequisites: v.array(v.string()), // Course codes instead of IDs
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Validate that courseId belongs to this department
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new NotFoundError("Course", args.courseId);
    }

    if (course.departmentId !== department._id) {
      throw new ValidationError(
        "courseId",
        "Course does not belong to your department"
      );
    }

    // Validate prerequisites don't create circular dependencies
    // First, create a temporary course version payload to validate
    const tempPayload = {
      version: 0, // Will be set by service
      title: args.title,
      description: args.description,
      credits: args.credits,
      prerequisites: args.prerequisites,
      isActive: true,
    };

    // Create the course version using the service
    const versionId = await courseCatalogService.createCourseVersion(
      ctx.db,
      args.courseId,
      tempPayload
    );

    // Validate prerequisite chain for the new version
    const validation = await courseCatalogService.validatePrerequisiteChain(
      ctx.db,
      args.courseId
    );
    
    if (!validation.valid) {
      // Roll back the created version if validation fails
      await ctx.db.delete(versionId);
      if (validation.cycle) {
        throw new Error(`Circular prerequisite detected: ${validation.cycle.join(" -> ")}`);
      }
      throw new Error(validation.reason || "Invalid prerequisite chain");
    }

    return { success: true, versionId };
  },
});
