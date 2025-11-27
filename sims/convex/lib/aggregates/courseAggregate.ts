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
  prerequisites: Id<"courses">[]
): Promise<void> {
  for (const prereqId of prerequisites) {
    const course = await db.get(prereqId);
    if (!course) {
      throw new InvariantViolationError(
        "CourseAggregate",
        "Prerequisite Validity",
        `Prerequisite course with id '${prereqId}' does not exist`
      );
    }
  }
}

/**
 * Validates that prerequisites don't create circular dependencies
 * Uses a simple check: a course cannot be a prerequisite of itself
 */
export function validateNoCircularPrerequisites(
  courseId: Id<"courses">,
  prerequisites: Id<"courses">[]
): void {
  if (prerequisites.includes(courseId)) {
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
  prerequisites: Id<"courses">[]
): Promise<void> {
  await validateCourseCodeUniqueness(db, code);
  validateCreditValue(credits);
  await validateCoursePrerequisites(db, prerequisites);
  
  // Note: Circular dependency check requires the course ID, which we don't have yet
  // This will be checked after creation or in a separate validation step
}

/**
 * Validates all invariants for updating a course
 */
export async function validateUpdateCourse(
  db: DatabaseReader,
  courseId: Id<"courses">,
  code?: string,
  credits?: number,
  prerequisites?: Id<"courses">[]
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
    validateNoCircularPrerequisites(courseId, prerequisites);
    await validateCoursePrerequisites(db, prerequisites);
  }
}

/**
 * Checks if a course is referenced as a prerequisite by other courses
 */
export async function getCoursesUsingAsPrerequisite(
  db: DatabaseReader,
  courseId: Id<"courses">
): Promise<Id<"courses">[]> {
  const allCourses = await db.query("courses").collect();
  const dependentCourses: Id<"courses">[] = [];

  for (const course of allCourses) {
    if (course.prerequisites.includes(courseId)) {
      dependentCourses.push(course._id);
    }
  }

  return dependentCourses;
}

