/**
 * Scheduling Service
 * 
 * Domain logic for scheduling operations including room and time assignment
 * for sections, with conflict detection for instructors and rooms.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError } from "../errors";
import { ScheduleSlotSpec } from "../aggregates/types";

/**
 * Checks if two schedule slots overlap
 */
function slotsOverlap(slot1: ScheduleSlotSpec, slot2: ScheduleSlotSpec): boolean {
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
 * Checks for instructor schedule conflicts
 */
export async function checkInstructorConflicts(
  db: DatabaseReader,
  instructorId: Id<"users">,
  termId: Id<"terms">,
  scheduleSlots: ScheduleSlotSpec[],
  excludeSectionId?: Id<"sections">
): Promise<void> {
  // Get all sections taught by this instructor in the same term
  const sections = await db
    .query("sections")
    .withIndex("by_instructorId", (q) => q.eq("instructorId", instructorId))
    .collect();

  const termSections = sections.filter(
    (s) => s.termId === termId && s._id !== excludeSectionId
  );

  const conflicts: string[] = [];

  for (const section of termSections) {
    for (const newSlot of scheduleSlots) {
      for (const existingSlot of section.scheduleSlots) {
        if (slotsOverlap(newSlot, existingSlot)) {
          const course = await db.get(section.courseId);
          conflicts.push(
            `${course?.code || "Unknown"} - ${existingSlot.day} ${existingSlot.startTime}-${existingSlot.endTime}`
          );
        }
      }
    }
  }

  if (conflicts.length > 0) {
    throw new InvariantViolationError(
      "SchedulingService",
      "Instructor Conflict Check",
      `Instructor has schedule conflicts: ${conflicts.join(", ")}`
    );
  }
}

/**
 * Checks for room schedule conflicts
 */
export async function checkRoomConflicts(
  db: DatabaseReader,
  termId: Id<"terms">,
  scheduleSlots: ScheduleSlotSpec[],
  excludeSectionId?: Id<"sections">
): Promise<void> {
  // Get all sections in the same term
  const sections = await db
    .query("sections")
    .withIndex("by_termId", (q) => q.eq("termId", termId))
    .collect();

  const relevantSections = excludeSectionId
    ? sections.filter((s) => s._id !== excludeSectionId)
    : sections;

  const conflicts: string[] = [];

  for (const section of relevantSections) {
    for (const newSlot of scheduleSlots) {
      for (const existingSlot of section.scheduleSlots) {
        // Check if same room and overlapping time
        if (newSlot.room === existingSlot.room && slotsOverlap(newSlot, existingSlot)) {
          const course = await db.get(section.courseId);
          conflicts.push(
            `Room ${newSlot.room} - ${course?.code || "Unknown"} on ${existingSlot.day} ${existingSlot.startTime}-${existingSlot.endTime}`
          );
        }
      }
    }
  }

  if (conflicts.length > 0) {
    throw new InvariantViolationError(
      "SchedulingService",
      "Room Conflict Check",
      `Room conflicts detected: ${conflicts.join("; ")}`
    );
  }
}

/**
 * Validates schedule assignment (checks both instructor and room conflicts)
 */
export async function validateScheduleAssignment(
  db: DatabaseReader,
  instructorId: Id<"users">,
  termId: Id<"terms">,
  scheduleSlots: ScheduleSlotSpec[],
  excludeSectionId?: Id<"sections">
): Promise<void> {
  // Validate schedule slots are valid
  for (const slot of scheduleSlots) {
    if (parseTime(slot.startTime) >= parseTime(slot.endTime)) {
      throw new InvariantViolationError(
        "SchedulingService",
        "Schedule Validation",
        `Invalid time range for ${slot.day}: ${slot.startTime} must be before ${slot.endTime}`
      );
    }
  }

  // Check instructor conflicts
  await checkInstructorConflicts(db, instructorId, termId, scheduleSlots, excludeSectionId);

  // Check room conflicts
  await checkRoomConflicts(db, termId, scheduleSlots, excludeSectionId);
}

/**
 * Finds available rooms for a given time slot
 */
export async function findAvailableRooms(
  db: DatabaseReader,
  termId: Id<"terms">,
  day: string,
  startTime: string,
  endTime: string
): Promise<string[]> {
  // Get all sections in the term
  const sections = await db
    .query("sections")
    .withIndex("by_termId", (q) => q.eq("termId", termId))
    .collect();

  // Extract all rooms used during this time slot
  const occupiedRooms = new Set<string>();
  const slot: ScheduleSlotSpec = { day, startTime, endTime, room: "" };

  for (const section of sections) {
    for (const existingSlot of section.scheduleSlots) {
      if (slotsOverlap(slot, existingSlot)) {
        occupiedRooms.add(existingSlot.room);
      }
    }
  }

  // In a real system, you'd have a rooms collection
  // For now, return a placeholder indicating rooms are available
  // You would query a rooms collection and filter out occupied ones
  return []; // Placeholder - implement based on your rooms collection
}

