/**
 * Transcript Queries
 * 
 * Provides queries for fetching transcript data and academic history.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "./lib/session";

// Note: convertPercentageToLetterGrade function removed as it's unused
// If needed in the future, it can be re-added

/**
 * Calculate GPA from course entries
 * Formula: GPA = Σ(grade.points × credits) / Σ(credits)
 */
function calculateGPA(courses: Array<{ credits: number; gradePoints: number }>): number {
  if (courses.length === 0) {
    return 0;
  }

  let totalPoints = 0;
  let totalCredits = 0;

  for (const course of courses) {
    totalPoints += course.gradePoints * course.credits;
    totalCredits += course.credits;
  }

  if (totalCredits === 0) {
    return 0;
  }

  const gpa = totalPoints / totalCredits;
  // Round to 2 decimal places
  return Math.round(gpa * 100) / 100;
}

/**
 * Get full academic history for the current student
 * Returns all transcript entries grouped by Term (descending)
 * Includes Term GPA for each group and Cumulative GPA
 * Reads from the transcripts table entries
 */
export const getFullHistory = query({
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

    // Get transcript from transcripts table
    const transcript = await ctx.db
      .query("transcripts")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .first();

    // If no transcript exists or no entries, return empty data
    if (!transcript || !transcript.entries || transcript.entries.length === 0) {
      const department = await ctx.db.get(student.departmentId);
      const departmentName = department?.name || "N/A";

      return {
        groupedData: {},
        termGPAs: {},
        cumulativeGPA: 0,
        studentInfo: {
          studentNumber: student.studentNumber,
          name: `${user.profile.firstName} ${user.profile.middleName || ""} ${user.profile.lastName}`.trim(),
          departmentId: student.departmentId,
          departmentName,
        },
      };
    }


    // Group entries by term
    // Format term label: "Semester 1 2025/2026" from entry.term and entry.year
    // The entry.term is the term name, entry.year is the year
    // We need to construct the term label properly
    const groupedByTerm = new Map<string, typeof transcript.entries>();

    for (const entry of transcript.entries) {
      // Format term label: "Semester 1 2025/2026"
      // entry.term is the term name (e.g., "Semester 1")
      // entry.year is the year (e.g., 2025)
      // We need to format it as "Semester 1 2025/2026" or similar
      // For now, let's use the term and year as-is and format it
      const termLabel = `${entry.term} ${entry.year}/${entry.year + 1}`;
      
      const existing = groupedByTerm.get(termLabel) || [];
      existing.push(entry);
      groupedByTerm.set(termLabel, existing);
    }

    // Sort terms by year (descending - most recent first)
    const sortedTerms = Array.from(groupedByTerm.entries()).sort((a, b) => {
      // Extract year from term label or use entry year
      const entryA = a[1][0];
      const entryB = b[1][0];
      return entryB.year - entryA.year;
    });

    // Calculate Term GPA for each group and Cumulative GPA
    const result: Record<string, Array<{
      courseCode: string;
      courseTitle: string;
      credits: number;
      grade: {
        percentage: number;
        letter: string;
        points: number;
      };
    }>> = {};

    const allCourses: Array<{ credits: number; gradePoints: number }> = [];
    const termGPAs: Record<string, number> = {};

    for (const [termLabel, entries] of sortedTerms) {
      // Calculate Term GPA
      const termCourses = entries.map((e) => ({
        credits: e.credits,
        gradePoints: e.grade.points,
      }));
      const termGPA = calculateGPA(termCourses);
      termGPAs[termLabel] = termGPA;

      // Add to all courses for cumulative GPA
      allCourses.push(...termCourses);

      // Format entries for response
      result[termLabel] = entries.map((e) => ({
        courseCode: e.courseCode,
        courseTitle: e.courseTitle,
        credits: e.credits,
        grade: {
          percentage: e.grade.numeric,
          letter: e.grade.letter,
          points: e.grade.points,
        },
      }));
    }

    // Calculate Cumulative GPA (use transcript GPA if available, otherwise calculate)
    const cumulativeGPA = transcript.gpa > 0 ? transcript.gpa : calculateGPA(allCourses);

    // Get department information
    const department = await ctx.db.get(student.departmentId);
    const departmentName = department?.name || "N/A";

    return {
      groupedData: result,
      termGPAs,
      cumulativeGPA,
      studentInfo: {
        studentNumber: student.studentNumber,
        name: `${user.profile.firstName} ${user.profile.middleName || ""} ${user.profile.lastName}`.trim(),
        departmentId: student.departmentId,
        departmentName,
      },
    };
  },
});

