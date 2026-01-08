/**
 * Department Head Functions
 * 
 * Provides queries and mutations for department head dashboard and section management.
 * Restricted to users with role === 'department_head'.
 */

import { query, mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "../lib/session";
import { NotFoundError, ValidationError } from "../lib/errors";
import { Id } from "../_generated/dataModel";

/**
 * Get dashboard statistics for department head
 * Returns total instructors, count of active sections, and count of unassigned sections
 */
export const getDashboardStats = query({
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    // Get all sections for courses in this department
    const allSections = await ctx.db.query("sections").collect();
    const departmentSections = allSections.filter((section) =>
      courseIds.includes(section.courseId)
    );

    // Count instructors in this department from the instructors table
    const departmentInstructors = await ctx.db
      .query("instructors")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();
    const totalInstructors = departmentInstructors.length;

    // Get Institute of Humanities department for validation (used for both active and unassigned counts)
    const humanitiesDepartment = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", "Institute of Humanities"))
      .first();

    // Count active sections (sections with valid instructor from department OR Institute of Humanities)
    let activeCount = 0;
    for (const section of departmentSections) {
      if (section.instructorId) {
        const instructor = await ctx.db.get(section.instructorId);
        if (instructor && instructor.roles.includes("instructor")) {
          const instructorRecord = await ctx.db
            .query("instructors")
            .withIndex("by_userId", (q) => q.eq("userId", section.instructorId))
            .first();
          
          if (instructorRecord) {
            const belongsToDepartment = instructorRecord.departmentId === department._id;
            const belongsToHumanities = humanitiesDepartment 
              ? instructorRecord.departmentId === humanitiesDepartment._id
              : false;
            
            if (belongsToDepartment || belongsToHumanities) {
              activeCount++;
            }
          }
        }
      }
    }
    const activeSections = activeCount;

    // Count unassigned sections (sections without instructorId or with invalid instructor)
    // Also check if assigned instructor belongs to the department OR Institute of Humanities
    let unassignedCount = 0;
    
    for (const section of departmentSections) {
      if (!section.instructorId) {
        unassignedCount++;
      } else {
        const instructor = await ctx.db.get(section.instructorId);
        if (!instructor || !instructor.roles.includes("instructor")) {
          unassignedCount++;
        } else {
          // Check if instructor belongs to this department OR Institute of Humanities
          const instructorRecord = await ctx.db
            .query("instructors")
            .withIndex("by_userId", (q) => q.eq("userId", section.instructorId))
            .first();
          
          if (!instructorRecord) {
            unassignedCount++;
          } else {
            // Check if instructor belongs to department head's department
            const belongsToDepartment = instructorRecord.departmentId === department._id;
            
            // Check if instructor belongs to Institute of Humanities
            const belongsToHumanities = humanitiesDepartment 
              ? instructorRecord.departmentId === humanitiesDepartment._id
              : false;
            
            // Only count as unassigned if instructor doesn't belong to either department
            if (!belongsToDepartment && !belongsToHumanities) {
              unassignedCount++;
            }
          }
        }
      }
    }
    const unassignedSections = unassignedCount;

    return {
      totalInstructors,
      activeSections,
      unassignedSections,
    };
  },
});

/**
 * Get all sections for the current department, filterable by term
 */
