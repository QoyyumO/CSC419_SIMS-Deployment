/**
 * GraduationAggregate Invariant Validation
 * 
 * Enforces invariants for the Graduation aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { Student, UserRole, TranscriptEntry } from "./types";

/**
 * Valid roles that can approve graduation
 * Only registrars can approve student graduations
 */
export const APPROVER_ROLES = ["registrar"];

/**
 * Validates that approver has appropriate authority
 */
export async function validateApproverAuthority(
  db: DatabaseReader,
  approverId: Id<"users">
): Promise<void> {
  const user = await db.get(approverId);
  if (!user) {
    throw new NotFoundError("User", approverId);
  }

  const hasAuthority = (user.roles as UserRole[]).some((role: UserRole) => APPROVER_ROLES.includes(role));

  if (!hasAuthority) {
    throw new InvariantViolationError(
      "GraduationAggregate",
      "Approval Authority",
      `User '${approverId}' does not have authority to approve graduations. Required roles: ${APPROVER_ROLES.join(", ")}`
    );
  }
}

/**
 * Validates student association
 */
export async function validateGraduationStudent(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<Student> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }
  return student as Student;
}

/**
 * Validates graduation date
 */
export function validateGraduationDate(date: number): void {
  if (date < 0) {
    throw new InvariantViolationError(
      "GraduationAggregate",
      "Date Validity",
      "Graduation date must be a valid timestamp"
    );
  }

  // Uncomment if you want to restrict future dates
  // if (date > maxFutureDate) {
  //   throw new InvariantViolationError(
  //     "GraduationAggregate",
  //     "Date Validity",
  //     "Graduation date cannot be more than 1 year in the future"
  //   );
  // }
}

/**
 * Checks if student has completed all graduation requirements
 * This is a simplified version - adjust based on your requirements structure
 */
export async function validateGraduationRequirements(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<void> {
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
      "GraduationAggregate",
      "Prerequisite Validation",
      "Student does not have a transcript"
    );
  }

  // Check minimum GPA (example: 2.0)
  const minGPA = 2.0;
  if (transcript.gpa < minGPA) {
    throw new InvariantViolationError(
      "GraduationAggregate",
      "Prerequisite Validation",
      `Student GPA (${transcript.gpa}) is below minimum required GPA (${minGPA})`
    );
  }

  // Check minimum credits (example: 120)
  const totalCredits = transcript.entries.reduce(
    (sum: number, entry: TranscriptEntry) => sum + entry.credits,
    0
  );
  const minCredits = 120; // Default minimum credits requirement

  if (totalCredits < minCredits) {
    throw new InvariantViolationError(
      "GraduationAggregate",
      "Prerequisite Validation",
      `Student has ${totalCredits} credits, but minimum required is ${minCredits}`
    );
  }

  // Add more requirement checks as needed:
  // - Required courses completed
  // - No outstanding holds
  // - All prerequisites met
}

/**
 * Validates that graduation record doesn't already exist for student
 */
export async function validateNoDuplicateGraduation(
  db: DatabaseReader,
  studentId: Id<"students">,
  excludeId?: Id<"graduationRecords">
): Promise<void> {
  const existing = await db
    .query("graduationRecords")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "GraduationAggregate",
      "One Graduation Per Student",
      "Graduation record already exists for this student"
    );
  }
}

/**
 * Validates all invariants for creating a graduation record
 */
export async function validateCreateGraduation(
  db: DatabaseReader,
  studentId: Id<"students">,
  approvedBy: Id<"users">,
  date: number,
  checkRequirements: boolean = true
): Promise<void> {
  await validateGraduationStudent(db, studentId);
  await validateApproverAuthority(db, approvedBy);
  validateGraduationDate(date);
  await validateNoDuplicateGraduation(db, studentId);

  if (checkRequirements) {
    await validateGraduationRequirements(db, studentId);
  }
}

/**
 * Validates all invariants for updating a graduation record
 */
export async function validateUpdateGraduation(
  db: DatabaseReader,
  graduationId: Id<"graduationRecords">,
  approvedBy?: Id<"users">,
  date?: number
): Promise<void> {
  const graduation = await db.get(graduationId);
  if (!graduation) {
    throw new NotFoundError("GraduationRecord", graduationId);
  }

  if (approvedBy) {
    await validateApproverAuthority(db, approvedBy);
  }

  if (date !== undefined) {
    validateGraduationDate(date);
  }
}

