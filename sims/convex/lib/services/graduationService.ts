/**
 * Graduation Service
 * 
 * Domain logic for graduation operations including degree audit.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { TranscriptEntry } from "../aggregates/types";

/**
 * Result of a degree audit
 */
export interface DegreeAuditResult {
  eligible: boolean;
  missingRequirements: string[];
  totalCredits: number;
  requiredCredits: number;
  gpa: number;
  requiredGPA: number;
}

/**
 * Runs a degree audit to check if a student meets all graduation requirements
 */
export async function runDegreeAudit(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<DegreeAuditResult> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  // Get student's transcript
  const transcript = await db
    .query("transcripts")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .first();

  if (!transcript) {
    throw new InvariantViolationError(
      "GraduationService",
      "Degree Audit",
      "Student does not have a transcript"
    );
  }

  const missingRequirements: string[] = [];

  // Check minimum credits (default: 120)
  const totalCredits = transcript.entries.reduce(
    (sum: number, entry: TranscriptEntry) => sum + entry.credits,
    0
  );
  const requiredCredits = 120; // Default minimum credits requirement

  if (totalCredits < requiredCredits) {
    missingRequirements.push(
      `Insufficient credits: ${totalCredits}/${requiredCredits}`
    );
  }

  // Check minimum GPA (default: 2.0)
  const requiredGPA = 2.0;
  if (transcript.gpa < requiredGPA) {
    missingRequirements.push(
      `GPA below minimum: ${transcript.gpa.toFixed(2)}/${requiredGPA}`
    );
  }

  // Check for incomplete enrollments
  const incompleteEnrollments = await db
    .query("enrollments")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .filter((q) => q.eq(q.field("status"), "enrolled"))
    .collect();

  if (incompleteEnrollments.length > 0) {
    missingRequirements.push(
      `Student has ${incompleteEnrollments.length} incomplete enrollment(s)`
    );
  }

  const eligible = missingRequirements.length === 0;

  return {
    eligible,
    missingRequirements,
    totalCredits,
    requiredCredits,
    gpa: transcript.gpa,
    requiredGPA,
  };
}

/**
 * Validates that all graduation requirements are satisfied
 */
export async function validateGraduationRequirements(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<void> {
  const auditResult = await runDegreeAudit(db, studentId);

  if (!auditResult.eligible) {
    throw new InvariantViolationError(
      "GraduationService",
      "Graduation Requirements Validation",
      `Student does not meet graduation requirements: ${auditResult.missingRequirements.join("; ")}`
    );
  }
}