export const getSections = query({
  args: {
    token: v.optional(v.string()),
    termId: v.optional(v.id("terms")),
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    // Get all sections for courses in this department
    let sections = await ctx.db.query("sections").collect();
    sections = sections.filter((section) => courseIds.includes(section.courseId));

    // Filter by term if provided
    if (args.termId) {
      sections = sections.filter((section) => section.termId === args.termId);
    }

    // Check enrollment status based on deadlines (compute effective status without patching)
    // The cron job and enrollment mutation will handle actual database updates
    const now = Date.now();

    // Enrich sections with course and instructor information
    const sectionsWithDetails = await Promise.all(
      sections.map(async (section) => {
        const course = await ctx.db.get(section.courseId);
        const term = await ctx.db.get(section.termId);
        const instructor = section.instructorId
          ? await ctx.db.get(section.instructorId)
          : null;

        // Check if instructor is valid and belongs to this department
        let isValidInstructor = false;
        let instructorName = "Unassigned";
        
        if (instructor && instructor.roles.includes("instructor")) {
          const instructorRecord = await ctx.db
            .query("instructors")
            .withIndex("by_userId", (q) => q.eq("userId", section.instructorId))
            .first();
          
          if (instructorRecord) {
            // Check if instructor belongs to department head's department
            const belongsToDepartment = instructorRecord.departmentId === department._id;
            
            // Also check if instructor belongs to Institute of Humanities
            const humanitiesDepartment = await ctx.db
              .query("departments")
              .withIndex("by_name", (q) => q.eq("name", "Institute of Humanities"))
              .first();
            
            const belongsToHumanities = humanitiesDepartment 
              ? instructorRecord.departmentId === humanitiesDepartment._id
              : false;
            
            isValidInstructor = belongsToDepartment || belongsToHumanities;
            
            if (isValidInstructor) {
              instructorName = `${instructor.profile.firstName} ${instructor.profile.lastName}`;
            }
          }
        }

        // Get session information
        const session = term ? await ctx.db.get(term.sessionId) : null;

        // Compute effective enrollment status (check if deadline has passed)
        let effectiveIsOpenForEnrollment = section.isOpenForEnrollment ?? false;
        if (effectiveIsOpenForEnrollment && section.enrollmentDeadline) {
          if (now > section.enrollmentDeadline) {
            // Deadline has passed, effectively closed (cron job will update DB)
            effectiveIsOpenForEnrollment = false;
          }
        }

        return {
          _id: section._id,
          courseCode: course?.code || "Unknown",
          courseTitle: course?.title || "Unknown",
          sectionId: section._id,
          instructorId: section.instructorId,
          instructorName,
          capacity: section.capacity,
          enrollmentCount: section.enrollmentCount,
          status: isValidInstructor ? "Active" : "Unassigned",
          termId: section.termId,
          termName: term?.name || "Unknown",
          sessionYearLabel: session?.yearLabel || "Unknown",
          isOpenForEnrollment: effectiveIsOpenForEnrollment,
        };
      })
    );

    return sectionsWithDetails;
  },
});

/**
 * Create a new section
 * Validates that courseId belongs to the department head's department
 */
export const createSection = mutation({
  args: {
    token: v.optional(v.string()),
    courseId: v.id("courses"),
    termId: v.id("terms"),
    capacity: v.number(),
    details: v.optional(v.string()),
    instructorId: v.optional(v.id("users")),
    enrollmentDeadline: v.optional(v.number()), // Unix timestamp for enrollment deadline
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
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Validate that courseId belongs to this department
    const course = await ctx.db.get(args.courseId);
    if (!course) {
      throw new NotFoundError("Course", args.courseId);
    }

    if (course.departmentId !== department._id) {
      throw new ValidationError(
        "courseId",
        "Course does not belong to your department"
      );
    }

    // Validate term exists
    const term = await ctx.db.get(args.termId);
    if (!term) {
      throw new NotFoundError("Term", args.termId);
    }

    // Get session from term
    const session = await ctx.db.get(term.sessionId);
    if (!session) {
      throw new NotFoundError("Academic Session", term.sessionId);
    }

    // Validate capacity
    if (args.capacity <= 0) {
      throw new ValidationError("capacity", "Capacity must be greater than 0");
    }

    // Validate enrollment deadline if provided
    if (args.enrollmentDeadline !== undefined) {
      const now = Date.now();
      if (args.enrollmentDeadline < now) {
        throw new ValidationError(
          "enrollmentDeadline",
          "Enrollment deadline cannot be in the past"
        );
      }
      // Ensure deadline is before term end date
      if (args.enrollmentDeadline > term.endDate) {
        throw new ValidationError(
          "enrollmentDeadline",
          "Enrollment deadline must be before the term end date"
        );
      }
    }

    // Use provided instructorId or use department head as placeholder
    // The schema requires instructorId, so we use a placeholder if not provided
    // This section will show as "Unassigned" until an instructor is assigned
    const instructorIdToUse = args.instructorId || userId;

    // If instructorId is provided, validate it exists and has instructor role
    if (args.instructorId) {
      const instructor = await ctx.db.get(args.instructorId);
      if (!instructor) {
        throw new NotFoundError("Instructor", args.instructorId);
      }
      if (!instructor.roles.includes("instructor")) {
        throw new ValidationError(
          "instructorId",
          "User must have instructor role"
        );
      }
    }

    const sectionId = await ctx.db.insert("sections", {
      courseId: args.courseId,
      sessionId: term.sessionId,
      termId: args.termId,
      instructorId: instructorIdToUse,
      capacity: args.capacity,
      scheduleSlots: args.scheduleSlots || [], // Use provided schedule slots or empty array
      enrollmentCount: 0,
      isOpenForEnrollment: false, // New sections start as Draft
      enrollmentDeadline: args.enrollmentDeadline,
    });

    return { success: true, sectionId };
  },
});

