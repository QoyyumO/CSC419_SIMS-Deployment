/**
 * Grade Mutations
 * 
 * Transactional operations for recording grades.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../lib/errors";
import { createAuditLog, logCourseGradePosted, logGradeEdited } from "../lib/services/auditLogService";
import { GradeValue } from "../lib/aggregates/types";

/**
 * Converts a numeric score to a letter grade and points
 */
function calculateGradeValue(score: number, maxScore: number): GradeValue {
  const percentage = (score / maxScore) * 100;

  let letter: string;
  let points: number;

  if (percentage >= 90) {
    letter = "A";
    points = 4.0;
  } else if (percentage >= 80) {
    letter = "B";
    points = 3.0;
  } else if (percentage >= 70) {
    letter = "C";
    points = 2.0;
  } else if (percentage >= 60) {
    letter = "D";
    points = 1.0;
  } else {
    letter = "F";
    points = 0.0;
  }

  return {
    numeric: percentage,
    letter,
    points,
  };
}

/**
 * Operation: Record a Grade for an Assessment
 * 
 * This is a transactional operation that:
 * 1. Reads enrollment and section
 * 2. Reads assessment and validates score
 * 3. Creates or updates grade document
 * 4. Creates audit log
 * 
 * All steps are atomic - if any step fails, the entire transaction is rolled back.
 */
export const recordGrade = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    assessmentId: v.id("assessments"),
    score: v.number(),
    recordedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Step 1: Read enrollment and its section
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new NotFoundError("Enrollment", args.enrollmentId);
    }

    const section = await ctx.db.get(enrollment.sectionId);
    if (!section) {
      throw new NotFoundError("Section", enrollment.sectionId);
    }

    // Step 2: Read assessment and validate score
    // Invariant Check: score must be ≤ assessment.maxScore
    const assessment = await ctx.db.get(args.assessmentId);
    if (!assessment) {
      throw new NotFoundError("Assessment", args.assessmentId);
    }

    if (assessment.sectionId !== section._id) {
      throw new InvariantViolationError(
        "GradeMutation",
        "Assessment Section Match",
        "Assessment does not belong to the enrollment's section"
      );
    }

    if (args.score < 0) {
      throw new InvariantViolationError(
        "GradeMutation",
        "Score Validation",
        "Score cannot be negative"
      );
    }

    if (args.score > assessment.maxScore) {
      throw new InvariantViolationError(
        "GradeMutation",
        "Score Validation",
        `Score (${args.score}) exceeds maximum score (${assessment.maxScore})`
      );
    }

    // Calculate grade value
    const gradeValue = calculateGradeValue(args.score, assessment.maxScore);

    // Step 3: Create or update grade document
    // Check if grade already exists
    const existingGrades = await ctx.db
      .query("grades")
      .withIndex("by_enrollmentId_assessmentId", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("assessmentId", args.assessmentId)
      )
      .collect();

    let gradeId: Id<"grades">;

    if (existingGrades.length > 0) {
      // Update existing grade
      const existingGrade = existingGrades[0];
      await ctx.db.patch(existingGrade._id, {
        grade: gradeValue,
        recordedBy: args.recordedByUserId,
      });
      gradeId = existingGrade._id;
    } else {
      // Create new grade
      gradeId = await ctx.db.insert("grades", {
        enrollmentId: args.enrollmentId,
        assessmentId: args.assessmentId,
        grade: gradeValue,
        recordedBy: args.recordedByUserId,
      });
    }

    // Step 4: Create audit log entry
    if (existingGrades.length > 0) {
      // Grade was edited
      const previousGrade = existingGrades[0].grade.letter;
      await logGradeEdited(
        ctx.db,
        args.recordedByUserId,
        gradeId,
        previousGrade,
        gradeValue.letter,
        {
          enrollmentId: args.enrollmentId,
          assessmentId: args.assessmentId,
          score: args.score,
          maxScore: assessment.maxScore,
          previousScore: existingGrades[0].grade.numeric,
          newScore: gradeValue.numeric,
        }
      );
    } else {
      // New grade posted
      await logCourseGradePosted(
        ctx.db,
        args.recordedByUserId,
        gradeId,
        {
          enrollmentId: args.enrollmentId,
          assessmentId: args.assessmentId,
          score: args.score,
          maxScore: assessment.maxScore,
          gradeValue,
          studentId: enrollment.studentId,
          sectionId: section._id,
        }
      );
    }

    return {
      success: true,
      gradeId,
      gradeValue,
    };
  },
});

/**
 * Record final grade for an enrollment
 * 
 * This marks the enrollment as completed and calculates final grade
 * based on all assessments.
 */
export const recordFinalGrade = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    recordedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new NotFoundError("Enrollment", args.enrollmentId);
    }

    const section = await ctx.db.get(enrollment.sectionId);
    if (!section) {
      throw new NotFoundError("Section", enrollment.sectionId);
    }

    // Get all assessments for the section
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
      .collect();

    // Get all grades for this enrollment
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", args.enrollmentId))
      .collect();

    // Calculate weighted final grade
    let totalWeightedPoints = 0;
    let totalWeight = 0;

    for (const assessment of assessments) {
      const grade = grades.find((g) => g.assessmentId === assessment._id);
      if (!grade) {
        throw new InvariantViolationError(
          "GradeMutation",
          "Final Grade Calculation",
          `Missing grade for assessment: ${assessment.title}`
        );
      }

      const assessmentPercentage = (grade.grade.numeric / 100) * assessment.weight;
      totalWeightedPoints += assessmentPercentage;
      totalWeight += assessment.weight;
    }

    // Verify weights sum to 100%
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new InvariantViolationError(
        "GradeMutation",
        "Final Grade Calculation",
        `Assessment weights sum to ${totalWeight}%, expected 100%`
      );
    }

    const finalPercentage = totalWeightedPoints;
    const finalGradeValue = calculateGradeValue(finalPercentage, 100);

    // Update enrollment status to completed
    await ctx.db.patch(args.enrollmentId, {
      status: "completed",
    });

    // Create audit log
    await createAuditLog(
      ctx.db,
      "enrollment",
      "FinalGradeRecorded",
      args.recordedByUserId,
      args.enrollmentId,
      {
        finalGrade: finalGradeValue,
        finalPercentage,
      }
    );

    return {
      success: true,
      finalGrade: finalGradeValue,
      finalPercentage,
    };
  },
});

