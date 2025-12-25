/**
 * Enrollment Mutations
 * 
 * Transactional operations for enrollment management including final grade posting.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "./lib/errors";
import { validateSessionToken } from "./lib/session";
import { GradeValue } from "./lib/aggregates/types";
import { addEnrollmentToTranscript } from "./lib/services/transcriptService";

/**
 * Converts percentage to letter grade and grade point using the new mapping:
 * 70-100: A (5.0)
 * 60-69.99: B (4.0)
 * 50-59.99: C (3.0)
 * 45-49.99: D (2.0)
 * 40-44.99: E (1.0)
 * 0-39.99: F (0.0)
 */
function convertPercentageToFinalGrade(percentage: number): GradeValue {
  let letter: string;
  let points: number;

  if (percentage >= 70) {
    letter = "A";
    points = 5.0;
  } else if (percentage >= 60) {
    letter = "B";
    points = 4.0;
  } else if (percentage >= 50) {
    letter = "C";
    points = 3.0;
  } else if (percentage >= 45) {
    letter = "D";
    points = 2.0;
  } else if (percentage >= 40) {
    letter = "E";
    points = 1.0;
  } else {
    letter = "F";
    points = 0.0;
  }

  return {
    numeric: Math.round(percentage * 100) / 100, // Round to 2 decimal places
    letter,
    points,
  };
}

/**
 * Post final grades for all students in a section
 * 
 * This mutation:
 * 1. Fetches all enrollments for the section
 * 2. For each enrollment, calculates weighted average from all grades
 * 3. Maps percentage to letter grade and grade point
 * 4. Updates enrollment with finalGrade and sets status to "completed"
 * 
 * Input: sectionId
 */
export const postFinalGrade = mutation({
  args: {
    sectionId: v.id("sections"),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify role is instructor
    if (!user.roles.includes("instructor")) {
      throw new Error("Access denied: Instructor role required");
    }

    // Get section and verify instructor owns it
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    if (section.instructorId !== userId) {
      throw new Error("Access denied: You can only post grades for your own sections");
    }

    // Get all enrollments for this section
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "enrolled"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    if (enrollments.length === 0) {
      throw new InvariantViolationError(
        "EnrollmentMutation",
        "Post Final Grade",
        "No enrollments found for this section"
      );
    }

    // Get all assessments for the section
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    if (assessments.length === 0) {
      throw new InvariantViolationError(
        "EnrollmentMutation",
        "Post Final Grade",
        "No assessments found for this section"
      );
    }

    // Verify weights sum to 100%
    const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new InvariantViolationError(
        "EnrollmentMutation",
        "Post Final Grade",
        `Assessment weights sum to ${totalWeight}%, expected 100%`
      );
    }

    const results: Array<{
      enrollmentId: Id<"enrollments">;
      studentId: Id<"students">;
      finalGrade: GradeValue;
      finalPercentage: number;
      success: boolean;
      error?: string;
    }> = [];

    // Process each enrollment
    for (const enrollment of enrollments) {
      try {
        // Get all grades for this enrollment
        const grades = await ctx.db
          .query("grades")
          .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollment._id))
          .collect();

        // Calculate weighted average: Sum(score / totalPoints * weight)
        let totalWeightedPoints = 0;
        const missingAssessments: string[] = [];

        for (const assessment of assessments) {
          const grade = grades.find((g) => g.assessmentId === assessment._id);
          if (!grade) {
            missingAssessments.push(assessment.title);
            continue;
          }

          // Calculate contribution: (score / totalPoints) * weight
          // grade.grade is already a percentage, so we use it directly
          const assessmentPercentage = (grade.grade / 100) * assessment.weight;
          totalWeightedPoints += assessmentPercentage;
        }

        if (missingAssessments.length > 0) {
          results.push({
            enrollmentId: enrollment._id,
            studentId: enrollment.studentId,
            finalGrade: { numeric: 0, letter: "F", points: 0.0 },
            finalPercentage: 0,
            success: false,
            error: `Missing grades for assessments: ${missingAssessments.join(", ")}`,
          });
          continue;
        }

        const finalPercentage = Math.round(totalWeightedPoints * 100) / 100;
        const finalGrade = convertPercentageToFinalGrade(finalPercentage);

        // Update enrollment with final grade and set status to completed
        await ctx.db.patch(enrollment._id, {
          grade: finalGrade.letter, // Store letter grade as string
          status: "completed",
        });

        // Get term and session information for transcript entry
        const term = await ctx.db.get(enrollment.termId);
        if (!term) {
          throw new NotFoundError("Term", enrollment.termId);
        }

        const session = await ctx.db.get(enrollment.sessionId);
        if (!session) {
          throw new NotFoundError("Academic Session", enrollment.sessionId);
        }

        // Extract year from session yearLabel (e.g., "2024/2025" -> 2024)
        const yearMatch = session.yearLabel.match(/^(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date(term.startDate).getFullYear();
        const termName = term.name;

        // Get or create transcript for the student
        let transcript = await ctx.db
          .query("transcripts")
          .withIndex("by_studentId", (q) => q.eq("studentId", enrollment.studentId))
          .first();

        if (!transcript) {
          // Create new transcript if it doesn't exist
          const transcriptId = await ctx.db.insert("transcripts", {
            studentId: enrollment.studentId,
            entries: [],
            gpa: 0,
          });
          transcript = await ctx.db.get(transcriptId);
          if (!transcript) {
            throw new Error("Failed to create transcript");
          }
        }

        // Add enrollment to transcript
        await addEnrollmentToTranscript(
          ctx.db,
          transcript._id,
          enrollment._id,
          termName,
          year
        );

        results.push({
          enrollmentId: enrollment._id,
          studentId: enrollment.studentId,
          finalGrade,
          finalPercentage,
          success: true,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.push({
          enrollmentId: enrollment._id,
          studentId: enrollment.studentId,
          finalGrade: { numeric: 0, letter: "F", points: 0.0 },
          finalPercentage: 0,
          success: false,
          error: errorMessage,
        });
      }
    }

    // Check if all enrollments were processed successfully
    const failedCount = results.filter((r) => !r.success).length;
    if (failedCount > 0) {
      const failedMessages = results
        .filter((r) => !r.success)
        .map((r) => r.error)
        .join("; ");
      throw new InvariantViolationError(
        "EnrollmentMutation",
        "Post Final Grade",
        `Failed to post grades for ${failedCount} enrollment(s): ${failedMessages}`
      );
    }

    // Mark final grades as posted and disable grade editing
    await ctx.db.patch(args.sectionId, {
      finalGradesPosted: true,
      gradesEditable: false,
    });

    return {
      success: true,
      processedCount: results.length,
      results,
    };
  },
});