/**
 * Get all terms for dropdown selection
 * Includes session information for better filtering
 */
export const getTerms = query({
  args: {},
  handler: async (ctx) => {
    const terms = await ctx.db.query("terms").collect();
    
    // Get all sessions for lookup
    const sessions = await ctx.db.query("academicSessions").collect();
    const sessionMap = new Map(sessions.map((s) => [s._id, s]));
    
    // Sort by start date descending (most recent first)
    const sortedTerms = terms.sort((a, b) => b.startDate - a.startDate);
    
    return sortedTerms.map((term) => {
      const session = sessionMap.get(term.sessionId);
      return {
        _id: term._id,
        name: term.name,
        sessionId: term.sessionId,
        sessionYearLabel: session?.yearLabel || "Unknown",
        startDate: term.startDate,
        endDate: term.endDate,
      };
    });
  },
});

/**
 * Get the current active term or the next upcoming term
 * Returns the term that is currently in progress (current date between startDate and endDate)
 * If no current term exists, returns the next upcoming term (earliest startDate > now)
 */
export const getCurrentOrNextTerm = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allTerms = await ctx.db.query("terms").collect();
    
    // First, try to find a term that is currently in progress
    const currentTerm = allTerms.find(
      (term) => term.startDate <= now && term.endDate >= now
    );
    
    if (currentTerm) {
      const session = await ctx.db.get(currentTerm.sessionId);
      return {
        _id: currentTerm._id,
        name: currentTerm.name,
        sessionId: currentTerm.sessionId,
        sessionYearLabel: session?.yearLabel || "Unknown",
        startDate: currentTerm.startDate,
        endDate: currentTerm.endDate,
      };
    }
    
    // If no current term, find the next upcoming term
    const upcomingTerms = allTerms
      .filter((term) => term.startDate > now)
      .sort((a, b) => a.startDate - b.startDate); // Sort by start date ascending
    
    if (upcomingTerms.length > 0) {
      const nextTerm = upcomingTerms[0];
      const session = await ctx.db.get(nextTerm.sessionId);
      return {
        _id: nextTerm._id,
        name: nextTerm.name,
        sessionId: nextTerm.sessionId,
        sessionYearLabel: session?.yearLabel || "Unknown",
        startDate: nextTerm.startDate,
        endDate: nextTerm.endDate,
      };
    }
    
    // If no current or upcoming term, return null
    return null;
  },
});

/**
 * Get all courses for the department head's department
 */
