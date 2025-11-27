/**
 * AcademicCalendarAggregate Invariant Validation
 * 
 * Enforces invariants for the AcademicCalendar aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError } from "../errors";

/**
 * Validates term date validity
 */
export function validateTermDates(startDate: number, endDate: number): void {
  if (startDate >= endDate) {
    throw new InvariantViolationError(
      "AcademicCalendarAggregate",
      "Term Date Validity",
      `Start date (${new Date(startDate).toISOString()}) must be before end date (${new Date(endDate).toISOString()})`
    );
  }
}

/**
 * Checks if two date ranges overlap
 */
function datesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Validates that terms don't overlap within a session
 */
export async function validateNoOverlappingTerms(
  db: DatabaseReader,
  sessionId: Id<"academicSessions">,
  termStartDate: number,
  termEndDate: number,
  excludeTermId?: Id<"terms">
): Promise<void> {
  const existingTerms = await db
    .query("terms")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .collect();

  for (const term of existingTerms) {
    if (excludeTermId && term._id === excludeTermId) {
      continue;
    }

    if (
      datesOverlap(
        term.startDate,
        term.endDate,
        termStartDate,
        termEndDate
      )
    ) {
      throw new InvariantViolationError(
        "AcademicCalendarAggregate",
        "Non-Overlapping Terms",
        `Term dates overlap with existing term '${term.name}' (${new Date(term.startDate).toISOString()} - ${new Date(term.endDate).toISOString()})`
      );
    }
  }
}

/**
 * Validates session label uniqueness
 */
export async function validateSessionLabelUniqueness(
  db: DatabaseReader,
  label: string,
  excludeId?: Id<"academicSessions">
): Promise<void> {
  const existing = await db
    .query("academicSessions")
    .withIndex("by_label", (q) => q.eq("label", label))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "AcademicCalendarAggregate",
      "Session Label Uniqueness",
      `Academic session with label '${label}' already exists`
    );
  }
}

/**
 * Validates session association for a term
 */
export async function validateTermSession(
  db: DatabaseReader,
  sessionId: Id<"academicSessions">
): Promise<void> {
  const session = await db.get(sessionId);
  if (!session) {
    throw new NotFoundError("AcademicSession", sessionId);
  }
}

/**
 * Validates all invariants for creating an academic session
 */
export async function validateCreateAcademicSession(
  db: DatabaseReader,
  label: string
): Promise<void> {
  await validateSessionLabelUniqueness(db, label);
}

/**
 * Validates all invariants for updating an academic session
 */
export async function validateUpdateAcademicSession(
  db: DatabaseReader,
  sessionId: Id<"academicSessions">,
  label?: string
): Promise<void> {
  const session = await db.get(sessionId);
  if (!session) {
    throw new NotFoundError("AcademicSession", sessionId);
  }

  if (label && label !== session.label) {
    await validateSessionLabelUniqueness(db, label, sessionId);
  }
}

/**
 * Validates all invariants for creating a term
 */
export async function validateCreateTerm(
  db: DatabaseReader,
  sessionId: Id<"academicSessions">,
  name: string,
  startDate: number,
  endDate: number
): Promise<void> {
  await validateTermSession(db, sessionId);
  validateTermDates(startDate, endDate);
  await validateNoOverlappingTerms(db, sessionId, startDate, endDate);
}

/**
 * Validates all invariants for updating a term
 */
export async function validateUpdateTerm(
  db: DatabaseReader,
  termId: Id<"terms">,
  startDate?: number,
  endDate?: number
): Promise<void> {
  const term = await db.get(termId);
  if (!term) {
    throw new NotFoundError("Term", termId);
  }

  const finalStartDate = startDate ?? term.startDate;
  const finalEndDate = endDate ?? term.endDate;

  validateTermDates(finalStartDate, finalEndDate);
  await validateNoOverlappingTerms(
    db,
    term.sessionId,
    finalStartDate,
    finalEndDate,
    termId
  );
}

