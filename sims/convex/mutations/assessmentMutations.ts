/**
 * Assessment Mutations
 * 
 * Transactional operations for assessment management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError, InvariantViolationError } from "../lib/errors";
import { validateAssessmentWeight } from "../lib/aggregates";
import { logAssessmentCreated, logAssessmentUpdated } from "../lib/services/auditLogService";

/**
 * Create a new assessment
 */
export const createAssessment = mutation({
  args: {
    sectionId: v.id("sections"),
    title: v.string(),
    weight: v.number(),
    maxScore: v.number(),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
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

    // Validate maxScore is positive
    if (args.maxScore <= 0) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "MaxScore Validation",
        "Max score must be greater than 0"
      );
    }

    // Create the assessment
    const assessmentId = await ctx.db.insert("assessments", {
      sectionId: args.sectionId,
      title: args.title,
      weight: args.weight,
      maxScore: args.maxScore,
    });

    // Create audit log
    await logAssessmentCreated(
      ctx.db,
      args.createdByUserId,
      assessmentId,
      {
        sectionId: args.sectionId,
        title: args.title,
        weight: args.weight,
        maxScore: args.maxScore,
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
    maxScore: v.optional(v.number()),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
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

    // Validate maxScore if being updated
    if (args.maxScore !== undefined && args.maxScore <= 0) {
      throw new InvariantViolationError(
        "AssessmentMutation",
        "MaxScore Validation",
        "Max score must be greater than 0"
      );
    }

    // Build update object with only provided fields
    const updates: {
      title?: string;
      weight?: number;
      maxScore?: number;
    } = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.weight !== undefined) updates.weight = args.weight;
    if (args.maxScore !== undefined) updates.maxScore = args.maxScore;

    // Update the assessment
    await ctx.db.patch(args.assessmentId, updates);

    // Create audit log
    await logAssessmentUpdated(
      ctx.db,
      args.updatedByUserId,
      args.assessmentId,
      {
        sectionId: assessment.sectionId,
        previousTitle: assessment.title,
        newTitle: args.title ?? assessment.title,
        previousWeight: assessment.weight,
        newWeight: args.weight ?? assessment.weight,
        previousMaxScore: assessment.maxScore,
        newMaxScore: args.maxScore ?? assessment.maxScore,
      }
    );

    return { success: true };
  },
});

