/**
 * SchoolAggregate Invariant Validation
 * 
 * Enforces invariants for the School aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";

/**
 * Validates that a department belongs to a valid school
 */
export async function validateDepartmentOwnership(
  db: DatabaseReader,
  schoolId: Id<"schools">
): Promise<void> {
  const school = await db.get(schoolId);
  if (!school) {
    throw new NotFoundError("School", schoolId);
  }
}

/**
 * Validates school name uniqueness
 */
export async function validateSchoolNameUniqueness(
  db: DatabaseReader,
  name: string,
  excludeId?: Id<"schools">
): Promise<void> {
  const existing = await db
    .query("schools")
    .withIndex("by_name", (q) => q.eq("name", name))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "SchoolAggregate",
      "School Name Uniqueness",
      `School with name '${name}' already exists`
    );
  }
}

/**
 * Validates all invariants for creating a school
 */
export async function validateCreateSchool(
  db: DatabaseReader,
  name: string
): Promise<void> {
  await validateSchoolNameUniqueness(db, name);
}

/**
 * Validates all invariants for updating a school
 */
export async function validateUpdateSchool(
  db: DatabaseReader,
  schoolId: Id<"schools">,
  name?: string
): Promise<void> {
  const school = await db.get(schoolId);
  if (!school) {
    throw new NotFoundError("School", schoolId);
  }

  if (name && name !== school.name) {
    await validateSchoolNameUniqueness(db, name, schoolId);
  }
}

/**
 * Validates that a school can be deleted (checks for dependent departments)
 * Returns the count of departments that would be affected
 */
export async function validateDeleteSchool(
  db: DatabaseReader,
  schoolId: Id<"schools">
): Promise<number> {
  const school = await db.get(schoolId);
  if (!school) {
    throw new NotFoundError("School", schoolId);
  }

  // Count departments that belong to this school
  const departments = await db
    .query("departments")
    .withIndex("by_schoolId", (q) => q.eq("schoolId", schoolId))
    .collect();

  return departments.length;
}

