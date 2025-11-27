/**
 * TranscriptAggregate Invariant Validation
 * 
 * Enforces invariants for the Transcript aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";
import { Transcript, TranscriptEntry } from "./types";

/**
 * Calculates GPA from transcript entries
 * Formula: GPA = Σ(grade.points × credits) / Σ(credits)
 */
export function calculateGPA(entries: TranscriptEntry[]): number {
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
 * Validates GPA matches calculated value
 */
export function validateGPA(transcript: Transcript): void {
  const calculatedGPA = calculateGPA(transcript.entries);
  const storedGPA = transcript.gpa;

  // Allow small floating point differences (0.01 tolerance)
  if (Math.abs(calculatedGPA - storedGPA) > 0.01) {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "GPA Calculation Accuracy",
      `Stored GPA (${storedGPA}) does not match calculated GPA (${calculatedGPA})`
    );
  }
}

/**
 * Validates transcript entry data
 */
export function validateTranscriptEntry(entry: TranscriptEntry): void {
  if (!entry.courseCode || entry.courseCode.trim() === "") {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "Entry Validity",
      "Transcript entry must have a course code"
    );
  }

  if (entry.credits <= 0) {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "Entry Validity",
      "Transcript entry credits must be positive"
    );
  }

  if (entry.grade.points < 0 || entry.grade.points > 4) {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "Entry Validity",
      `Grade points (${entry.grade.points}) must be between 0 and 4`
    );
  }
}

/**
 * Validates student association
 */
export async function validateTranscriptStudent(
  db: DatabaseReader,
  studentId: Id<"students">
): Promise<void> {
  const student = await db.get(studentId);
  if (!student) {
    throw new NotFoundError("Student", studentId);
  }
}

/**
 * Validates metadata if present
 */
export async function validateMetadata(
  db: DatabaseReader,
  metadata?: { generatedBy?: Id<"users">; generatedAt?: number; format?: string }
): Promise<void> {
  if (!metadata) return;

  if (metadata.generatedBy) {
    const user = await db.get(metadata.generatedBy);
    if (!user) {
      throw new NotFoundError("User", metadata.generatedBy);
    }
  }

  if (metadata.generatedAt && metadata.generatedAt < 0) {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "Metadata Consistency",
      "GeneratedAt timestamp must be valid"
    );
  }
}

/**
 * Validates all invariants for creating a transcript
 */
export async function validateCreateTranscript(
  db: DatabaseReader,
  studentId: Id<"students">,
  entries: TranscriptEntry[],
  gpa: number,
  metadata?: { generatedBy?: Id<"users">; generatedAt?: number; format?: string }
): Promise<void> {
  await validateTranscriptStudent(db, studentId);

  for (const entry of entries) {
    validateTranscriptEntry(entry);
  }

  const calculatedGPA = calculateGPA(entries);
  if (Math.abs(calculatedGPA - gpa) > 0.01) {
    throw new InvariantViolationError(
      "TranscriptAggregate",
      "GPA Calculation Accuracy",
      `Provided GPA (${gpa}) does not match calculated GPA (${calculatedGPA})`
    );
  }

  await validateMetadata(db, metadata);
}

/**
 * Validates all invariants for adding an entry to a transcript
 * Note: Entries are immutable once added, so this is for new entries only
 */
export async function validateAddTranscriptEntry(
  db: DatabaseReader,
  transcriptId: Id<"transcripts">,
  newEntry: TranscriptEntry
): Promise<void> {
  const transcript = await db.get(transcriptId);
  if (!transcript) {
    throw new NotFoundError("Transcript", transcriptId);
  }

  validateTranscriptEntry(newEntry);

  // Note: The caller should calculate and update the GPA in the same transaction
  // using: const newGPA = calculateGPA([...transcript.entries, newEntry]);
}

/**
 * Recalculates and validates GPA for a transcript
 */
export async function recalculateAndValidateGPA(
  db: DatabaseReader,
  transcriptId: Id<"transcripts">
): Promise<number> {
  const transcript = await db.get(transcriptId);
  if (!transcript) {
    throw new NotFoundError("Transcript", transcriptId);
  }

  const calculatedGPA = calculateGPA(transcript.entries);
  validateGPA({ ...transcript, gpa: calculatedGPA });

  return calculatedGPA;
}

