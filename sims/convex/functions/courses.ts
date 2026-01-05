/**
 * Courses Management Functions
 *
 * Provides queries for fetching courses with filtering and search capabilities.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { validateSessionToken } from "../lib/session";

/**
 * List public courses with filtering and search
 * 
 * For students: Only shows courses from their department and matching their level
 * For other users: Shows all courses (can filter by department)
 * 
 * Supports:
 * - Search by course code or title
 * - Filter by department
 * - Automatic filtering by student's department and level
 */
export const listPublic = query({
  args: {
    token: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    // Get current user if token is provided
    let studentDepartmentId: Id<"departments"> | null = null;
    let studentLevel: string | null = null;

    if (args.token) {
      const userId = await validateSessionToken(ctx.db, args.token);
      if (userId) {
        // Check if user is a student
        const user = await ctx.db.get(userId);
        if (user && user.roles.includes("student")) {
          const student = await ctx.db
            .query("students")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first();
          
          if (student) {
            studentDepartmentId = student.departmentId;
            studentLevel = student.level;
          }
        }
      }
    }

    // Start with all courses
    let courses = await ctx.db.query("courses").collect();

    // If user is a student, filter by their department and level
    if (studentDepartmentId && studentLevel) {
      courses = courses.filter(
        (course) =>
          course.departmentId === studentDepartmentId &&
          course.level === studentLevel
      );
    } else if (studentDepartmentId) {
      // If student but no level match, still filter by department
      courses = courses.filter(
        (course) => course.departmentId === studentDepartmentId
      );
    }

    // Apply department filter if provided (and user is not a student)
    if (args.departmentId && !studentDepartmentId) {
      courses = courses.filter(
        (course) => course.departmentId === args.departmentId
      );
    }

    // Apply search filter if provided
    if (args.searchQuery) {
      const searchLower = args.searchQuery.toLowerCase();
      courses = courses.filter(
        (course) =>
          course.code.toLowerCase().includes(searchLower) ||
          course.title.toLowerCase().includes(searchLower)
      );
    }

    // Get current or next term
    const now = Date.now();
    const allTerms = await ctx.db.query("terms").collect();
    
    // First, try to find a term that is currently in progress
    const currentTerm = allTerms.find(
      (term) => term.startDate <= now && term.endDate >= now
    );
    
    let effectiveTerm: { _id: Id<"terms"> } | null = null;
    
    if (currentTerm) {
      effectiveTerm = { _id: currentTerm._id };
    } else {
      // If no current term, find the next upcoming term
      const upcomingTerms = allTerms
        .filter((term) => term.startDate > now)
        .sort((a, b) => a.startDate - b.startDate);
      
      if (upcomingTerms.length > 0) {
        effectiveTerm = { _id: upcomingTerms[0]._id };
      }
    }

    // Filter courses to only show those with published sections for the current term
    if (effectiveTerm) {
      const courseIdsWithPublishedSections = new Set<Id<"courses">>();
      
      // Get all sections for the current term that are published
      const publishedSections = await ctx.db
        .query("sections")
        .withIndex("by_termId", (q) => q.eq("termId", effectiveTerm!._id))
        .filter((q) => q.eq(q.field("isOpenForEnrollment"), true))
        .collect();
      
      // Collect unique course IDs from published sections
      for (const section of publishedSections) {
        courseIdsWithPublishedSections.add(section.courseId);
      }
      
      // Filter courses to only include those with published sections
      courses = courses.filter((course) =>
        courseIdsWithPublishedSections.has(course._id)
      );
    }

    // Fetch department and program information for each course
    const coursesWithDetails = await Promise.all(
      courses.map(async (course) => {
        const department = await ctx.db.get(course.departmentId);
        
        // Fetch program information
        const programs = await Promise.all(
          (course.programIds || []).map(async (programId) => {
            const program = await ctx.db.get(programId);
            return program
              ? {
                  _id: program._id,
                  name: program.name,
                }
              : null;
          })
        );
        
        return {
          _id: course._id,
          code: course.code,
          title: course.title,
          credits: course.credits,
          department: department
            ? {
                _id: department._id,
                name: department.name,
              }
            : null,
          programs: programs.filter((p) => p !== null),
          status: course.status || "E",
          level: course.level,
        };
      })
    );

    return coursesWithDetails;
  },
});

/**
 * Get course details including description, prerequisites, and active sections
 * 
 * Returns:
 * - Course description
 * - Prerequisites (list of course names)
 * - Active Sections (Instructor name, Schedule, Room, Seats Available)
 */
export const getDetails = query({
  args: {
    courseId: v.id("courses"),
  },
  handler: async (ctx, args) => {
    // Get the course
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Get prerequisite course names
    const prerequisiteNames: string[] = [];
    if (course.prerequisites && course.prerequisites.length > 0) {
      for (const prereqCode of course.prerequisites) {
        // Trim whitespace and try to find the course
        const trimmedCode = prereqCode.trim();
        
        // First try exact match with index
        let prereqCourse = await ctx.db
          .query("courses")
          .withIndex("by_code", (q) => q.eq("code", trimmedCode))
          .first();
        
        // If not found, try case-insensitive search by querying all courses
        if (!prereqCourse) {
          const allCourses = await ctx.db.query("courses").collect();
          prereqCourse = allCourses.find(
            (c) => c.code.toLowerCase() === trimmedCode.toLowerCase()
          ) || null;
        }
        
        if (prereqCourse) {
          prerequisiteNames.push(prereqCourse.title);
        } else {
          // If course not found after all attempts, show the code as fallback
          prerequisiteNames.push(trimmedCode);
        }
      }
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

    // Get active sections (sections for this course in the current term)
    const activeSections: Array<{
      sectionId: string;
      instructor: string;
      schedule: string;
      room: string;
      seatsAvailable: number;
    }> = [];

    if (currentTerm) {
      const sections = await ctx.db
        .query("sections")
        .withIndex("by_courseId_termId", (q) => 
          q.eq("courseId", args.courseId).eq("termId", currentTerm._id)
        )
        .collect();

      // Process each section to get instructor name and format schedule
      for (const section of sections) {
        // Get instructor name
        const instructor = await ctx.db.get(section.instructorId);
        const instructorName = instructor
          ? `${instructor.profile.firstName} ${instructor.profile.lastName}`
          : "TBA";

        // Format schedule from scheduleSlots
        const scheduleParts: string[] = [];
        for (const slot of section.scheduleSlots) {
          scheduleParts.push(
            `${slot.day} ${slot.startTime}-${slot.endTime}`
          );
        }
        const schedule = scheduleParts.length > 0 
          ? scheduleParts.join(", ")
          : "TBA";

        // Get room (use first slot's room, or "TBA" if no slots)
        const room = section.scheduleSlots.length > 0
          ? section.scheduleSlots[0].room
          : "TBA";

        // Calculate seats available
        const seatsAvailable = section.capacity - section.enrollmentCount;

        activeSections.push({
          sectionId: section._id,
          instructor: instructorName,
          schedule: schedule,
          room: room,
          seatsAvailable: seatsAvailable,
        });
      }
    }

    return {
      title: course.title,
      description: course.description,
      prerequisites: prerequisiteNames,
      activeSections: activeSections,
    };
  },
});