export const getDepartmentCourses = query({
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    // Enrich courses with department and program information
    const enrichedCourses = await Promise.all(
      courses.map(async (course) => {
        // Get department
        const courseDepartment = await ctx.db.get(course.departmentId);
        
        // Get programs
        const coursePrograms = await Promise.all(
          (course.programIds || []).map(async (programId) => {
            const program = await ctx.db.get(programId);
            return program ? { _id: program._id, name: program.name } : null;
          })
        );

        return {
          _id: course._id,
          code: course.code,
          title: course.title,
          credits: course.credits,
          department: courseDepartment ? {
            _id: courseDepartment._id,
            name: courseDepartment.name,
          } : null,
          programs: coursePrograms.filter((p): p is { _id: Id<"programs">; name: string } => p !== null),
          status: course.status,
          level: course.level,
        };
      })
    );

    return enrichedCourses;
  },
});

/**
 * Get all instructors in the department with their workload (section count) for a term
 */
export const getInstructorWorkload = query({
  args: {
    token: v.optional(v.string()),
    termId: v.optional(v.id("terms")),
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    // Get all sections for courses in this department
    let sections = await ctx.db.query("sections").collect();
    sections = sections.filter((section) => courseIds.includes(section.courseId));

    // Filter by term if provided
    if (args.termId) {
      sections = sections.filter((section) => section.termId === args.termId);
    }

    // Get all instructors who have taught in this department
    const instructorIds = new Set<Id<"users">>();
    for (const section of sections) {
      if (section.instructorId) {
        const instructor = await ctx.db.get(section.instructorId);
        if (instructor && instructor.roles.includes("instructor")) {
          instructorIds.add(section.instructorId);
        }
      }
    }

    // Get all instructors in this department from the instructors table
    const departmentInstructors = await ctx.db
      .query("instructors")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    // Calculate workload for each instructor
    const instructorWorkloads = await Promise.all(
      departmentInstructors.map(async (instructorRecord) => {
        const instructor = await ctx.db.get(instructorRecord.userId);
        if (!instructor || !instructor.roles.includes("instructor")) {
          return null;
        }

        // Count sections assigned to this instructor in the department
        const assignedSections = sections.filter(
          (section) => section.instructorId === instructor._id
        ).length;

        return {
          _id: instructor._id,
          name: `${instructor.profile.firstName} ${instructor.profile.lastName}`,
          email: instructor.email,
          load: assignedSections,
        };
      })
    );

    // Filter out null values
    const validWorkloads = instructorWorkloads.filter(
      (workload): workload is NonNullable<typeof workload> => workload !== null
    );

    // Sort by load (ascending) then by name
    validWorkloads.sort((a, b) => {
      if (a.load !== b.load) {
        return a.load - b.load;
      }
      return a.name.localeCompare(b.name);
    });

    return validWorkloads;
  },
});

/**
 * Get all instructors in the department (for dropdown selection)
 */
export const getDepartmentInstructors = query({
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all instructors in this department from the instructors table
    const departmentInstructors = await ctx.db
      .query("instructors")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    // Also get instructors from Institute of Humanities department
    const humanitiesDepartment = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", "Institute of Humanities"))
      .first();

    let humanitiesInstructors: typeof departmentInstructors = [];
    if (humanitiesDepartment) {
      humanitiesInstructors = await ctx.db
        .query("instructors")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", humanitiesDepartment._id))
        .collect();
    }

    // Combine instructors from both departments and deduplicate by userId
    const allInstructorRecords = [...departmentInstructors, ...humanitiesInstructors];
    const uniqueInstructorIds = new Set<Id<"users">>();
    const uniqueInstructorRecords = allInstructorRecords.filter((instructor) => {
      if (uniqueInstructorIds.has(instructor.userId)) {
        return false;
      }
      uniqueInstructorIds.add(instructor.userId);
      return true;
    });

    // Get user details for each instructor
    const instructorsWithDetails = await Promise.all(
      uniqueInstructorRecords.map(async (instructor) => {
        const user = await ctx.db.get(instructor.userId);
        if (!user || !user.roles.includes("instructor")) {
          return null;
        }
        return {
          _id: user._id,
          name: `${user.profile.firstName} ${user.profile.lastName}`,
          email: user.email,
        };
      })
    );

    return instructorsWithDetails.filter(
      (instructor): instructor is NonNullable<typeof instructor> => instructor !== null
    );
  },
});

