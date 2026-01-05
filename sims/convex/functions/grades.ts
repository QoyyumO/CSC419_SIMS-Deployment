/**
 * Grades Queries
 * 
 * Provides queries for fetching grades data for the gradebook interface.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { validateSessionToken } from "../lib/session";

/**
 * Converts percentage to letter grade using the standard mapping:
 * 70-100: A (5.0)
 * 60-69.99: B (4.0)
 * 50-59.99: C (3.0)
 * 45-49.99: D (2.0)
 * 40-44.99: E (1.0)
 * 0-39.99: F (0.0)
 */
function convertPercentageToLetterGrade(percentage: number): { letter: string; points: number } {
  if (percentage >= 70) {
    return { letter: "A", points: 5.0 };
  } else if (percentage >= 60) {
    return { letter: "B", points: 4.0 };
  } else if (percentage >= 50) {
    return { letter: "C", points: 3.0 };
  } else if (percentage >= 45) {
    return { letter: "D", points: 2.0 };
  } else if (percentage >= 40) {
    return { letter: "E", points: 1.0 };
  } else {
    return { letter: "F", points: 0.0 };
  }
}

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
            const rawScore = Math.round(((g.grade / 100) * totalPoints) * 100) / 100;
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

/**
 * Get active grades for the current student
 * Returns all active enrollments with their course details, assessments, and grades
 * Calculates running average for each course
 */
export const getMyActiveGrades = query({
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

    // Get all active enrollments for the student
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "enrolled"),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    // Filter to current term if available, otherwise include all active
    const activeEnrollments = currentTerm
      ? enrollments.filter((e) => e.termId === currentTerm._id)
      : enrollments;

    // For each enrollment, fetch section, course, assessments, and grades
    const gradesData = await Promise.all(
      activeEnrollments.map(async (enrollment) => {
        // Get section
        const section = await ctx.db.get(enrollment.sectionId);
        if (!section) {
          return null;
        }

        // Get course
        const course = await ctx.db.get(section.courseId);
        if (!course) {
          return null;
        }

        // Get all assessments for this section
        const assessments = await ctx.db
          .query("assessments")
          .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
          .collect();

        // Get all grades for this enrollment
        const grades = await ctx.db
          .query("grades")
          .withIndex("by_enrollmentId", (q) => q.eq("enrollmentId", enrollment._id))
          .collect();

        // Create a map of assessmentId -> grade for quick lookup
        const gradeMap = new Map(
          grades.map((g) => [g.assessmentId, g])
        );

        // Calculate running average: Sum of (Score / Total * Weight)
        // Formula: For each graded assessment: (percentage / 100) * weight
        // Sum all contributions to get the current running grade
        let totalWeightedPoints = 0;

        // Map assessments with grades
        const assessmentsWithGrades = assessments.map((assessment) => {
          const grade = gradeMap.get(assessment._id);
          const isMissing = !grade && assessment.dueDate < now;

          if (grade) {
            // grade.grade is already a percentage (0-100)
            // Calculate weighted contribution: (percentage / 100) * weight
            // This gives the contribution to the final grade
            const weightedContribution = (grade.grade / 100) * assessment.weight;
            totalWeightedPoints += weightedContribution;

            // Convert percentage back to raw score for display
            const rawScore = Math.round(((grade.grade / 100) * assessment.totalPoints) * 100) / 100;

            // Calculate letter grade for display (not stored in DB)
            const { letter } = convertPercentageToLetterGrade(grade.grade);

            return {
              _id: assessment._id,
              title: assessment.title,
              totalPoints: assessment.totalPoints,
              weight: assessment.weight,
              dueDate: assessment.dueDate,
              score: rawScore,
              percentage: grade.grade,
              letter: letter,
              isMissing: false,
            };
          } else {
            return {
              _id: assessment._id,
              title: assessment.title,
              totalPoints: assessment.totalPoints,
              weight: assessment.weight,
              dueDate: assessment.dueDate,
              score: null,
              percentage: null,
              letter: null,
              isMissing: isMissing,
            };
          }
        });

        // Calculate current running average
        // The sum of weighted contributions IS the current percentage
        // (assuming weights sum to 100, this gives a percentage out of 100)
        let currentGrade: {
          percentage: number;
          letter: string;
          points: number;
        } | null = null;

        if (totalWeightedPoints > 0) {
          // Round to 2 decimal places
          const roundedPercentage = Math.round(totalWeightedPoints * 100) / 100;
          const { letter, points } = convertPercentageToLetterGrade(roundedPercentage);

          currentGrade = {
            percentage: roundedPercentage,
            letter,
            points,
          };
        }

        return {
          enrollmentId: enrollment._id,
          sectionId: section._id,
          course: {
            _id: course._id,
            code: course.code,
            title: course.title,
            credits: course.credits,
          },
          section: {
            _id: section._id,
          },
          currentGrade,
          assessments: assessmentsWithGrades,
        };
      })
    );

    // Filter out null entries
    return gradesData.filter((data) => data !== null) as Array<{
      enrollmentId: Id<"enrollments">;
      sectionId: Id<"sections">;
      course: {
        _id: Id<"courses">;
        code: string;
        title: string;
        credits: number;
      };
      section: {
        _id: Id<"sections">;
      };
      currentGrade: {
        percentage: number;
        letter: string;
        points: number;
      } | null;
      assessments: Array<{
        _id: Id<"assessments">;
        title: string;
        totalPoints: number;
        weight: number;
        dueDate: number;
        score: number | null;
        percentage: number | null;
        letter: string | null;
        isMissing: boolean;
      }>;
    }>;
  },
});

