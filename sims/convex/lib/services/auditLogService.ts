/**
 * Audit Log Service
 * 
 * Service for creating audit log entries for system events.
 * 
 * All Key Events Logged:
 * - StudentEnrolled
 * - StudentDropped
 * - StudentCreated
 * - StudentUpdated
 * - CourseGradePosted
 * - GradeEdited
 * - CourseCreated
 * - CourseUpdated
 * - SectionCreated
 * - SectionUpdated
 * - SectionCancelled
 * - ProgramCreated
 * - ProgramUpdated
 * - AssessmentCreated
 * - AssessmentUpdated
 * - GraduationApproved
 * - UserRoleChanged
 * - TranscriptGenerated
 */

import { DatabaseWriter } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  entity: string; // Entity type (e.g., "enrollment", "grade", "user")
  entityId?: string; // ID of the affected entity
  action: string; // Action performed (e.g., "StudentEnrolled", "GradeEdited")
  userId: Id<"users">; // User who performed the action
  timestamp: number; // Unix timestamp
  details: Record<string, unknown>; // Relevant details (e.g., { "previousGrade": "A", "newGrade": "B" })
}

/**
 * Creates an audit log entry
 * 
 * @param db Database writer
 * @param entity Entity type (e.g., "enrollment", "grade", "user")
 * @param action Action performed (e.g., "StudentEnrolled", "GradeEdited")
 * @param userId User who performed the action
 * @param entityId Optional ID of the affected entity
 * @param details Optional details about the action
 */
export async function createAuditLog(
  db: DatabaseWriter,
  entity: string,
  action: string,
  userId: Id<"users">,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return await db.insert("auditLogs", {
    entity,
    action,
    userId,
    timestamp: Date.now(),
    details: {
      ...(entityId && { entityId }),
      ...(details || {}),
    },
  });
}

/**
 * Convenience functions for common audit events
 */

export async function logStudentEnrolled(
  db: DatabaseWriter,
  userId: Id<"users">,
  enrollmentId: Id<"enrollments">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "enrollment",
    "StudentEnrolled",
    userId,
    enrollmentId,
    details
  );
}

export async function logStudentDropped(
  db: DatabaseWriter,
  userId: Id<"users">,
  enrollmentId: Id<"enrollments">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "enrollment",
    "StudentDropped",
    userId,
    enrollmentId,
    details
  );
}

export async function logCourseGradePosted(
  db: DatabaseWriter,
  userId: Id<"users">,
  gradeId: Id<"grades">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "grade",
    "CourseGradePosted",
    userId,
    gradeId,
    details
  );
}

export async function logGradeEdited(
  db: DatabaseWriter,
  userId: Id<"users">,
  gradeId: Id<"grades">,
  previousGrade: string,
  newGrade: string,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "grade",
    "GradeEdited",
    userId,
    gradeId,
    {
      previousGrade,
      newGrade,
      ...details,
    }
  );
}

export async function logGraduationApproved(
  db: DatabaseWriter,
  userId: Id<"users">,
  graduationId: Id<"graduationRecords">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "graduation",
    "GraduationApproved",
    userId,
    graduationId,
    details
  );
}

export async function logSectionCancelled(
  db: DatabaseWriter,
  userId: Id<"users">,
  sectionId: Id<"sections">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "section",
    "SectionCancelled",
    userId,
    sectionId,
    details
  );
}

export async function logUserRoleChanged(
  db: DatabaseWriter,
  userId: Id<"users">,
  targetUserId: Id<"users">,
  previousRoles: string[],
  newRoles: string[],
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "user",
    "UserRoleChanged",
    userId,
    targetUserId,
    {
      previousRoles,
      newRoles,
      ...details,
    }
  );
}

export async function logStudentCreated(
  db: DatabaseWriter,
  userId: Id<"users">,
  studentId: Id<"students">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "student",
    "StudentCreated",
    userId,
    studentId,
    details
  );
}

export async function logStudentUpdated(
  db: DatabaseWriter,
  userId: Id<"users">,
  studentId: Id<"students">,
  previousStatus?: string,
  newStatus?: string,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "student",
    "StudentUpdated",
    userId,
    studentId,
    {
      ...(previousStatus && { previousStatus }),
      ...(newStatus && { newStatus }),
      ...details,
    }
  );
}

export async function logCourseCreated(
  db: DatabaseWriter,
  userId: Id<"users">,
  courseId: Id<"courses">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "course",
    "CourseCreated",
    userId,
    courseId,
    details
  );
}

export async function logCourseUpdated(
  db: DatabaseWriter,
  userId: Id<"users">,
  courseId: Id<"courses">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "course",
    "CourseUpdated",
    userId,
    courseId,
    details
  );
}

export async function logSectionCreated(
  db: DatabaseWriter,
  userId: Id<"users">,
  sectionId: Id<"sections">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "section",
    "SectionCreated",
    userId,
    sectionId,
    details
  );
}

export async function logSectionUpdated(
  db: DatabaseWriter,
  userId: Id<"users">,
  sectionId: Id<"sections">,
  previousCapacity?: number,
  newCapacity?: number,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "section",
    "SectionUpdated",
    userId,
    sectionId,
    {
      ...(previousCapacity !== undefined && { previousCapacity }),
      ...(newCapacity !== undefined && { newCapacity }),
      ...details,
    }
  );
}

export async function logProgramCreated(
  db: DatabaseWriter,
  userId: Id<"users">,
  programId: Id<"programs">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "program",
    "ProgramCreated",
    userId,
    programId,
    details
  );
}

export async function logProgramUpdated(
  db: DatabaseWriter,
  userId: Id<"users">,
  programId: Id<"programs">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "program",
    "ProgramUpdated",
    userId,
    programId,
    details
  );
}

export async function logAssessmentCreated(
  db: DatabaseWriter,
  userId: Id<"users">,
  assessmentId: Id<"assessments">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "assessment",
    "AssessmentCreated",
    userId,
    assessmentId,
    details
  );
}

export async function logAssessmentUpdated(
  db: DatabaseWriter,
  userId: Id<"users">,
  assessmentId: Id<"assessments">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "assessment",
    "AssessmentUpdated",
    userId,
    assessmentId,
    details
  );
}

export async function logTranscriptGenerated(
  db: DatabaseWriter,
  userId: Id<"users">,
  transcriptId: Id<"transcripts">,
  details?: Record<string, unknown>
): Promise<Id<"auditLogs">> {
  return createAuditLog(
    db,
    "transcript",
    "TranscriptGenerated",
    userId,
    transcriptId,
    details
  );
}

