/**
 * Section Mutations
 * 
 * Transactional operations for section management.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError } from "../lib/errors";
import { validateCreateSection, validateUpdateSection } from "../lib/aggregates";
import { logSectionCancelled, logSectionCreated, logSectionUpdated } from "../lib/services/auditLogService";

/**
 * Create a new section
 */
export const createSection = mutation({
  args: {
    courseId: v.id("courses"),
    sessionId: v.id("academicSessions"),
    termId: v.id("terms"),
    instructorId: v.id("users"),
    capacity: v.number(),
    scheduleSlots: v.array(
      v.object({
        day: v.string(),
        startTime: v.string(),
        endTime: v.string(),
        room: v.string(),
      })
    ),
    createdByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateSection(
      ctx.db,
      args.courseId,
      args.termId,
      args.instructorId,
      args.capacity,
      args.scheduleSlots
    );

    // Create the section
    const sectionId = await ctx.db.insert("sections", {
      courseId: args.courseId,
      sessionId: args.sessionId,
      termId: args.termId,
      instructorId: args.instructorId,
      capacity: args.capacity,
      scheduleSlots: args.scheduleSlots,
      enrollmentCount: 0,
    });

    // Create audit log
    await logSectionCreated(
      ctx.db,
      args.createdByUserId,
      sectionId,
      {
        courseId: args.courseId,
        sessionId: args.sessionId,
        termId: args.termId,
        instructorId: args.instructorId,
        capacity: args.capacity,
        scheduleSlotsCount: args.scheduleSlots.length,
      }
    );

    return { success: true, sectionId };
  },
});

/**
 * Update an existing section
 */
export const updateSection = mutation({
  args: {
    sectionId: v.id("sections"),
    capacity: v.optional(v.number()),
    scheduleSlots: v.optional(
      v.array(
        v.object({
          day: v.string(),
          startTime: v.string(),
          endTime: v.string(),
          room: v.string(),
        })
      )
    ),
    instructorId: v.optional(v.id("users")),
    updatedByUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Get current section to capture previous values
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    const previousCapacity = section.capacity;

    // Validate all invariants before updating
    await validateUpdateSection(
      ctx.db,
      args.sectionId,
      args.capacity,
      args.scheduleSlots,
      args.instructorId
    );

    // Build update object with only provided fields
    const updates: {
      capacity?: number;
      scheduleSlots?: typeof args.scheduleSlots;
      instructorId?: typeof args.instructorId;
    } = {};

    if (args.capacity !== undefined) updates.capacity = args.capacity;
    if (args.scheduleSlots !== undefined) updates.scheduleSlots = args.scheduleSlots;
    if (args.instructorId !== undefined) updates.instructorId = args.instructorId;

    // Update the section
    await ctx.db.patch(args.sectionId, updates);

    // Create audit log
    await logSectionUpdated(
      ctx.db,
      args.updatedByUserId,
      args.sectionId,
      previousCapacity,
      args.capacity ?? previousCapacity,
      {
        courseId: section.courseId,
        termId: section.termId,
        previousInstructorId: section.instructorId,
        newInstructorId: args.instructorId ?? section.instructorId,
        scheduleSlotsChanged: args.scheduleSlots !== undefined,
        previousScheduleSlotsCount: section.scheduleSlots.length,
        newScheduleSlotsCount: args.scheduleSlots?.length ?? section.scheduleSlots.length,
      }
    );

    return { success: true };
  },
});

/**
 * Cancel a section
 * 
 * This operation:
 * 1. Validates section exists
 * 2. Updates section status (if you have a status field)
 * 3. Notifies enrolled students (would be done via notification service)
 * 4. Creates audit log
 */
export const cancelSection = mutation({
  args: {
    sectionId: v.id("sections"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Get enrolled students count
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .filter((q) => q.eq(q.field("status"), "enrolled"))
      .collect();

    // In a real system, you might:
    // 1. Update section status to "cancelled"
    // 2. Notify all enrolled students
    // 3. Handle refunds or transfers
    // For now, we'll just create the audit log

    // Create audit log
    await logSectionCancelled(
      ctx.db,
      args.userId,
      args.sectionId,
      {
        reason: args.reason,
        enrolledStudentsCount: enrollments.length,
        courseId: section.courseId,
        termId: section.termId,
      }
    );

    return {
      success: true,
      affectedEnrollments: enrollments.length,
    };
  },
});

