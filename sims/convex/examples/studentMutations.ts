/**
 * Example Mutations Using Aggregate Validation
 * 
 * This file demonstrates how to use the aggregate validation functions
 * in Convex mutations. These are examples - adapt them to your needs.
 * 
 * For transactional operations that span multiple aggregates, see:
 * ../mutations/enrollmentMutations.ts
 * ../mutations/gradeMutations.ts
 * ../mutations/graduationMutations.ts
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  validateCreateStudent,
  validateUpdateStudent,
  validateStudentCanEnroll,
  InvariantViolationError,
  NotFoundError,
  ValidationError,
} from "../lib/aggregates";
import { logStudentCreated, logStudentUpdated } from "../lib/services/auditLogService";

/**
 * Example: Create a new student
 * 
 * This mutation demonstrates:
 * - Validating invariants before creation
 * - Error handling
 * - Atomic transaction (Convex mutations are atomic by default)
 */
export const createStudent = mutation({
  args: {
    userId: v.id("users"),
    studentNumber: v.string(),
    programId: v.id("programs"),
    level: v.string(),
    status: v.string(),
    createdByUserId: v.id("users"), // User performing the action (admin/registrar)
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateStudent(
      ctx.db,
      args.userId,
      args.studentNumber,
      args.programId,
      args.status as "active" | "suspended" | "graduated" | "inactive"
    );

    // If validation passes, create the student
    const studentId = await ctx.db.insert("students", {
      userId: args.userId,
      studentNumber: args.studentNumber,
      admissionYear: new Date().getFullYear(),
      programId: args.programId,
      level: args.level,
      status: args.status,
    });

    // Create audit log
    await logStudentCreated(
      ctx.db,
      args.createdByUserId,
      studentId,
      {
        userId: args.userId,
        studentNumber: args.studentNumber,
        programId: args.programId,
        level: args.level,
        status: args.status,
        admissionYear: new Date().getFullYear(),
      }
    );

    return studentId;
  },
});

/**
 * Example: Update student status
 * 
 * This mutation demonstrates:
 * - Validating status transitions
 * - Updating related entities atomically
 */
export const updateStudentStatus = mutation({
  args: {
    studentId: v.id("students"),
    newStatus: v.string(),
    updatedByUserId: v.id("users"), // User performing the action
  },
  handler: async (ctx, args) => {
    // Get current student to capture previous status
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new NotFoundError("Student", args.studentId);
    }

    const previousStatus = student.status;

    // Validate the status update
    await validateUpdateStudent(
      ctx.db,
      args.studentId,
      args.newStatus as "active" | "suspended" | "graduated" | "inactive"
    );

    // Update the student
    await ctx.db.patch(args.studentId, {
      status: args.newStatus,
    });

    // Create audit log
    await logStudentUpdated(
      ctx.db,
      args.updatedByUserId,
      args.studentId,
      previousStatus,
      args.newStatus,
      {
        studentNumber: student.studentNumber,
      }
    );

    return { success: true };
  },
});

/**
 * Example: Enroll student in a section
 * 
 * This mutation demonstrates:
 * - Validating student can enroll (status check)
 * - Validating section capacity
 * - Atomic enrollment and capacity update
 */
export const enrollStudent = mutation({
  args: {
    studentId: v.id("students"),
    sectionId: v.id("sections"),
    termId: v.id("terms"),
  },
  handler: async (ctx, args) => {
    // Import enrollment validations
    const { validateCreateEnrollment, validateSectionCanEnroll } = await import(
      "../lib/aggregates"
    );

    // Validate student can enroll
    await validateStudentCanEnroll(ctx.db, args.studentId);

    // Validate section has capacity
    await validateSectionCanEnroll(ctx.db, args.sectionId);

    // Validate enrollment invariants
    await validateCreateEnrollment(
      ctx.db,
      args.studentId,
      args.sectionId,
      args.termId,
      "enrolled"
    );

    // Get section to update enrollment count
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Create enrollment and update section capacity atomically
    const enrollmentId = await ctx.db.insert("enrollments", {
      studentId: args.studentId,
      sectionId: args.sectionId,
      sessionId: section.sessionId,
      termId: args.termId,
      status: "enrolled",
      enrolledAt: Date.now(),
    });

    // Update enrollment count
    await ctx.db.patch(args.sectionId, {
      enrollmentCount: section.enrollmentCount + 1,
    });

    return enrollmentId;
  },
});

/**
 * Example: Error handling wrapper
 * 
 * This demonstrates a pattern for consistent error handling
 */
function handleDomainErrors(error: unknown): never {
  if (error instanceof InvariantViolationError) {
    // Log for monitoring
    const invariantError = error as InvariantViolationError;
    console.error(`[${invariantError.aggregate}] ${invariantError.invariant}:`, invariantError.message);
    // Return user-friendly error
    throw new Error(`Business rule violation: ${invariantError.message}`);
  } else if (error instanceof NotFoundError) {
    const notFoundError = error as NotFoundError;
    throw new Error(`Not found: ${notFoundError.message}`);
  } else if (error instanceof ValidationError) {
    const validationError = error as ValidationError;
    throw new Error(`Validation failed: ${validationError.message}`);
  }
  // Re-throw unknown errors
  throw error;
}

/**
 * Example: Create student with error handling
 */
export const createStudentWithErrorHandling = mutation({
  args: {
    userId: v.id("users"),
    studentNumber: v.string(),
    programId: v.id("programs"),
    level: v.string(),
    status: v.string(),
    createdByUserId: v.id("users"), // User performing the action
  },
  handler: async (ctx, args) => {
    try {
      await validateCreateStudent(
        ctx.db,
        args.userId,
        args.studentNumber,
        args.programId,
        args.status as "active" | "suspended" | "graduated" | "inactive"
      );

      const studentId = await ctx.db.insert("students", {
        userId: args.userId,
        studentNumber: args.studentNumber,
        admissionYear: new Date().getFullYear(),
        programId: args.programId,
        level: args.level,
        status: args.status,
      });

      // Create audit log
      await logStudentCreated(
        ctx.db,
        args.createdByUserId,
        studentId,
        {
          userId: args.userId,
          studentNumber: args.studentNumber,
          programId: args.programId,
          level: args.level,
          status: args.status,
          admissionYear: new Date().getFullYear(),
        }
      );

      return { success: true, studentId };
    } catch (error) {
      handleDomainErrors(error);
    }
  },
});

