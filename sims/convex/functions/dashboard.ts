/**
 * Dashboard Queries
 * 
 * Provides queries for admin dashboard statistics and activity logs.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "../lib/session";
import { computeFinalGrade } from "../lib/services/gradingService";

/**
 * Get dashboard statistics
 * Returns counts of total users, students, and instructors
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    
    const totalUsers = allUsers.length;
    const students = allUsers.filter((user) => user.roles.includes("student")).length;
    const instructors = allUsers.filter((user) => user.roles.includes("instructor")).length;
    
    return {
      totalUsers,
      students,
      instructors,
    };
  },
});

/**
 * Get recent activity from audit logs
 * Returns the 5 most recent entries ordered by timestamp (descending)
 */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const allLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .collect();
    
    // Sort by timestamp descending and take the 5 most recent
    const recentLogs = allLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    
    // Fetch user details for each log entry
    const activitiesWithUsers = await Promise.all(
      recentLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          _id: log._id,
          entity: log.entity,
          action: log.action,
          userId: log.userId,
          userEmail: user?.email || "Unknown",
          userName: user?.profile
            ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
            : "Unknown User",
          timestamp: log.timestamp,
          details: log.details,
        };
      })
    );
    
    return activitiesWithUsers;
  },
});

/**
 * Get student statistics and dashboard data
 * Returns student profile, academic stats (GPA, credits earned), and current schedule
 */
export const getStudentStats = query({
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

    // Verify role is student
    if (!user.roles.includes("student")) {
      throw new Error("Access denied: Student role required");
    }

    // Get student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!student) {
      throw new Error("Student record not found");
    }

    // Get department information
    const department = await ctx.db.get(student.departmentId);

    // Get current term
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

    // Get current session
    let currentSession = null;
    if (currentTerm) {
      currentSession = await ctx.db.get(currentTerm.sessionId);
    }

    // Get all enrollments for the student
    const allEnrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .collect();

    // Separate completed and active enrollments
    const completedEnrollments = allEnrollments.filter(
      (e) => e.status === "completed"
    );
    // Include enrolled, active, and waitlisted enrollments for current term
    const activeEnrollments = currentTerm
      ? allEnrollments.filter(
          (e) =>
            (e.status === "enrolled" || e.status === "active" || e.status === "waitlisted") && 
            e.termId === currentTerm._id
        )
      : [];

    // Calculate academic stats from completed enrollments
    let totalGradePoints = 0;
    let totalCredits = 0;
    let creditsEarned = 0;

    for (const enrollment of completedEnrollments) {
      try {
        // Get section and course to get credits
        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) continue;

        const course = await ctx.db.get(section.courseId);
        if (!course) continue;

        // Try to calculate final grade
        try {
          const { finalGrade } = await computeFinalGrade(
            ctx.db,
            enrollment._id
          );

          // Only count courses with valid grades for GPA
          if (finalGrade.points >= 0) {
            totalGradePoints += finalGrade.points * course.credits;
            totalCredits += course.credits;

            // Count credits earned (only for passing grades, points > 0)
            if (finalGrade.points > 0) {
              creditsEarned += course.credits;
            }
          }
        } catch {
          // If final grade can't be calculated (missing assessments/grades), skip
          // This enrollment won't count toward GPA
          continue;
        }
      } catch {
        // Skip this enrollment if there's an error
        continue;
      }
    }

    // Calculate GPA
    const gpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;
    const roundedGpa = Math.round(gpa * 100) / 100;

    // Get current schedule (active enrollments for current term)
    const currentSchedule = await Promise.all(
      activeEnrollments.map(async (enrollment) => {
        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) return null;

        const course = await ctx.db.get(section.courseId);
        if (!course) return null;

        // Get instructor name
        const instructor = await ctx.db.get(section.instructorId);
        const instructorName = instructor
          ? `${instructor.profile.firstName} ${instructor.profile.lastName}`
          : "TBA";

        // Format schedule from scheduleSlots
        const scheduleParts: string[] = [];
        for (const slot of section.scheduleSlots) {
          scheduleParts.push(`${slot.day} ${slot.startTime}-${slot.endTime}`);
        }
        const schedule =
          scheduleParts.length > 0 ? scheduleParts.join(", ") : "TBA";

        // Get room (use first slot's room, or "TBA" if no slots)
        const room =
          section.scheduleSlots.length > 0
            ? section.scheduleSlots[0].room
            : "TBA";

        return {
          enrollmentId: enrollment._id,
          enrollmentStatus: enrollment.status,
          courseCode: course.code,
          courseTitle: course.title,
          schedule,
          scheduleSlots: section.scheduleSlots, // Include raw schedule slots for calendar view
          room,
          instructor: instructorName,
        };
      })
    );

    // Filter out null values
    const validSchedule = currentSchedule.filter(
      (item): item is NonNullable<typeof item> => item !== null
    );

    return {
      studentProfile: {
        name: `${user.profile.firstName} ${user.profile.lastName}`.trim(),
        department: department?.name || "N/A",
        session: currentSession?.yearLabel || "N/A",
        term: currentTerm?.name || "N/A",
        status: student.status,
      },
      academicStats: {
        gpa: roundedGpa,
        creditsEarned,
        totalCredits: totalCredits, // Total credits attempted (for context)
      },
      currentSchedule: validSchedule,
    };
  },
});

