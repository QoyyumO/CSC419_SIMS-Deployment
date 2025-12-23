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

  // Get student's transcript
  const transcript = await db
    .query("transcripts")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .first();

  if (!transcript) {
    throw new InvariantViolationError(
      "EnrollmentService",
      "Prerequisites Check",
      "Student does not have a transcript. Cannot verify prerequisites."
    );
  }

  // Get completed course codes from transcript
  const completedCourseCodes = new Set(
    transcript.entries
      .filter((entry) => {
        // Consider a course completed if grade is passing (points >= 1.0 or letter grade is D or better)
        return entry.grade.points >= 1.0 || ["A", "B", "C", "D"].includes(entry.grade.letter);
      })
      .map((entry) => entry.courseCode)
  );

  // Check each prerequisite (now stored as course codes)
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

  const activeEnrollments = enrollments.filter(
    (e) =>
      e.status === "enrolled" &&
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
          conflicts.push(
            `${course?.code || "Unknown"} (${existingSlot.day} ${existingSlot.startTime}-${existingSlot.endTime})`
          );
        }
      }
    }
  }

  if (conflicts.length > 0) {
    throw new InvariantViolationError(
      "EnrollmentService",
      "Schedule Conflict Check",
      `Schedule conflicts with: ${conflicts.join(", ")}`
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