/**
 * Get assignment report for CSV export
 * Returns a flat list of { Term, Session, Course, InstructorName, Capacity }
 */
export const getAssignmentReport = query({
  args: {
    token: v.optional(v.string()),
    termId: v.optional(v.id("terms")),
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

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    // Get all sections for courses in this department
    let sections = await ctx.db.query("sections").collect();
    sections = sections.filter((section) => courseIds.includes(section.courseId));

    // Filter by term if provided
    if (args.termId) {
      sections = sections.filter((section) => section.termId === args.termId);
    }

    // Build the report data
    const reportData = await Promise.all(
      sections.map(async (section) => {
        const course = await ctx.db.get(section.courseId);
        const term = await ctx.db.get(section.termId);
        const session = term ? await ctx.db.get(term.sessionId) : null;
        const instructor = section.instructorId
          ? await ctx.db.get(section.instructorId)
          : null;

        let instructorName = "Unassigned";
        if (instructor && instructor.roles.includes("instructor")) {
          instructorName = `${instructor.profile.firstName} ${instructor.profile.lastName}`;
        }

        return {
          Term: term?.name || "Unknown",
          Session: session?.yearLabel || "Unknown",
          Course: course?.title || "Unknown",
          InstructorName: instructorName,
          Capacity: section.capacity,
        };
      })
    );

    return reportData;
  },
});

/**
 * Assign an instructor to a section
 * Validates that the instructor belongs to the department
 */
