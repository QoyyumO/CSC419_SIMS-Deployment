/**
 * Grades Queries
 * 
 * Provides queries for fetching grades data for the gradebook interface.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { validateSessionToken } from "./lib/session";

/**
 * Get all grades for a section
 * Returns grades organized by enrollment and assessment for the gradebook matrix
 */
export const getBySection = query({
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
      throw new Error("Access denied: You can only view grades for your own sections");
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

    // Get all assessments for this section
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    // Create a map of assessmentId -> totalPoints for score calculation
    const assessmentMap = new Map(
      assessments.map((a) => [a._id, a.totalPoints])
    );

    // Get all grades for these enrollments
    const allGrades = await Promise.all(
      enrollments.map(async (enrollment) => {
        const grades = await ctx.db
          .query("grades")
          .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollment._id))
          .collect();

        return {
          enrollmentId: enrollment._id,
          grades: grades.map((g) => {
            // Convert percentage back to raw score
            const totalPoints = assessmentMap.get(g.assessmentId) || 100;
            // Round to 2 decimal places to avoid floating-point precision issues
            const rawScore = Math.round(((g.grade.numeric / 100) * totalPoints) * 100) / 100;
            return {
              assessmentId: g.assessmentId,
              score: rawScore,
              gradeId: g._id,
            };
          }),
        };
      })
    );

    // Get student details for each enrollment
    const gradesWithStudents = await Promise.all(
      enrollments.map(async (enrollment, index) => {
        const student = await ctx.db.get(enrollment.studentId);
        if (!student) {
          return null;
        }

        const user = await ctx.db.get(student.userId);
        if (!user) {
          return null;
        }

        const enrollmentGrades = allGrades[index];

        return {
          enrollmentId: enrollment._id,
          studentId: student._id,
          studentNumber: student.studentNumber,
          studentName: `${user.profile.firstName} ${user.profile.lastName}`,
          grades: enrollmentGrades.grades,
        };
      })
    );

    // Filter out null entries
    const validGrades = gradesWithStudents.filter((g) => g !== null) as Array<{
      enrollmentId: Id<"enrollments">;
      studentId: Id<"students">;
      studentNumber: string;
      studentName: string;
      grades: Array<{
        assessmentId: Id<"assessments">;
        score: number;
        gradeId: Id<"grades">;
      }>;
    }>;

    return {
      enrollments: validGrades,
      assessments: assessments.map((a) => ({
        _id: a._id,
        title: a.title,
        totalPoints: a.totalPoints,
        weight: a.weight,
      })),
      section: {
        finalGradesPosted: section.finalGradesPosted ?? false,
        gradesEditable: section.gradesEditable ?? true,
      },
    };
  },
});

