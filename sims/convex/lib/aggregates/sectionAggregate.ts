/**
 * SectionAggregate Invariant Validation
 * 
 * Enforces invariants for the Section aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { ScheduleSlotSpec, UserRole } from "./types";

/**
 * Validates enrollment capacity constraint
 */
export function validateEnrollmentCapacity(
  enrollmentCount: number,
  capacity: number
): void {
  if (enrollmentCount > capacity) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Enrollment Capacity",
      `Enrollment count (${enrollmentCount}) exceeds capacity (${capacity})`
    );
  }
}

/**
 * Validates that enrollment count doesn't exceed capacity when enrolling
 */
export async function validateSectionCanEnroll(
  db: DatabaseReader,
  sectionId: Id<"sections">
): Promise<void> {
  const section = await db.get(sectionId);
  if (!section) {
    throw new NotFoundError("Section", sectionId);
  }

  if (section.enrollmentCount >= section.capacity) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Enrollment Capacity",
      `Section is at full capacity (${section.capacity}/${section.capacity})`
    );
  }
}

/**
 * Validates that capacity update doesn't violate enrollment count
 */
export function validateCapacityUpdate(
  currentEnrollmentCount: number,
  newCapacity: number
): void {
  if (newCapacity < currentEnrollmentCount) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Enrollment Capacity",
      `New capacity (${newCapacity}) cannot be less than current enrollment count (${currentEnrollmentCount})`
    );
  }
}

/**
 * Validates that assessment weights sum to 100%
 */
export async function validateAssessmentWeights(
  db: DatabaseReader,
  sectionId: Id<"sections">,
  excludeAssessmentId?: Id<"assessments">
): Promise<void> {
  const assessments = await db
    .query("assessments")
    .withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId))
    .collect();

  // Filter out the assessment being updated/deleted
  const relevantAssessments = excludeAssessmentId
    ? assessments.filter((a) => a._id !== excludeAssessmentId)
    : assessments;

  const totalWeight = relevantAssessments.reduce(
    (sum, assessment) => sum + assessment.weight,
    0
  );

  // Allow for small floating point differences (0.01 tolerance)
  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Assessment Weight Totals",
      `Total assessment weight (${totalWeight}%) must equal 100%`
    );
  }
}

/**
 * Validates schedule slot time ranges
 */
export function validateScheduleSlot(slot: ScheduleSlotSpec): void {
  // Parse times (assuming format like "HH:MM" or "HH:MM:SS")
  const start = parseTime(slot.startTime);
  const end = parseTime(slot.endTime);

  if (start >= end) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Schedule Slot Validity",
      `Start time (${slot.startTime}) must be before end time (${slot.endTime})`
    );
  }
}

/**
 * Validates that schedule slots don't overlap
 */
export function validateNoOverlappingSlots(slots: ScheduleSlotSpec[]): void {
  for (let i = 0; i < slots.length; i++) {
    validateScheduleSlot(slots[i]);

    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) {
        throw new InvariantViolationError(
          "SectionAggregate",
          "Schedule Slot Validity",
          `Schedule slots overlap: ${slots[i].day} ${slots[i].startTime}-${slots[i].endTime} and ${slots[j].day} ${slots[j].startTime}-${slots[j].endTime}`
        );
      }
    }
  }
}

/**
 * Helper function to parse time string to minutes since midnight
 */
function parseTime(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return hours * 60 + minutes;
}

/**
 * Checks if two schedule slots overlap
 */
function slotsOverlap(slot1: ScheduleSlotSpec, slot2: ScheduleSlotSpec): boolean {
  // Only check overlap if they're on the same day
  if (slot1.day !== slot2.day) {
    return false;
  }

  const start1 = parseTime(slot1.startTime);
  const end1 = parseTime(slot1.endTime);
  const start2 = parseTime(slot2.startTime);
  const end2 = parseTime(slot2.endTime);

  // Check if time ranges overlap
  return start1 < end2 && start2 < end1;
}

/**
 * Validates instructor has appropriate role
 */
export async function validateInstructorRole(
  db: DatabaseReader,
  instructorId: Id<"users">
): Promise<void> {
  const user = await db.get(instructorId);
  if (!user) {
    throw new NotFoundError("User", instructorId);
  }

  const validRoles: UserRole[] = ["instructor", "admin", "department_head"];
  const hasValidRole = (user.roles as UserRole[]).some((role: UserRole) => validRoles.includes(role));

  if (!hasValidRole) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Instructor Assignment",
      `User '${instructorId}' does not have a valid instructor role. Required roles: ${validRoles.join(", ")}`
    );
  }
}

/**
 * Validates all invariants for creating a section
 */
export async function validateCreateSection(
  db: DatabaseReader,
  courseId: Id<"courses">,
  termId: Id<"terms">,
  instructorId: Id<"users">,
  capacity: number,
  scheduleSlots: ScheduleSlotSpec[]
): Promise<void> {
  // Validate references exist
  const course = await db.get(courseId);
  if (!course) {
    throw new NotFoundError("Course", courseId);
  }

  const term = await db.get(termId);
  if (!term) {
    throw new NotFoundError("Term", termId);
  }

  await validateInstructorRole(db, instructorId);

  // Validate capacity
  if (capacity <= 0) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Enrollment Capacity",
      "Capacity must be greater than 0"
    );
  }

  // Validate schedule slots
  validateNoOverlappingSlots(scheduleSlots);
}

/**
 * Validates all invariants for updating a section
 */
export async function validateUpdateSection(
  db: DatabaseReader,
  sectionId: Id<"sections">,
  capacity?: number,
  scheduleSlots?: ScheduleSlotSpec[],
  instructorId?: Id<"users">
): Promise<void> {
  const section = await db.get(sectionId);
  if (!section) {
    throw new NotFoundError("Section", sectionId);
  }

  if (capacity !== undefined) {
    validateCapacityUpdate(section.enrollmentCount, capacity);
  }

  if (scheduleSlots) {
    validateNoOverlappingSlots(scheduleSlots);
  }

  if (instructorId) {
    await validateInstructorRole(db, instructorId);
  }
}

/**
 * Validates assessment can be created/updated without violating weight constraint
 */
export async function validateAssessmentWeight(
  db: DatabaseReader,
  sectionId: Id<"sections">,
  newWeight: number,
  excludeAssessmentId?: Id<"assessments">
): Promise<void> {
  if (newWeight < 0 || newWeight > 100) {
    throw new InvariantViolationError(
      "SectionAggregate",
      "Assessment Weight Totals",
      `Assessment weight (${newWeight}%) must be between 0 and 100`
    );
  }

  // Get existing assessments
  const assessments = await db
    .query("assessments")
    .withIndex("by_sectionId", (q) => q.eq("sectionId", sectionId))
    .collect();

  const relevantAssessments = excludeAssessmentId
    ? assessments.filter((a) => a._id !== excludeAssessmentId)
    : assessments;

  const currentTotal = relevantAssessments.reduce(
    (sum, a) => sum + a.weight,
    0
  );

  const newTotal = currentTotal + newWeight;

  if (newTotal > 100.01) {
    // Allow small floating point tolerance
    throw new InvariantViolationError(
      "SectionAggregate",
      "Assessment Weight Totals",
      `Adding this assessment would make total weight ${newTotal}%, exceeding 100%`
    );
  }
}

