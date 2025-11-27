/**
 * Aggregate Validation Functions - Main Export
 * 
 * This module exports all aggregate validation functions for use in mutations.
 * 
 * Usage in mutations:
 * ```typescript
 * import { validateCreateStudent } from "./lib/aggregates";
 * 
 * export const createStudent = mutation({
 *   handler: async (ctx, args) => {
 *     await validateCreateStudent(ctx.db, ...);
 *     // Proceed with creation
 *   }
 * });
 * ```
 */

// School Aggregate
export * from "./schoolAggregate";

// Program Aggregate
export * from "./programAggregate";

// Course Aggregate
export * from "./courseAggregate";

// Section Aggregate
export * from "./sectionAggregate";

// Student Aggregate
export * from "./studentAggregate";

// Enrollment Aggregate
export * from "./enrollmentAggregate";

// User Aggregate
export * from "./userAggregate";

// Transcript Aggregate
export * from "./transcriptAggregate";

// Academic Calendar Aggregate
export * from "./academicCalendarAggregate";

// Graduation Aggregate
export * from "./graduationAggregate";

// Types
export * from "./types";

// Errors
export {
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from "../errors";

