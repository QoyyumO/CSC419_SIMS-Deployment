/**
 * StudentAggregate Invariant Validation
 * 
 * Enforces invariants for the Student aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { Student, StudentStatus } from "./types";

/**
 * Valid student status values
 */
export const VALID_STUDENT_STATUSES: StudentStatus[] = [
  "active",
  "suspended",
  "graduated",
  "inactive",
];

/**
 * Validates student status is from allowed set
 */
export function validateStudentStatus(status: string): status is StudentStatus {
  return VALID_STUDENT_STATUSES.includes(status as StudentStatus);
}

/**
 * Validates that a student can perform enrollment operations based on status
 */
export function validateCanEnroll(student: Student): void {
  if (student.status !== "active") {
    throw new InvariantViolationError(
      "StudentAggregate",
      "Status-Based Operation Control",
      `Student with status '${student.status}' cannot enroll in courses. Only 'active' students can enroll.`
    );
  }
}

/**
 * Validates that a student can perform read operations
 */
export function validateCanRead(_student: Student): void {
  // All students can read their own data, regardless of status
  // This is a placeholder for more complex authorization logic
  // Parameter is intentionally unused - reserved for future authorization checks
  void _student; // Suppress unused parameter warning
}

/**
 * Validates student number uniqueness
 */
export async function validateStudentNumberUniqueness(
  db: DatabaseReader,
  studentNumber: string,
  excludeId?: Id<"students">
): Promise<void> {
  const existing = await db
    .query("students")
    .withIndex("by_studentNumber", (q) => q.eq("studentNumber", studentNumber))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "StudentAggregate",
      "Student Number Uniqueness",
      `Student with number '${studentNumber}' already exists`
    );
  }
}

/**
 * Validates user association
 */
export async function validateUserAssociation(
  db: DatabaseReader,
  userId: Id<"users">
): Promise<void> {
  const user = await db.get(userId);
  if (!user) {
    throw new NotFoundError("User", userId);
  }
}

/**
 * Validates program association
 */
export async function validateProgramAssociation(
  db: DatabaseReader,
  programId: Id<"programs">
): Promise<void> {
  const program = await db.get(programId);
  if (!program) {
    throw new NotFoundError("Program", programId);
  }
}

/**
 * Validates status transition is allowed
 */
export function validateStatusTransition(
  currentStatus: StudentStatus,
  newStatus: StudentStatus
): void {
  // Define allowed transitions
  const allowedTransitions: Record<StudentStatus, StudentStatus[]> = {
    active: ["suspended", "graduated", "inactive"],
    suspended: ["active", "inactive"],
    graduated: [], // Graduated is terminal - cannot transition from it
    inactive: ["active"],
  };

  const allowed = allowedTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throw new InvariantViolationError(
      "StudentAggregate",
      "Status-Based Operation Control",
      `Cannot transition from status '${currentStatus}' to '${newStatus}'. Allowed transitions: ${allowed.join(", ") || "none"}`
    );
  }
}

/**
 * Validates all invariants for creating a student
 */
export async function validateCreateStudent(
  db: DatabaseReader,
  userId: Id<"users">,
  studentNumber: string,
  programId: Id<"programs">,
  status: StudentStatus
): Promise<void> {
  await validateUserAssociation(db, userId);
  await validateProgramAssociation(db, programId);
  await validateStudentNumberUniqueness(db, studentNumber);

  if (!validateStudentStatus(status)) {
    throw new InvariantViolationError(
      "StudentAggregate",
      "Status-Based Operation Control",
      `Invalid student status: '${status}'. Valid statuses: ${VALID_STUDENT_STATUSES.join(", ")}`
    );
  }
}

/**
 * Validates all invariants for updating a student
 */
export async function validateUpdateStudent(
  db: DatabaseReader,
  studentId: Id<"students">,
  status?: StudentStatus,
  programId?: Id<"programs">
): Promise<void> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  if (status && status !== student.status) {
    if (!validateStudentStatus(status)) {
      throw new InvariantViolationError(
        "StudentAggregate",
        "Status-Based Operation Control",
        `Invalid student status: '${status}'`
      );
    }
    validateStatusTransition(student.status as StudentStatus, status);
  }

  if (programId) {
    await validateProgramAssociation(db, programId);
  }
}

/**
 * Validates student can enroll in a section
 */
export async function validateStudentCanEnroll(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<void> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  validateCanEnroll(student as Student);
}

