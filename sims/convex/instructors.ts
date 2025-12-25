/**
 * Instructor Queries
 * 
 * Provides queries for instructor dashboard and class roster management.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "./lib/session";

/**
 * Get instructor dashboard data
 * Returns sections where instructorId matches current user and term is current
 * For each section, includes: course.title, currentEnrollment, capacity, and schedule
 */
export const getDashboard = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
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

    // Verify role is instructor
    if (!user.roles.includes("instructor")) {
      throw new Error("Access denied: Instructor role required");
    }

    // Get current term (term that includes today's date)
    const now = Date.now();
    const currentTerm = await ctx.db
      .query("terms")
      .filter((q) =>
        q.and(
          q.lte(q.field("startDate"), now),
          q.gte(q.field("endDate"), now)
        )
      )
      .first();

    // If no current term, try to get the next upcoming term
    let effectiveTerm = currentTerm;
    if (!effectiveTerm) {
      const allTerms = await ctx.db.query("terms").collect();
      const upcomingTerms = allTerms
        .filter((term) => term.startDate > now)
        .sort((a, b) => a.startDate - b.startDate);
      
      if (upcomingTerms.length > 0) {
        effectiveTerm = upcomingTerms[0];
      }
    }

    if (!effectiveTerm) {
      return [];
    }

    // Get sections for this instructor in the current/next term
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_instructorId", (q) => q.eq("instructorId", userId))
      .filter((q) => q.eq(q.field("termId"), effectiveTerm._id))
      .collect();

    // Enrich sections with course information and format schedule
    const sectionsWithDetails = await Promise.all(
      sections.map(async (section) => {
        const course = await ctx.db.get(section.courseId);
        
        // Format schedule from scheduleSlots
        const scheduleParts: string[] = [];
        for (const slot of section.scheduleSlots) {
          scheduleParts.push(`${slot.day} ${slot.startTime}-${slot.endTime}`);
        }
        const schedule = scheduleParts.length > 0 ? scheduleParts.join(", ") : "TBA";

        return {
          _id: section._id,
          courseTitle: course?.title || "Unknown Course",
          courseCode: course?.code || "N/A",
          currentEnrollment: section.enrollmentCount,
          capacity: section.capacity,
          schedule,
          scheduleSlots: section.scheduleSlots,
        };
      })
    );

    return sectionsWithDetails;
  },
});

/**
 * Get class roster for a section
 * Input: sectionId
 * Returns: List of students (Name, ID, Email) enrolled in that section
 */
export const getRoster = query({
  args: {
    sectionId: v.id("sections"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
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

    // Verify role is instructor
    if (!user.roles.includes("instructor")) {
      throw new Error("Access denied: Instructor role required");
    }

    // Get section and verify instructor owns it
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    if (section.instructorId !== userId) {
      throw new Error("Access denied: You can only view rosters for your own sections");
    }

    // Get all enrollments for this section
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "enrolled"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    // Get student details for each enrollment
    const roster = await Promise.all(
      enrollments.map(async (enrollment) => {
        const student = await ctx.db.get(enrollment.studentId);
        if (!student) {
          return null;
        }

        const studentUser = await ctx.db.get(student.userId);
        if (!studentUser) {
          return null;
        }

        return {
          studentId: student._id,
          userId: studentUser._id,
          name: `${studentUser.profile.firstName} ${studentUser.profile.lastName}`.trim(),
          email: studentUser.email,
          studentNumber: student.studentNumber,
        };
      })
    );

    // Filter out null values and sort by name
    const validRoster = roster
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return validRoster;
  },
});

