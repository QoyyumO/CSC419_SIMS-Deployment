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
import { validateSessionToken } from "../lib/session";

/**
 * Converts percentage to GradeValue for audit log purposes only
 * This is not stored in the database, only used for logging
 */
function calculateGradeValueForAudit(percentage: number): GradeValue {
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
 * Calculates percentage from score and total points
 * Grades table stores only numeric percentage (0-100)
 * Letter grade mapping happens in transcript service
 */
function calculatePercentage(score: number, totalPoints: number): number {
  return (score / totalPoints) * 100;
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

    // Check if section is locked
    if (section.isLocked === true) {
      throw new Error("Grading is closed for this section.");
    }

    // Check if grades are editable (final grades posted and not reopened by registrar)
    if (section.finalGradesPosted && section.gradesEditable === false) {
      throw new Error("Grades cannot be edited. Final grades have been posted for this section. Please contact the registrar if you need to make changes.");
    }

    // Step 2: Read assessment and validate score
    // Invariant Check: score must be ≤ assessment.totalPoints
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

    if (args.score > assessment.totalPoints) {
      throw new InvariantViolationError(
        "GradeMutation",
        "Score Validation",
        `Score (${args.score}) exceeds maximum score (${assessment.totalPoints})`
      );
    }

    // Calculate percentage (0-100)
    const percentage = calculatePercentage(args.score, assessment.totalPoints);
    const roundedPercentage = Math.round(percentage * 100) / 100;

    // Step 3: Create or update grade document
    // Check if grade already exists
    const existingGrades = await ctx.db
      .query("grades")
      .withIndex("by_enrollmentId_assessmentId", (q) =>
        q.eq("enrollmentId", args.enrollmentId).eq("assessmentId", args.assessmentId)
      )
      .collect();

    let gradeId: Id<"grades">;
    const previousPercentage = existingGrades.length > 0 ? existingGrades[0].grade : null;

    if (existingGrades.length > 0) {
      // Handle duplicates: if multiple records exist, delete all but the first one
      if (existingGrades.length > 1) {
        // Delete all duplicate records except the first one
        for (let i = 1; i < existingGrades.length; i++) {
          await ctx.db.delete(existingGrades[i]._id);
        }
      }
      
      // Update the first (and now only) existing grade
      const existingGrade = existingGrades[0];
      await ctx.db.patch(existingGrade._id, {
        grade: roundedPercentage,
        recordedBy: args.recordedByUserId,
      });
      gradeId = existingGrade._id;
    } else {
      // Create new grade
      gradeId = await ctx.db.insert("grades", {
        enrollmentId: args.enrollmentId,
        assessmentId: args.assessmentId,
        grade: roundedPercentage,
        recordedBy: args.recordedByUserId,
      });
    }

    // Step 4: Create audit log entry
    // For audit logs, we still calculate letter grade for display purposes
    const gradeValue = calculateGradeValueForAudit(roundedPercentage);
    if (existingGrades.length > 0) {
      // Grade was edited
      const previousGradeValue = previousPercentage !== null ? calculateGradeValueForAudit(previousPercentage) : null;
      await logGradeEdited(
        ctx.db,
        args.recordedByUserId,
        gradeId,
        previousGradeValue?.letter || "N/A",
        gradeValue.letter,
        {
          enrollmentId: args.enrollmentId,
          assessmentId: args.assessmentId,
          score: args.score,
          totalPoints: assessment.totalPoints,
          previousScore: previousPercentage || 0,
          newScore: roundedPercentage,
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
          totalPoints: assessment.totalPoints,
          gradeValue,
          studentId: enrollment.studentId,
          sectionId: section._id,
        }
      );
    }

    return {
      success: true,
      gradeId,
      percentage: roundedPercentage,
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

      const assessmentPercentage = (grade.grade / 100) * assessment.weight;
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
    const finalGradeValue = calculateGradeValueForAudit(finalPercentage);

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

/**
 * Update multiple grades at once
 * 
 * Accepts an array of { enrollmentId, assessmentId, score } and upserts the grade records.
 * This is optimized for bulk grade entry in the gradebook interface.
 */
export const updateGrades = mutation({
  args: {
    grades: v.array(
      v.object({
        enrollmentId: v.id("enrollments"),
        assessmentId: v.id("assessments"),
        score: v.number(),
      })
    ),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new Error("Authentication required");
    }

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

    // Process each grade update
    const results = await Promise.all(
      args.grades.map(async (gradeInput) => {
        // Get enrollment and verify it exists
        const enrollment = await ctx.db.get(gradeInput.enrollmentId);
        if (!enrollment) {
          throw new NotFoundError("Enrollment", gradeInput.enrollmentId);
        }

        // Get section and verify instructor owns it
        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
          throw new NotFoundError("Section", enrollment.sectionId);
        }

        if (section.instructorId !== userId) {
          throw new Error("Access denied: You can only update grades for your own sections");
        }

        // Check if section is locked
        if (section.isLocked === true) {
          throw new Error("Grading is closed for this section.");
        }

        // Check if grades are editable (final grades posted and not reopened by registrar)
        if (section.finalGradesPosted && section.gradesEditable === false) {
          throw new Error("Grades cannot be edited. Final grades have been posted for this section. Please contact the registrar if you need to make changes.");
        }

        // Get assessment and validate
        const assessment = await ctx.db.get(gradeInput.assessmentId);
        if (!assessment) {
          throw new NotFoundError("Assessment", gradeInput.assessmentId);
        }

        if (assessment.sectionId !== section._id) {
          throw new InvariantViolationError(
            "GradeMutation",
            "Assessment Section Match",
            "Assessment does not belong to the enrollment's section"
          );
        }

        // Validate score
        if (gradeInput.score < 0) {
          throw new InvariantViolationError(
            "GradeMutation",
            "Score Validation",
            "Score cannot be negative"
          );
        }

        if (gradeInput.score > assessment.totalPoints) {
          throw new InvariantViolationError(
            "GradeMutation",
            "Score Validation",
            `Score (${gradeInput.score}) exceeds maximum score (${assessment.totalPoints})`
          );
        }

        // Calculate percentage (0-100)
        const percentage = calculatePercentage(gradeInput.score, assessment.totalPoints);
        const roundedPercentage = Math.round(percentage * 100) / 100;

        // Check if grade already exists
        const existingGrades = await ctx.db
          .query("grades")
          .withIndex("by_enrollmentId_assessmentId", (q) =>
            q.eq("enrollmentId", gradeInput.enrollmentId).eq("assessmentId", gradeInput.assessmentId)
          )
          .collect();

        let gradeId: Id<"grades">;
        const isUpdate = existingGrades.length > 0;
        const previousPercentage = existingGrades.length > 0 ? existingGrades[0].grade : null;

        if (isUpdate) {
          // Handle duplicates: if multiple records exist, delete all but the first one
          if (existingGrades.length > 1) {
            // Delete all duplicate records except the first one
            for (let i = 1; i < existingGrades.length; i++) {
              await ctx.db.delete(existingGrades[i]._id);
            }
          }
          
          // Update the first (and now only) existing grade
          const existingGrade = existingGrades[0];
          await ctx.db.patch(existingGrade._id, {
            grade: roundedPercentage,
            recordedBy: userId,
          });
          gradeId = existingGrade._id;
        } else {
          // Create new grade
          gradeId = await ctx.db.insert("grades", {
            enrollmentId: gradeInput.enrollmentId,
            assessmentId: gradeInput.assessmentId,
            grade: roundedPercentage,
            recordedBy: userId,
          });
        }

        // Create audit log entry
        const gradeValue = calculateGradeValueForAudit(roundedPercentage);
        if (isUpdate) {
          const previousGradeValue = previousPercentage !== null ? calculateGradeValueForAudit(previousPercentage) : null;
          await logGradeEdited(
            ctx.db,
            userId,
            gradeId,
            previousGradeValue?.letter || "N/A",
            gradeValue.letter,
            {
              enrollmentId: gradeInput.enrollmentId,
              assessmentId: gradeInput.assessmentId,
              score: gradeInput.score,
              totalPoints: assessment.totalPoints,
              previousScore: previousPercentage || 0,
              newScore: roundedPercentage,
            }
          );
        } else {
          await logCourseGradePosted(
            ctx.db,
            userId,
            gradeId,
            {
              enrollmentId: gradeInput.enrollmentId,
              assessmentId: gradeInput.assessmentId,
              score: gradeInput.score,
              totalPoints: assessment.totalPoints,
              gradeValue,
              studentId: enrollment.studentId,
              sectionId: section._id,
            }
          );

          // Create notification for the student when a new grade is posted
          // Get course information
          const course = await ctx.db.get(section.courseId);
          if (course) {
            // Get student's userId
            const student = await ctx.db.get(enrollment.studentId);
            if (student) {
              // Create notification
              await ctx.db.insert("notifications", {
                userId: student.userId,
                message: `New grade posted for ${course.title}: ${assessment.title}`,
                read: false,
                createdAt: Date.now(),
                courseId: course._id,
              });
            }
          }
        }

        return {
          success: true,
          gradeId,
          enrollmentId: gradeInput.enrollmentId,
          assessmentId: gradeInput.assessmentId,
        };
      })
    );

    return {
      success: true,
      updated: results.length,
      results,
    };
  },
});

