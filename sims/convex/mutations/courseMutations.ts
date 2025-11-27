/**
 * Course Mutations
 * 
 * Transactional operations for course management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { validateCreateCourse, validateUpdateCourse, NotFoundError } from "../lib/aggregates";
import { logCourseCreated, logCourseUpdated } from "../lib/services/auditLogService";

/**
 * Create a new course
 */
export const createCourse = mutation({
  args: {
    code: v.string(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    prerequisites: v.array(v.id("courses")),
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

    // Create the course
    const courseId = await ctx.db.insert("courses", {
      code: args.code,
      title: args.title,
      description: args.description,
      credits: args.credits,
      prerequisites: args.prerequisites,
    });

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
    prerequisites: v.optional(v.array(v.id("courses"))),
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

    // Build update object with only provided fields
    const updates: {
      code?: string;
      title?: string;
      description?: string;
      credits?: number;
      prerequisites?: Id<"courses">[];
    } = {};

    if (args.code !== undefined) updates.code = args.code;
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.credits !== undefined) updates.credits = args.credits;
    if (args.prerequisites !== undefined) updates.prerequisites = args.prerequisites;

    // Update the course
    await ctx.db.patch(args.courseId, updates);

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
      }
    );

    return { success: true };
  },
});

