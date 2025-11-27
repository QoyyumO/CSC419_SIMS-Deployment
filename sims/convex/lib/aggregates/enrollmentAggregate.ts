/**
 * EnrollmentAggregate Invariant Validation
 * 
 * Enforces invariants for the Enrollment aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { Enrollment, EnrollmentStatus } from "./types";

/**
 * Valid enrollment status values
 */
export const VALID_ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "enrolled",
  "dropped",
  "completed",
  "failed",
  "withdrawn",
  "pending",
];

/**
 * Final statuses that indicate enrollment is complete
 */
export const FINAL_STATUSES: EnrollmentStatus[] = ["completed", "failed"];

/**
 * Validates enrollment status is from allowed set
 */
export function validateEnrollmentStatus(
  status: string
): status is EnrollmentStatus {
  return VALID_ENROLLMENT_STATUSES.includes(status as EnrollmentStatus);
}

/**
 * Checks if an enrollment has a final grade recorded
 */
export async function hasFinalGrade(
  db: DatabaseReader,
  enrollmentId: Id<"enrollments">
): Promise<boolean> {
  // Check if there are any grades recorded for this enrollment
  // In a real system, you might have a specific "final grade" flag
  const grades = await db
    .query("grades")
    .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollmentId))
    .collect();

  return grades.length > 0;
}

/**
 * Validates that enrollment status can be changed
 * Once a final grade is recorded, status changes require special handling
 */
export async function validateStatusChange(
  db: DatabaseReader,
  enrollment: Enrollment,
  newStatus: EnrollmentStatus,
  requireAppeal: boolean = true
): Promise<void> {
  const hasFinal = await hasFinalGrade(db, enrollment._id);
  const isFinalStatus = FINAL_STATUSES.includes(enrollment.status);

  if (hasFinal || isFinalStatus) {
    if (requireAppeal && newStatus !== enrollment.status) {
      throw new InvariantViolationError(
        "EnrollmentAggregate",
        "Final Grade Immutability",
        `Cannot change enrollment status from '${enrollment.status}' to '${newStatus}' after final grade is recorded. An official appeal process is required.`
      );
    }
  }
}

/**
 * Validates unique enrollment (student cannot be enrolled twice in same section)
 */
export async function validateUniqueEnrollment(
  db: DatabaseReader,
  studentId: Id<"students">,
  sectionId: Id<"sections">,
  excludeId?: Id<"enrollments">
): Promise<void> {
  const enrollments = await db
    .query("enrollments")
    .withIndex("by_studentId_sectionId", (q) =>
      q.eq("studentId", studentId).eq("sectionId", sectionId)
    )
    .collect();

  const existing = enrollments.find((e) => e._id !== excludeId);

  if (existing) {
    throw new InvariantViolationError(
      "EnrollmentAggregate",
      "Unique Enrollment",
      `Student is already enrolled in this section with status '${existing.status}'`
    );
  }
}

/**
 * Validates student and section references
 */
export async function validateEnrollmentReferences(
  db: DatabaseReader,
  studentId: Id<"students">,
  sectionId: Id<"sections">
): Promise<void> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  const section = await db.get(sectionId);
  if (!section) {
    throw new NotFoundError("Section", sectionId);
  }
}

/**
 * Validates term consistency between enrollment and section
 */
export async function validateTermConsistency(
  db: DatabaseReader,
  sectionId: Id<"sections">,
  termId: Id<"terms">
): Promise<void> {
  const section = await db.get(sectionId);
  if (!section) {
    throw new NotFoundError("Section", sectionId);
  }

  if (section.termId !== termId) {
    throw new InvariantViolationError(
      "EnrollmentAggregate",
      "Term Consistency",
      `Enrollment termId (${termId}) does not match section termId (${section.termId})`
    );
  }
}

/**
 * Validates all invariants for creating an enrollment
 */
export async function validateCreateEnrollment(
  db: DatabaseReader,
  studentId: Id<"students">,
  sectionId: Id<"sections">,
  termId: Id<"terms">,
  status: EnrollmentStatus
): Promise<void> {
  await validateEnrollmentReferences(db, studentId, sectionId);
  await validateTermConsistency(db, sectionId, termId);
  await validateUniqueEnrollment(db, studentId, sectionId);

  if (!validateEnrollmentStatus(status)) {
    throw new InvariantViolationError(
      "EnrollmentAggregate",
      "Enrollment Status Validity",
      `Invalid enrollment status: '${status}'. Valid statuses: ${VALID_ENROLLMENT_STATUSES.join(", ")}`
    );
  }
}

/**
 * Validates all invariants for updating an enrollment
 */
export async function validateUpdateEnrollment(
  db: DatabaseReader,
  enrollmentId: Id<"enrollments">,
  newStatus?: EnrollmentStatus,
  requireAppeal: boolean = true
): Promise<void> {
  const enrollment = await db.get(enrollmentId);
  if (!enrollment) {
    throw new NotFoundError("Enrollment", enrollmentId);
  }

  if (newStatus && newStatus !== enrollment.status) {
    if (!validateEnrollmentStatus(newStatus)) {
      throw new InvariantViolationError(
        "EnrollmentAggregate",
        "Enrollment Status Validity",
        `Invalid enrollment status: '${newStatus}'`
      );
    }

    await validateStatusChange(db, enrollment as Enrollment, newStatus, requireAppeal);
  }
}

