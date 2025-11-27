/**
 * Graduation Service
 * 
 * Domain logic for graduation operations including degree audit.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { TranscriptEntry, Course } from "../aggregates/types";

/**
 * Result of a degree audit
 */
export interface DegreeAuditResult {
  eligible: boolean;
  missingRequirements: string[];
  totalCredits: number;
  requiredCredits: number;
  gpa: number;
  requiredGPA: number;
}

/**
 * Runs a degree audit to check if a student meets all program requirements
 */
export async function runDegreeAudit(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<DegreeAuditResult> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  const program = await db.get(student.programId);
  if (!program) {
    throw new NotFoundError("Program", student.programId);
  }

  // Get student's transcript
  const transcript = await db
    .query("transcripts")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .first();

  if (!transcript) {
    throw new InvariantViolationError(
      "GraduationService",
      "Degree Audit",
      "Student does not have a transcript"
    );
  }

  const missingRequirements: string[] = [];
  const requirements = program.requirements || {};

  // Check minimum credits
  const totalCredits = transcript.entries.reduce(
    (sum: number, entry: TranscriptEntry) => sum + entry.credits,
    0
  );
  const requiredCredits = requirements.minCredits || 120;

  if (totalCredits < requiredCredits) {
    missingRequirements.push(
      `Insufficient credits: ${totalCredits}/${requiredCredits}`
    );
  }

  // Check minimum GPA
  const requiredGPA = requirements.minGPA || 2.0;
  if (transcript.gpa < requiredGPA) {
    missingRequirements.push(
      `GPA below minimum: ${transcript.gpa.toFixed(2)}/${requiredGPA}`
    );
  }

  // Check required courses if specified
  if (requirements.requiredCourses && Array.isArray(requirements.requiredCourses)) {
    const completedCourseCodes = new Set(
      transcript.entries
        .filter((entry) => {
          // Consider a course completed if grade is passing
          return entry.grade.points >= 1.0 || ["A", "B", "C", "D"].includes(entry.grade.letter);
        })
        .map((entry) => entry.courseCode)
    );

    for (const requiredCourseId of requirements.requiredCourses) {
      const requiredCourse = await db.get(requiredCourseId as Id<"courses">);
      if (!requiredCourse) {
        continue; // Skip if course doesn't exist
      }

      const course = requiredCourse as Course;
      if (!completedCourseCodes.has(course.code)) {
        missingRequirements.push(`Missing required course: ${course.code}`);
      }
    }
  }

  // Check for incomplete enrollments
  const incompleteEnrollments = await db
    .query("enrollments")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .filter((q) => q.eq(q.field("status"), "enrolled"))
    .collect();

  if (incompleteEnrollments.length > 0) {
    missingRequirements.push(
      `Student has ${incompleteEnrollments.length} incomplete enrollment(s)`
    );
  }

  const eligible = missingRequirements.length === 0;

  return {
    eligible,
    missingRequirements,
    totalCredits,
    requiredCredits,
    gpa: transcript.gpa,
    requiredGPA,
  };
}

/**
 * Validates that all program requirements are satisfied
 */
export async function validateProgramRequirements(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<void> {
  const auditResult = await runDegreeAudit(db, studentId);

  if (!auditResult.eligible) {
    throw new InvariantViolationError(
      "GraduationService",
      "Program Requirements Validation",
      `Student does not meet graduation requirements: ${auditResult.missingRequirements.join("; ")}`
    );
  }
}

