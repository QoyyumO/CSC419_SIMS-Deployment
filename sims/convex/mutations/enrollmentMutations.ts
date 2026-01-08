/**
 * Enrollment Mutations
 * 
 * Transactional operations for student enrollment.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  validateStudentCanEnroll,
  validateSectionCanEnroll,
  NotFoundError,
} from "../lib/aggregates";
import {
  validateEnrollmentDomainChecks,
  checkPrerequisites,
  checkScheduleConflicts,
} from "../lib/services/enrollmentService";
import { logStudentEnrolled, logStudentDropped } from "../lib/services/auditLogService";
import { validateSessionToken } from "../lib/session";
import { sendEnrollmentConfirmation } from "../lib/services/notificationService";

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

    // send confirmation notification (fire-and-forget)
    try {
      sendEnrollmentConfirmation(ctx.db, enrollmentId);
    } catch (e) {
      console.error("Failed to send enrollment confirmation notification", e);
    }

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
 * Enroll current student in a section
 * 
 * Simplified enrollment mutation that:
 * 1. Gets student from authenticated user (via token)
 * 2. Atomically checks if section has capacity
 * 3. Prevents duplicate enrollment in same course/term
 * 4. Creates enrollment with status 'active'
 * 5. Increments section enrollment count
 * 
 * Input: sectionId (and optional token for authentication)
 */
