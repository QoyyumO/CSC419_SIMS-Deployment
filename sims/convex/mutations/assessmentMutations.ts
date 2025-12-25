/**
 * Assessment Mutations
 * 
 * Transactional operations for assessment management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError, InvariantViolationError } from "../lib/errors";
import { validateAssessmentWeight } from "../lib/aggregates";
import { logAssessmentCreated, logAssessmentUpdated, logAssessmentDeleted } from "../lib/services/auditLogService";
import { validateSessionToken } from "../lib/session";

/**
 * Create a new assessment
 */
export const createAssessment = mutation({
  args: {
    sectionId: v.id("sections"),
    title: v.string(),
    weight: v.number(),
    totalPoints: v.number(),
    dueDate: v.number(), // Unix timestamp
    token: v.optional(v.string()), // Session token for authentication
  },
  handler: async (ctx, args) => {
    // Authenticate user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    // Validate section exists
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Validate assessment weight won't exceed 100%
    await validateAssessmentWeight(
      ctx.db,
      args.sectionId,
      args.weight
    );

    // Validate weight is between 0 and 100
    if (args.weight < 0 || args.weight > 100) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "Weight Validation",
        "Assessment weight must be between 0 and 100"
      );
    }

    // Validate totalPoints is positive
    if (args.totalPoints <= 0) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "TotalPoints Validation",
        "Total points must be greater than 0"
      );
    }

    // Create the assessment
    const assessmentId = await ctx.db.insert("assessments", {
      sectionId: args.sectionId,
      title: args.title,
      weight: args.weight,
      totalPoints: args.totalPoints,
      dueDate: args.dueDate,
    });

    // Create audit log
    await logAssessmentCreated(
      ctx.db,
      userId,
      assessmentId,
      {
        sectionId: args.sectionId,
        title: args.title,
        weight: args.weight,
        totalPoints: args.totalPoints,
        dueDate: args.dueDate,
      }
    );

    return { success: true, assessmentId };
  },
});

/**
 * Update an existing assessment
 */
export const updateAssessment = mutation({
  args: {
    assessmentId: v.id("assessments"),
    title: v.optional(v.string()),
    weight: v.optional(v.number()),
    totalPoints: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    token: v.optional(v.string()), // Session token for authentication
  },
  handler: async (ctx, args) => {
    // Authenticate user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }
    // Get current assessment to capture previous values
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      throw new NotFoundError("Assessment", args.assessmentId);
    }

    // If weight is being updated, validate it won't exceed 100%
    if (args.weight !== undefined) {
      await validateAssessmentWeight(
        ctx.db,
        assessment.sectionId,
        args.weight,
        args.assessmentId
      );

      if (args.weight < 0 || args.weight > 100) {
        throw new InvariantViolationError(
          "AssessmentMutation",
          "Weight Validation",
          "Assessment weight must be between 0 and 100"
        );
      }
    }

    // Validate totalPoints if being updated
    if (args.totalPoints !== undefined && args.totalPoints <= 0) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "TotalPoints Validation",
        "Total points must be greater than 0"
      );
    }

    // Build update object with only provided fields
    const updates: {
      title?: string;
      weight?: number;
      totalPoints?: number;
      dueDate?: number;
    } = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.totalPoints !== undefined) updates.totalPoints = args.totalPoints;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;

    // Update the assessment
    await ctx.db.patch(args.assessmentId, updates);

    // Create audit log
    await logAssessmentUpdated(
      ctx.db,
      userId,
      args.assessmentId,
      {
        sectionId: assessment.sectionId,
        previousTitle: assessment.title,
        newTitle: args.title ?? assessment.title,
        previousWeight: assessment.weight,
        newWeight: args.weight ?? assessment.weight,
        previousTotalPoints: assessment.totalPoints,
        newTotalPoints: args.totalPoints ?? assessment.totalPoints,
        previousDueDate: assessment.dueDate,
        newDueDate: args.dueDate ?? assessment.dueDate,
      }
    );

    return { success: true };
  },
});

/**
 * Delete an assessment
 */
export const deleteAssessment = mutation({
  args: {
    assessmentId: v.id("assessments"),
    token: v.optional(v.string()), // Session token for authentication
  },
  handler: async (ctx, args) => {
    // Authenticate user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    // Get assessment to capture details before deletion
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      throw new NotFoundError("Assessment", args.assessmentId);
    }

    // Check if there are any grades for this assessment
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_assessmentId", (q) => q.eq("assessmentId", args.assessmentId))
      .collect();

    if (grades.length > 0) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "Delete Validation",
        `Cannot delete assessment: ${grades.length} grade(s) have been recorded for this assessment`
      );
    }

    // Create audit log before deletion
    await logAssessmentDeleted(
      ctx.db,
      userId,
      args.assessmentId,
      {
        sectionId: assessment.sectionId,
        title: assessment.title,
        weight: assessment.weight,
        totalPoints: assessment.totalPoints,
        dueDate: assessment.dueDate,
      }
    );

    // Delete the assessment
    await ctx.db.delete(args.assessmentId);

    return { success: true };
  },
});

