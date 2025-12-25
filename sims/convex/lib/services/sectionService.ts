/**
 * Section Service
 * 
 * Domain logic for section operations including enrollment deadline management.
 */

import { DatabaseWriter, DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

/**
 * Checks if enrollment deadline has passed and updates isOpenForEnrollment accordingly
 * 
 * @param db Database writer
 * @param sectionId Section ID to check
 * @returns true if section is open for enrollment, false otherwise
 */
export async function checkAndUpdateEnrollmentStatus(
  db: DatabaseWriter,
  sectionId: Id<"sections">
): Promise<boolean> {
  const section = await db.get(sectionId);
  if (!section) {
    return false;
  }

  // If no deadline is set, don't change the status
  if (!section.enrollmentDeadline) {
    return section.isOpenForEnrollment ?? false;
  }

  const now = Date.now();
  const deadlinePassed = now > section.enrollmentDeadline;

  // If deadline has passed and section is still open, close it
  if (deadlinePassed && section.isOpenForEnrollment) {
    await db.patch(sectionId, {
      isOpenForEnrollment: false,
    });
    return false;
  }

  // If deadline hasn't passed but section is closed, don't automatically open it
  // (section must be explicitly published)
  return section.isOpenForEnrollment ?? false;
}

/**
 * Checks if enrollment deadline has passed (read-only check)
 * 
 * @param db Database reader
 * @param sectionId Section ID to check
 * @returns true if deadline has passed, false otherwise
 */
export async function isEnrollmentDeadlinePassed(
  db: DatabaseReader,
  sectionId: Id<"sections">
): Promise<boolean> {
  const section = await db.get(sectionId);
  if (!section || !section.enrollmentDeadline) {
    return false;
  }

  const now = Date.now();
  return now > section.enrollmentDeadline;
}

/**
 * Updates all sections with passed enrollment deadlines
 * This can be called periodically or from a scheduled function
 * 
 * @param db Database writer
 * @returns Number of sections updated
 */
export async function updateExpiredEnrollmentDeadlines(
  db: DatabaseWriter
): Promise<number> {
  const now = Date.now();
  let updatedCount = 0;

  // Get all sections that are open for enrollment and have a deadline
  const sections = await db
    .query("sections")
    .filter((q) => 
      q.and(
        q.eq(q.field("isOpenForEnrollment"), true),
        q.neq(q.field("enrollmentDeadline"), undefined)
      )
    )
    .collect();

  for (const section of sections) {
    if (section.enrollmentDeadline && now > section.enrollmentDeadline) {
      await db.patch(section._id, {
        isOpenForEnrollment: false,
      });
      updatedCount++;
    }
  }

  return updatedCount;
}