export const assignInstructor = mutation({
  args: {
    token: v.optional(v.string()),
    sectionId: v.id("sections"),
    instructorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get the section
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Validate that the section's course belongs to this department
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      throw new NotFoundError("Course", section.courseId);
    }

    if (course.departmentId !== department._id) {
      throw new ValidationError(
        "sectionId",
        "Section does not belong to your department"
      );
    }

    // Validate instructor exists and has instructor role
    const instructor = await ctx.db.get(args.instructorId);
    if (!instructor) {
      throw new NotFoundError("Instructor", args.instructorId);
    }

    if (!instructor.roles.includes("instructor")) {
      throw new ValidationError(
        "instructorId",
        "User must have instructor role"
      );
    }

    // Validate that the instructor belongs to this department OR Institute of Humanities
    const instructorRecord = await ctx.db
      .query("instructors")
      .withIndex("by_userId", (q) => q.eq("userId", args.instructorId))
      .first();

    if (!instructorRecord) {
      throw new ValidationError(
        "instructorId",
        "Instructor record not found"
      );
    }

    // Check if instructor belongs to department head's department
    const belongsToDepartment = instructorRecord.departmentId === department._id;

    // Also check if instructor belongs to Institute of Humanities
    const humanitiesDepartment = await ctx.db
      .query("departments")
      .withIndex("by_name", (q) => q.eq("name", "Institute of Humanities"))
      .first();

    const belongsToHumanities = humanitiesDepartment 
      ? instructorRecord.departmentId === humanitiesDepartment._id
      : false;

    if (!belongsToDepartment && !belongsToHumanities) {
      throw new ValidationError(
        "instructorId",
        "Instructor must belong to your department or Institute of Humanities"
      );
    }

    // Update the section
    await ctx.db.patch(args.sectionId, {
      instructorId: args.instructorId,
    });

    // Create notification for the instructor
    // Note: We create it directly here, but also have triggerAssignmentNotification
    // as an internal function for potential future use (e.g., from actions or scheduled tasks)
    await ctx.db.insert("notifications", {
      userId: args.instructorId,
      message: `You have been assigned to ${course.title}`,
      read: false,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal function to trigger assignment notification
 * Creates a notification record for the instructor when assigned to a course
 */
export const triggerAssignmentNotification = internalMutation({
  args: {
    instructorId: v.id("users"),
    courseName: v.string(),
  },
  handler: async (ctx, args) => {
    // Create notification for the instructor
    await ctx.db.insert("notifications", {
      userId: args.instructorId,
      message: `You have been assigned to ${args.courseName}`,
      read: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Remove an instructor from a section (set instructorId to null)
 * Note: Since schema requires instructorId, we'll use the department head as placeholder
 */
export const removeInstructor = mutation({
  args: {
    token: v.optional(v.string()),
    sectionId: v.id("sections"),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get the section
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Validate that the section's course belongs to this department
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      throw new NotFoundError("Course", section.courseId);
    }

    if (course.departmentId !== department._id) {
      throw new ValidationError(
        "sectionId",
        "Section does not belong to your department"
      );
    }

    // Since schema requires instructorId, we'll use the department head as placeholder
    // This will show as "Unassigned" in the UI
    await ctx.db.patch(args.sectionId, {
      instructorId: userId, // Department head as placeholder
    });

    return { success: true };
  },
});

/**
 * Delete a section
 * Validates that the section belongs to the department and has no enrollments
 */
export const deleteSection = mutation({
  args: {
    token: v.optional(v.string()),
    sectionId: v.id("sections"),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get the section
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new NotFoundError("Section", args.sectionId);
    }

    // Validate that the section's course belongs to this department
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      throw new NotFoundError("Course", section.courseId);
    }

    if (course.departmentId !== department._id) {
      throw new ValidationError(
        "sectionId",
        "Section does not belong to your department"
      );
    }

    // Prevent deletion of published sections
    if (section.isOpenForEnrollment === true) {
      throw new ValidationError(
        "sectionId",
        "Cannot delete published sections. Please unpublish the section first."
      );
    }

    // Check if there are any enrollments for this section
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    if (enrollments.length > 0) {
      throw new ValidationError(
        "sectionId",
        `Cannot delete section: ${enrollments.length} student(s) are enrolled. Please remove enrollments first.`
      );
    }

    // Delete the section
    await ctx.db.delete(args.sectionId);

    return { success: true };
  },
});

/**
 * Bulk create sections for multiple courses
 * Creates a section for each course ID with default capacity of 50
 */
export const bulkCreateSections = mutation({
  args: {
    token: v.optional(v.string()),
    courseIds: v.array(v.id("courses")),
    termId: v.id("terms"),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Validate term exists
    const term = await ctx.db.get(args.termId);
    if (!term) {
      throw new NotFoundError("Term", args.termId);
    }

    // Get session from term
    const session = await ctx.db.get(term.sessionId);
    if (!session) {
      throw new NotFoundError("Academic Session", term.sessionId);
    }

    const defaultCapacity = args.capacity || 50;
    if (defaultCapacity <= 0) {
      throw new ValidationError("capacity", "Capacity must be greater than 0");
    }

    const createdSectionIds: Id<"sections">[] = [];

    // Create sections for each course
    for (const courseId of args.courseIds) {
      // Validate that courseId belongs to this department
      const course = await ctx.db.get(courseId);
      if (!course) {
        throw new NotFoundError("Course", courseId);
      }

      if (course.departmentId !== department._id) {
        throw new ValidationError(
          "courseIds",
          `Course ${course.code} does not belong to your department`
        );
      }

      // Check if section already exists for this course and term
      const existingSection = await ctx.db
        .query("sections")
        .withIndex("by_courseId_termId", (q) =>
          q.eq("courseId", courseId).eq("termId", args.termId)
        )
        .first();

      if (existingSection) {
        // Skip if section already exists
        continue;
      }

      // Create the section
      const sectionId = await ctx.db.insert("sections", {
        courseId,
        sessionId: term.sessionId,
        termId: args.termId,
        instructorId: userId, // Use department head as placeholder
        capacity: defaultCapacity,
        scheduleSlots: [],
        enrollmentCount: 0,
        isOpenForEnrollment: false, // New sections start as Draft
      });

      createdSectionIds.push(sectionId);
    }

    return { success: true, sectionIds: createdSectionIds, count: createdSectionIds.length };
  },
});

/**
 * Clone sections from a source term to a target term
 * Optionally keeps or clears instructor assignments
 */
export const cloneSectionsFromTerm = mutation({
  args: {
    token: v.optional(v.string()),
    sourceTermId: v.id("terms"),
    targetTermId: v.id("terms"),
    keepInstructors: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Validate both terms exist
    const sourceTerm = await ctx.db.get(args.sourceTermId);
    if (!sourceTerm) {
      throw new NotFoundError("Source Term", args.sourceTermId);
    }

    const targetTerm = await ctx.db.get(args.targetTermId);
    if (!targetTerm) {
      throw new NotFoundError("Target Term", args.targetTermId);
    }

    // Get session from target term
    const targetSession = await ctx.db.get(targetTerm.sessionId);
    if (!targetSession) {
      throw new NotFoundError("Academic Session", targetTerm.sessionId);
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    // Get all sections from source term for this department
    const sourceSections = await ctx.db
      .query("sections")
      .withIndex("by_termId", (q) => q.eq("termId", args.sourceTermId))
      .collect();

    const departmentSourceSections = sourceSections.filter((section) =>
      courseIds.includes(section.courseId)
    );

    const clonedSectionIds: Id<"sections">[] = [];

    // Clone each section
    for (const sourceSection of departmentSourceSections) {
      // Check if section already exists for this course and target term
      const existingSection = await ctx.db
        .query("sections")
        .withIndex("by_courseId_termId", (q) =>
          q.eq("courseId", sourceSection.courseId).eq("termId", args.targetTermId)
        )
        .first();

      if (existingSection) {
        // Skip if section already exists
        continue;
      }

      // Determine instructor ID based on keepInstructors flag
      let instructorIdToUse: Id<"users"> = userId; // Default to department head
      if (args.keepInstructors && sourceSection.instructorId) {
        // Validate instructor still exists and has instructor role
        const instructor = await ctx.db.get(sourceSection.instructorId);
        if (instructor && instructor.roles.includes("instructor")) {
          instructorIdToUse = sourceSection.instructorId;
        }
      }

      // Create the cloned section
      const sectionId = await ctx.db.insert("sections", {
        courseId: sourceSection.courseId,
        sessionId: targetTerm.sessionId,
        termId: args.targetTermId,
        instructorId: instructorIdToUse,
        capacity: sourceSection.capacity,
        scheduleSlots: sourceSection.scheduleSlots, // Copy schedule slots
        enrollmentCount: 0, // Reset enrollment count
        isOpenForEnrollment: false, // Cloned sections start as Draft
      });

      clonedSectionIds.push(sectionId);
    }

    return { success: true, sectionIds: clonedSectionIds, count: clonedSectionIds.length };
  },
});

/**
 * Publish sections by setting isOpenForEnrollment to true
 * Makes sections available in the Student Catalog
 */
export const publishSections = mutation({
  args: {
    token: v.optional(v.string()),
    sectionIds: v.array(v.id("sections")),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new ValidationError("token", "Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new ValidationError("token", "Invalid session token");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    // Verify role is department_head
    if (!user.roles.includes("department_head")) {
      throw new Error("Access denied: Department head role required");
    }

    // Find department where this user is the head
    const department = await ctx.db
      .query("departments")
      .withIndex("by_headId", (q) => q.eq("headId", userId))
      .first();

    if (!department) {
      throw new Error("Department not found for this user");
    }

    // Get all courses in this department
    const departmentCourses = await ctx.db
      .query("courses")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", department._id))
      .collect();

    const courseIds = departmentCourses.map((c) => c._id);

    let publishedCount = 0;

    // Publish each section (only if it belongs to this department)
    for (const sectionId of args.sectionIds) {
      const section = await ctx.db.get(sectionId);
      if (!section) {
        continue; // Skip if section doesn't exist
      }

      // Verify section belongs to this department
      if (!courseIds.includes(section.courseId)) {
        continue; // Skip sections not in this department
      }

      // Update section to be open for enrollment
      await ctx.db.patch(sectionId, {
        isOpenForEnrollment: true,
      });

      publishedCount++;
    }

    return { success: true, count: publishedCount };
  },
});

