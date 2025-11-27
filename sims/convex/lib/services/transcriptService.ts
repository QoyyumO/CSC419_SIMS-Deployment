/**
 * Transcript Service
 * 
 * Domain logic for transcript operations including generation,
 * grade snapshotting, and GPA computation.
 */

import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import {
  Transcript,
  TranscriptEntry,
  GradeValue,
} from "../aggregates/types";

/**
 * Calculates cumulative GPA from transcript entries
 * Formula: GPA = Σ(grade.points × credits) / Σ(credits)
 */
export function calculateCumulativeGPA(entries: TranscriptEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  let totalPoints = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    totalPoints += entry.grade.points * entry.credits;
    totalCredits += entry.credits;
  }

  if (totalCredits === 0) {
    return 0;
  }

  const gpa = totalPoints / totalCredits;
  // Round to 2 decimal places
  return Math.round(gpa * 100) / 100;
}

/**
 * Creates a transcript entry from a completed enrollment
 */
export async function createTranscriptEntry(
  db: DatabaseReader,
  enrollmentId: Id<"enrollments">,
  term: string,
  year: number
): Promise<TranscriptEntry> {
  const enrollment = await db.get(enrollmentId);
  if (!enrollment) {
    throw new NotFoundError("Enrollment", enrollmentId);
  }

  if (enrollment.status !== "completed") {
    throw new InvariantViolationError(
      "TranscriptService",
      "Entry Creation",
      "Cannot create transcript entry for enrollment that is not completed"
    );
  }

  const section = await db.get(enrollment.sectionId);
  if (!section) {
    throw new NotFoundError("Section", enrollment.sectionId);
  }

  const course = await db.get(section.courseId);
  if (!course) {
    throw new NotFoundError("Course", section.courseId);
  }

  // Get all assessments and grades to calculate final grade
  const assessments = await db
    .query("assessments")
    .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
    .collect();

  const grades = await db
    .query("grades")
    .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollmentId))
    .collect();

  // Calculate final grade (weighted average)
  let totalWeightedPoints = 0;
  let totalWeight = 0;

  for (const assessment of assessments) {
    const grade = grades.find((g) => g.assessmentId === assessment._id);
    if (!grade) {
      throw new InvariantViolationError(
        "TranscriptService",
        "Entry Creation",
        `Missing grade for assessment: ${assessment.title}`
      );
    }

    const assessmentPercentage = (grade.grade.numeric / 100) * assessment.weight;
    totalWeightedPoints += assessmentPercentage;
    totalWeight += assessment.weight;
  }

  if (Math.abs(totalWeight - 100) > 0.01) {
    throw new InvariantViolationError(
      "TranscriptService",
      "Entry Creation",
      `Assessment weights sum to ${totalWeight}%, expected 100%`
    );
  }

  const finalPercentage = Math.round(totalWeightedPoints * 100) / 100;
  const finalGrade: GradeValue = {
    numeric: finalPercentage,
    letter: convertPercentageToLetter(finalPercentage),
    points: convertPercentageToPoints(finalPercentage),
  };

  return {
    courseCode: course.code,
    courseTitle: course.title,
    credits: course.credits,
    grade: finalGrade,
    term,
    year,
  };
}

/**
 * Converts percentage to letter grade
 */
function convertPercentageToLetter(percentage: number): string {
  if (percentage >= 90) return "A";
  if (percentage >= 80) return "B";
  if (percentage >= 70) return "C";
  if (percentage >= 60) return "D";
  return "F";
}

/**
 * Converts percentage to grade points
 */
function convertPercentageToPoints(percentage: number): number {
  if (percentage >= 90) return 4.0;
  if (percentage >= 80) return 3.0;
  if (percentage >= 70) return 2.0;
  if (percentage >= 60) return 1.0;
  return 0.0;
}

/**
 * Generates an official transcript for a student
 * This creates a snapshot of grades at a point in time
 */
export async function generateOfficialTranscript(
  db: DatabaseReader,
  studentId: Id<"students">,
  generatedBy: Id<"users">,
  format: string = "pdf"
): Promise<Transcript> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }

  // Get or create transcript
  let transcript = await db
    .query("transcripts")
    .withIndex("by_studentId", (q) => q.eq("studentId", studentId))
    .first();

  if (!transcript) {
    // Create new transcript if it doesn't exist
    const transcriptId = await (db as DatabaseWriter).insert("transcripts", {
      studentId,
      entries: [],
      gpa: 0,
    });
    transcript = await db.get(transcriptId);
    if (!transcript) {
      throw new Error("Failed to create transcript");
    }
  }

  // Recalculate GPA from current entries
  const gpa = calculateCumulativeGPA(transcript.entries);

  // Update transcript with metadata
  const updatedTranscript: Transcript = {
    ...transcript,
    gpa,
    metadata: {
      generatedBy,
      generatedAt: Date.now(),
      format,
    },
  };

  return updatedTranscript;
}

/**
 * Adds a completed enrollment to the transcript
 */
export async function addEnrollmentToTranscript(
  db: DatabaseWriter,
  transcriptId: Id<"transcripts">,
  enrollmentId: Id<"enrollments">,
  term: string,
  year: number
): Promise<void> {
  const transcript = await db.get(transcriptId);
  if (!transcript) {
    throw new NotFoundError("Transcript", transcriptId);
  }

  // Create transcript entry
  const entry = await createTranscriptEntry(
    db,
    enrollmentId,
    term,
    year
  );

  // Add entry to transcript
  const updatedEntries = [...transcript.entries, entry];
  const newGPA = calculateCumulativeGPA(updatedEntries);

  // Update transcript
  await db.patch(transcriptId, {
    entries: updatedEntries,
    gpa: newGPA,
  });
}

/**
 * Snapshots grades at a point in time for transcript generation
 * This ensures transcript entries are immutable once added
 */
export function snapshotGradesForTranscript(
  entries: TranscriptEntry[]
): TranscriptEntry[] {
  // Return a deep copy to ensure immutability
  return entries.map((entry) => ({
    ...entry,
    grade: { ...entry.grade },
  }));
}

