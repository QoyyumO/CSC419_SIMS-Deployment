/**
 * Enrollment Mutations
 * 
 * Transactional operations for student enrollment.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import {
  validateStudentCanEnroll,
  validateSectionCanEnroll,
  NotFoundError,
} from "../lib/aggregates";
import {
  validateEnrollmentDomainChecks,
} from "../lib/services/enrollmentService";
import { logStudentEnrolled, logStudentDropped } from "../lib/services/auditLogService";

/**
 * Operation: Enroll Student in a Section
 * 
 * This is a transactional operation that:
 * 1. Validates student can enroll (status check)
 * 2. Validates section has capacity
 * 3. Performs domain checks (prerequisites, schedule conflicts)
 * 4. Creates enrollment
 * 5. Updates section enrollment count
 * 6. Creates audit log
 * 
 * All steps are atomic - if any step fails, the entire transaction is rolled back.
 */
export const enrollStudentInSection = mutation({
  args: {
    studentId: v.id("students"),
    sectionId: v.id("sections"),
  },
  handler: async (ctx, args) => {
    // Step 1: Read and validate student aggregate
    // Invariant Check: Student status must be "active"
    await validateStudentCanEnroll(ctx.db, args.studentId);

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new NotFoundError("Student", args.studentId);
    }

    // Step 2: Read and validate section aggregate
    // Invariant Check: enrollmentCount must be less than capacity
    await validateSectionCanEnroll(ctx.db, args.sectionId);

    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Step 3: Domain checks (prerequisites, schedule conflicts)
    await validateEnrollmentDomainChecks(ctx.db, args.studentId, args.sectionId);

    // Step 4: Create enrollment document
    const enrollmentId = await ctx.db.insert("enrollments", {
      studentId: args.studentId,
      sectionId: args.sectionId,
      sessionId: section.sessionId,
      termId: section.termId,
      status: "enrolled",
      enrolledAt: Date.now(),
    });

    // Step 5: Increment section enrollment count
    await ctx.db.patch(args.sectionId, {
      enrollmentCount: section.enrollmentCount + 1,
    });

    // Step 6: Create audit log entry
    // Note: We need a userId for audit log - using student.userId as the actor
    // In a real system, you might get this from authentication context
    await logStudentEnrolled(
      ctx.db,
      student.userId,
      enrollmentId,
      {
        studentId: args.studentId,
        sectionId: args.sectionId,
        courseId: section.courseId,
        termId: section.termId,
      }
    );

    return {
      success: true,
      enrollmentId,
      enrollmentCount: section.enrollmentCount + 1,
    };
  },
});

/**
 * Drop enrollment (withdrawal)
 * 
 * Transactional operation to drop a student from a section.
 */
export const dropEnrollment = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    userId: v.id("users"), // User performing the action (student or admin)
  },
  handler: async (ctx, args) => {
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new NotFoundError("Enrollment", args.enrollmentId);
    }

    // Check if enrollment can be dropped (not already dropped/completed)
    if (enrollment.status === "dropped" || enrollment.status === "completed") {
      throw new Error(`Cannot drop enrollment with status: ${enrollment.status}`);
    }

    const section = await ctx.db.get(enrollment.sectionId);
    if (!section) {
      throw new NotFoundError("Section", enrollment.sectionId);
    }

    // Update enrollment status
    await ctx.db.patch(args.enrollmentId, {
      status: "dropped",
    });

    // Decrement section enrollment count
    await ctx.db.patch(enrollment.sectionId, {
      enrollmentCount: Math.max(0, section.enrollmentCount - 1),
    });

    // Create audit log
    await logStudentDropped(
      ctx.db,
      args.userId,
      args.enrollmentId,
      {
        studentId: enrollment.studentId,
        sectionId: enrollment.sectionId,
      }
    );

    return { success: true };
  },
});