export const enroll = mutation({
  args: {
    sectionId: v.id("sections"),
    token: v.optional(v.string()), // Session token for authentication
    joinWaitlist: v.optional(v.boolean()), // If true, join waitlist even if section is full
  },
  handler: async (ctx, args) => {
    // Step 1: Authenticate and get student
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify user is a student
    if (!user.roles.includes("student")) {
      throw new Error("Only students can enroll in sections");
    }

    // Get student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!student) {
      throw new Error("Student record not found");
    }

    // Step 2: Get and validate section
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Step 3: Business Rule Validations (must be done before capacity check)
    // 3a. Check if section is open for enrollment
    if (!section.isOpenForEnrollment) {
      throw new Error("This section is not open for enrollment");
    }

    // 3b. Check section-specific enrollment deadline
    if (section.enrollmentDeadline) {
      const now = Date.now();
      if (now > section.enrollmentDeadline) {
        // Deadline has passed, update section status and prevent enrollment
        await ctx.db.patch(args.sectionId, {
          isOpenForEnrollment: false,
        });
        throw new Error("Enrollment deadline has passed for this section");
      }
    }

    // 3c. Check prerequisites (using past enrollments with status === 'completed')
    await checkPrerequisites(ctx.db, student._id, section.courseId);

    // 3c. Check time conflicts with active enrollments for current term
    await checkScheduleConflicts(ctx.db, student._id, args.sectionId);

    // Step 4: Check if section is full
    const isFull = section.enrollmentCount >= section.capacity;
    
    // If section is full and user hasn't confirmed waitlist, throw error
    if (isFull && !args.joinWaitlist) {
      throw new Error("Section Full");
    }

    // Step 5: Check if student is already enrolled in any section of this course for the same term
    const existingEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .collect();

    // Check for duplicate enrollment in same course and term
    for (const enrollment of existingEnrollments) {
      const enrolledSection = await ctx.db.get(enrollment.sectionId);
      if (
        enrolledSection &&
        enrolledSection.courseId === section.courseId &&
        enrolledSection.termId === section.termId &&
        (enrollment.status === "active" || enrollment.status === "enrolled" || enrollment.status === "waitlisted")
      ) {
        throw new Error("You have already enrolled for this course.");
      }
    }

    // Step 6: Get term name for enrollment record
    const term = await ctx.db.get(section.termId);
    const termName = term ? term.name : undefined;

    // Step 7: Determine enrollment status
    // If section is full and user wants to join waitlist, set status to 'waitlisted'
    // Otherwise, set status to 'active'
    const enrollmentStatus = (isFull && args.joinWaitlist) ? "waitlisted" : "active";

    // Step 8: Create enrollment document
    const enrollmentId = await ctx.db.insert("enrollments", {
      studentId: student._id,
      sectionId: args.sectionId,
      sessionId: section.sessionId,
      termId: section.termId,
      status: enrollmentStatus,
      enrolledAt: Date.now(),
      term: termName,
    });

    // Step 9: Increment section enrollment count only if not waitlisted
    if (enrollmentStatus !== "waitlisted") {
      await ctx.db.patch(args.sectionId, {
        enrollmentCount: section.enrollmentCount + 1,
      });
    }

    return {
      success: true,
      enrollmentId,
      enrollmentCount: enrollmentStatus === "waitlisted" ? section.enrollmentCount : section.enrollmentCount + 1,
      status: enrollmentStatus,
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

    // Only decrement section enrollment count if the enrollment was active/enrolled (not waitlisted)
    const wasActive = enrollment.status === "active" || enrollment.status === "enrolled";
    let newEnrollmentCount = section.enrollmentCount;
    
    if (wasActive) {
      newEnrollmentCount = Math.max(0, section.enrollmentCount - 1);
      await ctx.db.patch(enrollment.sectionId, {
        enrollmentCount: newEnrollmentCount,
      });
    }

    // Auto-promote: Find the first person on the waitlist (sorted by _creationTime)
    if (wasActive) {
      const waitlistedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_sectionId", (q) => q.eq("sectionId", enrollment.sectionId))
        .filter((q) => q.eq(q.field("status"), "waitlisted"))
        .collect();

      // Sort by _creationTime (oldest first)
      waitlistedEnrollments.sort((a, b) => a._creationTime - b._creationTime);

      // Promote the first waitlisted student if any
      if (waitlistedEnrollments.length > 0) {
        const firstWaitlisted = waitlistedEnrollments[0];
        
        // Update waitlisted enrollment to active
        await ctx.db.patch(firstWaitlisted._id, {
          status: "active",
        });

        // Increment section enrollment count
        newEnrollmentCount = newEnrollmentCount + 1;
        await ctx.db.patch(enrollment.sectionId, {
          enrollmentCount: newEnrollmentCount,
        });
      }
    }

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

/**
 * Drop course enrollment for current student
 * 
 * Simplified drop mutation that:
 * 1. Gets student from authenticated user (via token)
 * 2. Drops the enrollment
 * 3. Decrements section enrollment count (if was active)
 * 4. Auto-promotes first waitlisted student
 * 
 * Input: enrollmentId (and optional token for authentication)
 */
export const dropCourse = mutation({
  args: {
    enrollmentId: v.id("enrollments"),
    token: v.optional(v.string()), // Session token for authentication
  },
  handler: async (ctx, args) => {
    // Step 1: Authenticate and get student
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify user is a student
    if (!user.roles.includes("student")) {
      throw new Error("Only students can drop courses");
    }

    // Get student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!student) {
      throw new Error("Student record not found");
    }

    // Step 2: Get enrollment and verify it belongs to the student
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment) {
      throw new NotFoundError("Enrollment", args.enrollmentId);
    }

    // Verify the enrollment belongs to the authenticated student
    if (enrollment.studentId !== student._id) {
      throw new Error("You can only drop your own enrollments");
    }

    // Check if enrollment can be dropped (not already dropped/completed)
    if (enrollment.status === "dropped" || enrollment.status === "completed") {
      throw new Error(`Cannot drop enrollment with status: ${enrollment.status}`);
    }

    const section = await ctx.db.get(enrollment.sectionId);
    if (!section) {
      throw new NotFoundError("Section", enrollment.sectionId);
    }

    // Step 3: Update enrollment status to dropped
    await ctx.db.patch(args.enrollmentId, {
      status: "dropped",
    });

    // Step 4: Only decrement section enrollment count if the enrollment was active/enrolled (not waitlisted)
    const wasActive = enrollment.status === "active" || enrollment.status === "enrolled";
    let newEnrollmentCount = section.enrollmentCount;
    
    if (wasActive) {
      newEnrollmentCount = Math.max(0, section.enrollmentCount - 1);
      await ctx.db.patch(enrollment.sectionId, {
        enrollmentCount: newEnrollmentCount,
      });
    }

    // Step 5: Auto-promote: Find the first person on the waitlist (sorted by _creationTime)
    let promotedEnrollmentId: Id<"enrollments"> | null = null;
    if (wasActive) {
      const waitlistedEnrollments = await ctx.db
        .query("enrollments")
        .withIndex("by_sectionId", (q) => q.eq("sectionId", enrollment.sectionId))
        .filter((q) => q.eq(q.field("status"), "waitlisted"))
        .collect();

      // Sort by _creationTime (oldest first)
      waitlistedEnrollments.sort((a, b) => a._creationTime - b._creationTime);

      // Promote the first waitlisted student if any
      if (waitlistedEnrollments.length > 0) {
        const firstWaitlisted = waitlistedEnrollments[0];
        promotedEnrollmentId = firstWaitlisted._id;
        
        // Update waitlisted enrollment to active
        await ctx.db.patch(firstWaitlisted._id, {
          status: "active",
        });

        // Increment section enrollment count
        newEnrollmentCount = newEnrollmentCount + 1;
        await ctx.db.patch(enrollment.sectionId, {
          enrollmentCount: newEnrollmentCount,
        });
      }
    }

    // Step 6: Create audit log
    await logStudentDropped(
      ctx.db,
      userId,
      args.enrollmentId,
      {
        studentId: enrollment.studentId,
        sectionId: enrollment.sectionId,
      }
    );

    return { 
      success: true,
      promotedEnrollmentId: promotedEnrollmentId,
    };
  },
});

