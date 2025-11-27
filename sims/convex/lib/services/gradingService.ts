/**
 * Grading Service
 * 
 * Domain logic for grading operations including grade computation,
 * letter grade conversion, and grade appeal workflows.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { GradeValue } from "../aggregates/types";

/**
 * Converts a numeric score to a letter grade and points
 */
export function convertScoreToGrade(score: number, maxScore: number): GradeValue {
  if (score < 0 || score > maxScore) {
    throw new InvariantViolationError(
      "GradingService",
      "Score Conversion",
      `Score (${score}) must be between 0 and ${maxScore}`
    );
  }

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
    numeric: Math.round(percentage * 100) / 100, // Round to 2 decimal places
    letter,
    points,
  };
}

/**
 * Computes final course grade from assessment scores
 * 
 * Formula: Weighted average of all assessments
 */
export async function computeFinalGrade(
  db: DatabaseReader,
  enrollmentId: Id<"enrollments">
): Promise<{ finalGrade: GradeValue; finalPercentage: number }> {
  const enrollment = await db.get(enrollmentId);
  if (!enrollment) {
    throw new NotFoundError("Enrollment", enrollmentId);
  }

  const section = await db.get(enrollment.sectionId);
  if (!section) {
    throw new NotFoundError("Section", enrollment.sectionId);
  }

  // Get all assessments for the section
  const assessments = await db
    .query("assessments")
    .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
    .collect();

  if (assessments.length === 0) {
    throw new InvariantViolationError(
      "GradingService",
      "Final Grade Computation",
      "No assessments found for this section"
    );
  }

  // Verify weights sum to 100%
  const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new InvariantViolationError(
      "GradingService",
      "Final Grade Computation",
      `Assessment weights sum to ${totalWeight}%, expected 100%`
    );
  }

  // Get all grades for this enrollment
  const grades = await db
    .query("grades")
    .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollmentId))
    .collect();

  // Calculate weighted final grade
  let totalWeightedPoints = 0;
  const missingAssessments: string[] = [];

  for (const assessment of assessments) {
    const grade = grades.find((g) => g.assessmentId === assessment._id);
    if (!grade) {
      missingAssessments.push(assessment.title);
      continue;
    }

    // Calculate contribution: (grade percentage / 100) * weight
    const assessmentPercentage = (grade.grade.numeric / 100) * assessment.weight;
    totalWeightedPoints += assessmentPercentage;
  }

  if (missingAssessments.length > 0) {
    throw new InvariantViolationError(
      "GradingService",
      "Final Grade Computation",
      `Missing grades for assessments: ${missingAssessments.join(", ")}`
    );
  }

  const finalPercentage = Math.round(totalWeightedPoints * 100) / 100;
  const finalGrade = convertScoreToGrade(finalPercentage, 100);

  return {
    finalGrade,
    finalPercentage,
  };
}

/**
 * Grade appeal status
 */
export type GradeAppealStatus = "pending" | "approved" | "rejected" | "under_review";

/**
 * Grade appeal request
 */
export interface GradeAppealRequest {
  gradeId: Id<"grades">;
  studentId: Id<"students">;
  reason: string;
  requestedBy: Id<"users">;
  status: GradeAppealStatus;
  createdAt: number;
  reviewedBy?: Id<"users">;
  reviewedAt?: number;
  reviewNotes?: string;
}

/**
 * Validates that a grade can be appealed
 */
export async function validateGradeAppeal(
  db: DatabaseReader,
  gradeId: Id<"grades">,
  studentId: Id<"students">
): Promise<void> {
  const grade = await db.get(gradeId);
  if (!grade) {
    throw new NotFoundError("Grade", gradeId);
  }

  const enrollment = await db.get(grade.enrollmentId);
  if (!enrollment) {
    throw new NotFoundError("Enrollment", grade.enrollmentId);
  }

  // Verify the grade belongs to the student
  if (enrollment.studentId !== studentId) {
    throw new InvariantViolationError(
      "GradingService",
      "Grade Appeal Validation",
      "Grade does not belong to this student"
    );
  }

  // Check if appeal deadline has passed (e.g., 30 days after grade posted)
  // This is a simplified check - adjust based on your business rules
  // Note: We'd need to track when the grade was created to check this
  // For now, we'll assume appeals are always allowed within the deadline
  // const appealDeadline = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
}

/**
 * Processes a grade appeal
 */
export async function processGradeAppeal(
  db: DatabaseReader,
  appeal: GradeAppealRequest,
  reviewerId: Id<"users">,
  approved: boolean,
  reviewNotes?: string
): Promise<void> {
  await validateGradeAppeal(db, appeal.gradeId, appeal.studentId);

  // Update appeal status
  appeal.status = approved ? "approved" : "rejected";
  appeal.reviewedBy = reviewerId;
  appeal.reviewedAt = Date.now();
  appeal.reviewNotes = reviewNotes;

  // Note: In a real system, you'd store appeals in a separate collection
  // For now, this is a placeholder for the appeal processing logic
}

