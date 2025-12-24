/**
 * CourseAggregate Invariant Validation
 * 
 * Enforces invariants for the Course aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";

/**
 * Valid course status values
 * C = Core/Required
 * R = Required
 * E = Elective
 */
export type CourseStatus = "C" | "R" | "E";

export const VALID_COURSE_STATUSES: CourseStatus[] = ["C", "R", "E"];

/**
 * Validates course status is from allowed set
 */
export function validateCourseStatus(status: string): status is CourseStatus {
  return VALID_COURSE_STATUSES.includes(status as CourseStatus);
}

/**
 * Checks if a course status indicates it's a required course (C or R)
 */
export function isRequiredCourse(status: string): boolean {
  return status === "C" || status === "R";
}

/**
 * Validates course code uniqueness
 */
export async function validateCourseCodeUniqueness(
  db: DatabaseReader,
  code: string,
  excludeId?: Id<"courses">
): Promise<void> {
  const existing = await db
    .query("courses")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "CourseAggregate",
      "Course Code Uniqueness",
      `Course with code '${code}' already exists`
    );
  }
}

/**
 * Validates that all prerequisites point to valid courses
 */
export async function validateCoursePrerequisites(
  db: DatabaseReader,
  prerequisites: string[]
): Promise<void> {
  for (const prereqCode of prerequisites) {
    const course = await db
      .query("courses")
      .withIndex("by_code", (q) => q.eq("code", prereqCode))
      .first();
    if (!course) {
      throw new InvariantViolationError(
        "CourseAggregate",
        "Prerequisite Validity",
        `Prerequisite course with code '${prereqCode}' does not exist`
      );
    }
  }
}

/**
 * Validates that prerequisites don't create circular dependencies
 * Uses a simple check: a course cannot be a prerequisite of itself
 */
export function validateNoCircularPrerequisites(
  courseCode: string,
  prerequisites: string[]
): void {
  if (prerequisites.includes(courseCode)) {
    throw new InvariantViolationError(
      "CourseAggregate",
      "Circular Dependency Prevention",
      "A course cannot be a prerequisite of itself"
    );
  }
}

/**
 * Validates credit value is within acceptable range
 */
export function validateCreditValue(credits: number): void {
  if (credits <= 0) {
    throw new InvariantViolationError(
      "CourseAggregate",
      "Credit Value Validity",
      "Credits must be a positive number"
    );
  }

  if (credits > 6) {
    throw new InvariantViolationError(
      "CourseAggregate",
      "Credit Value Validity",
      `Credits (${credits}) exceeds maximum allowed value (6)`
    );
  }
}

/**
 * Validates all invariants for creating a course
 */
export async function validateCreateCourse(
  db: DatabaseReader,
  code: string,
  credits: number,
  prerequisites: string[]
): Promise<void> {
  await validateCourseCodeUniqueness(db, code);
  validateCreditValue(credits);
  validateNoCircularPrerequisites(code, prerequisites);
  await validateCoursePrerequisites(db, prerequisites);
}

/**
 * Validates all invariants for updating a course
 */
export async function validateUpdateCourse(
  db: DatabaseReader,
  courseId: Id<"courses">,
  code?: string,
  credits?: number,
  prerequisites?: string[]
): Promise<void> {
  const course = await db.get(courseId);
  if (!course) {
    throw new NotFoundError("Course", courseId);
  }

  if (code && code !== course.code) {
    await validateCourseCodeUniqueness(db, code, courseId);
  }

  if (credits !== undefined) {
    validateCreditValue(credits);
  }

  if (prerequisites) {
    // Use the current code or the new code if being updated
    const courseCode = code ?? course.code;
    validateNoCircularPrerequisites(courseCode, prerequisites);
    await validateCoursePrerequisites(db, prerequisites);
  }
}

/**
 * Checks if a course is referenced as a prerequisite by other courses
 */
export async function getCoursesUsingAsPrerequisite(
  db: DatabaseReader,
  courseCode: string
): Promise<Id<"courses">[]> {
  const allCourses = await db.query("courses").collect();
  const dependentCourses: Id<"courses">[] = [];

  for (const course of allCourses) {
    if (course.prerequisites.includes(courseCode)) {
      dependentCourses.push(course._id);
    }
  }

  return dependentCourses;
}

