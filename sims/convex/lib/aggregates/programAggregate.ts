/**
 * ProgramAggregate Invariant Validation
 * 
 * Enforces invariants for the Program aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { ProgramRequirements } from "./types";

/**
 * Validates that a program belongs to a valid department
 */
export async function validateProgramDepartment(
  db: DatabaseReader,
  departmentId: Id<"departments">
): Promise<void> {
  const department = await db.get(departmentId);
  if (!department) {
    throw new NotFoundError("Department", departmentId);
  }
}

/**
 * Validates program code uniqueness within a department
 */
export async function validateProgramCodeUniqueness(
  db: DatabaseReader,
  code: string,
  departmentId: Id<"departments">,
  excludeId?: Id<"programs">
): Promise<void> {
  // Query all programs with this code
  const programs = await db
    .query("programs")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();

  // Check if any program in the same department has this code
  const duplicate = programs.find(
    (p) => p.departmentId === departmentId && p._id !== excludeId
  );

  if (duplicate) {
    throw new InvariantViolationError(
      "ProgramAggregate",
      "Program Code Uniqueness",
      `Program with code '${code}' already exists in this department`
    );
  }
}

/**
 * Validates that all course prerequisites in requirements exist
 */
export async function validateProgramCoursePrerequisites(
  db: DatabaseReader,
  requirements: ProgramRequirements | undefined
): Promise<void> {
  // Extract course IDs from requirements
  // This is a simplified version - adjust based on your requirements structure
  const courseIds: Id<"courses">[] = [];

  if (requirements?.requiredCourses) {
    if (Array.isArray(requirements.requiredCourses)) {
      courseIds.push(...requirements.requiredCourses);
    }
  }

  // Validate each course exists
  for (const courseId of courseIds) {
    const course = await db.get(courseId);
    if (!course) {
      throw new InvariantViolationError(
        "ProgramAggregate",
        "Prerequisite Validity",
        `Course with id '${courseId}' referenced in requirements does not exist`
      );
    }
  }
}

/**
 * Validates credit requirements consistency
 */
export function validateCreditRequirements(requirements: ProgramRequirements | undefined): void {
  if (!requirements) return;

  const minCredits = requirements.minCredits;
  const maxCredits = requirements.maxCredits;

  if (minCredits !== undefined && maxCredits !== undefined) {
    if (minCredits < 0 || maxCredits < 0) {
      throw new InvariantViolationError(
        "ProgramAggregate",
        "Credit Requirements Consistency",
        "Credit requirements must be non-negative"
      );
    }

    if (minCredits > maxCredits) {
      throw new InvariantViolationError(
        "ProgramAggregate",
        "Credit Requirements Consistency",
        `Minimum credits (${minCredits}) cannot exceed maximum credits (${maxCredits})`
      );
    }
  }
}

/**
 * Validates all invariants for creating a program
 */
export async function validateCreateProgram(
  db: DatabaseReader,
  departmentId: Id<"departments">,
  code: string,
  requirements: ProgramRequirements | undefined
): Promise<void> {
  await validateProgramDepartment(db, departmentId);
  await validateProgramCodeUniqueness(db, code, departmentId);
  validateCreditRequirements(requirements);
  await validateProgramCoursePrerequisites(db, requirements);
}

/**
 * Validates all invariants for updating a program
 */
export async function validateUpdateProgram(
  db: DatabaseReader,
  programId: Id<"programs">,
  departmentId?: Id<"departments">,
  code?: string,
  requirements?: ProgramRequirements
): Promise<void> {
  const program = await db.get(programId);
  if (!program) {
    throw new NotFoundError("Program", programId);
  }

  const finalDepartmentId = departmentId ?? program.departmentId;

  if (departmentId) {
    await validateProgramDepartment(db, departmentId);
  }

  if (code && code !== program.code) {
    await validateProgramCodeUniqueness(db, code, finalDepartmentId, programId);
  }

  if (requirements) {
    validateCreditRequirements(requirements);
    await validateProgramCoursePrerequisites(db, requirements);
  }
}

