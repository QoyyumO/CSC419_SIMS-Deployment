/**
 * Enrollment Service
 * 
 * Domain logic for enrollment operations including prerequisite checks
 * and schedule conflict detection.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { ScheduleSlotSpec } from "../aggregates/types";

/**
 * Checks if a student has completed all prerequisites for a course
 * Checks past enrollments with status === 'completed' and passing grades
 */
export async function checkPrerequisites(
  db: DatabaseReader,
  studentId: Id<"students">,
  courseId: Id<"courses">
): Promise<void> {
  const course = await db.get(courseId);
  if (!course) {
    throw new NotFoundError("Course", courseId);
  }

  if (course.prerequisites.length === 0) {
    return; // No prerequisites
  }

  // Get student's past enrollments with status === 'completed'
  const allEnrollments = await db
    .query("enrollments")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .collect();

  const completedEnrollments = allEnrollments.filter(
    (e) => e.status === "completed"
  );

  // Get completed course codes from enrollments
  const completedCourseCodes = new Set<string>();

  for (const enrollment of completedEnrollments) {
    const enrolledSection = await db.get(enrollment.sectionId);
    if (!enrolledSection) {
      continue;
    }

    const enrolledCourse = await db.get(enrolledSection.courseId);
    if (!enrolledCourse) {
      continue;
    }

    // Check if grade is passing
    // Consider passing if:
    // - grade field exists and is not "F" or failing
    // - grade is "A", "B", "C", "D" or numeric >= 60
    const isPassing = enrollment.grade
      ? !["F", "f", "Fail", "FAIL"].includes(enrollment.grade) &&
        (["A", "B", "C", "D", "a", "b", "c", "d"].includes(enrollment.grade) ||
          (parseFloat(enrollment.grade) >= 60))
      : true; // If no grade recorded, assume passing (completed status implies completion)

    if (isPassing) {
      completedCourseCodes.add(enrolledCourse.code);
    }
  }

  // Check each prerequisite (stored as course codes)
  const missingPrerequisites: string[] = [];

  for (const prereqCode of course.prerequisites) {
    if (!completedCourseCodes.has(prereqCode)) {
      missingPrerequisites.push(prereqCode);
    }
  }

  if (missingPrerequisites.length > 0) {
    throw new InvariantViolationError(
      "EnrollmentService",
      "Prerequisites Check",
      `Missing prerequisites: ${missingPrerequisites.join(", ")}`
    );
  }
}

/**
 * Checks if a section's schedule conflicts with student's existing enrollments
 */
export async function checkScheduleConflicts(
  db: DatabaseReader,
  studentId: Id<"students">,
  sectionId: Id<"sections">,
  excludeEnrollmentId?: Id<"enrollments">
): Promise<void> {
  const newSection = await db.get(sectionId);
  if (!newSection) {
    throw new NotFoundError("Section", sectionId);
  }

  // Get all active enrollments for the student in the same term
  const enrollments = await db
    .query("enrollments")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .collect();

  // Get active enrollments for the current term (status === 'active' or 'enrolled')
  const activeEnrollments = enrollments.filter(
    (e) =>
      (e.status === "active" || e.status === "enrolled") &&
      e.termId === newSection.termId &&
      e._id !== excludeEnrollmentId
  );

    // Check for schedule conflicts
    const conflicts: string[] = [];

    for (const enrollment of activeEnrollments) {
      const existingSection = await db.get(enrollment.sectionId);
      if (!existingSection) {
        continue;
      }

      // Check if any schedule slots overlap
      for (const newSlot of newSection.scheduleSlots) {
        for (const existingSlot of existingSection.scheduleSlots) {
          if (slotsConflict(newSlot, existingSlot)) {
            const course = await db.get(existingSection.courseId);
            const conflictTime = `${existingSlot.day} ${existingSlot.startTime}-${existingSlot.endTime}`;
            conflicts.push(
              `${course?.code || "Unknown"} on ${conflictTime}`
            );
            break; // Only add one conflict per existing section
          }
        }
      }
    }

    if (conflicts.length > 0) {
      const conflictMessage = conflicts.length === 1
        ? conflicts[0]
        : conflicts.join(", ");
      throw new InvariantViolationError(
        "EnrollmentService",
        "Schedule Conflict Check",
        `Schedule conflicts with: ${conflictMessage}`
      );
    }
}

/**
 * Helper function to check if two schedule slots conflict
 */
function slotsConflict(slot1: ScheduleSlotSpec, slot2: ScheduleSlotSpec): boolean {
  // Only check if they're on the same day
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
 * Helper function to parse time string to minutes since midnight
 */
function parseTime(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1] || "0", 10);
  return hours * 60 + minutes;
}

/**
 * Checks if enrollment deadline has passed
 * Reads from settings table or uses a default constant
 */
export async function checkEnrollmentDeadline(
  db: DatabaseReader
): Promise<void> {
  // Try to get enrollment deadline from settings table
  const deadlineSetting = await db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "enrollmentDeadline"))
    .first();

  let enrollmentDeadline: number;

  if (deadlineSetting && typeof deadlineSetting.value === "number") {
    enrollmentDeadline = deadlineSetting.value;
  } else {
    // Default: 2 weeks before term start (fallback constant)
    // For now, we'll use a default of 30 days from now
    // In production, this should be set per term
    enrollmentDeadline = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
  }

  const now = Date.now();

  if (now > enrollmentDeadline) {
    const deadlineDate = new Date(enrollmentDeadline);
    throw new InvariantViolationError(
      "EnrollmentService",
      "Enrollment Deadline Check",
      `Enrollment deadline has passed. Deadline was: ${deadlineDate.toLocaleDateString()}`
    );
  }
}

/**
 * Performs all domain checks for enrollment
 */
export async function validateEnrollmentDomainChecks(
  db: DatabaseReader,
  studentId: Id<"students">,
  sectionId: Id<"sections">
): Promise<void> {
  const section = await db.get(sectionId);
  if (!section) {
    throw new NotFoundError("Section", sectionId);
  }

  // Check prerequisites
  await checkPrerequisites(db, studentId, section.courseId);

  // Check schedule conflicts
  await checkScheduleConflicts(db, studentId, sectionId);
}

