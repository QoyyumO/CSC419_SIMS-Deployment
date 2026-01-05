/**
 * Registrar Queries and Mutations
 * 
 * Provides queries and mutations for registrar grade management.
 * Accessible only to users with role === 'registrar'.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "../lib/session";
import { Id } from "../_generated/dataModel";
import { computeFinalGrade } from "../lib/services/gradingService";

/**
 * Get all sections with aggregated status for registrar grade dashboard
 * Input: term (string) - term name to filter by
 * Returns: List of all sections with aggregated status and % of students graded
 */
export const getAllSectionsStatus = query({
  args: {
    token: v.optional(v.string()),
    term: v.optional(v.string()), // Term name as string
    departmentId: v.optional(v.id("departments")),
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

    // Verify role is registrar
    if (!user.roles.includes("registrar")) {
      throw new Error("Access denied: Registrar role required");
    }

    // Get all sections
    let sections = await ctx.db.query("sections").collect();

    // Filter by term if provided
    if (args.term) {
      // Find term by name
      const terms = await ctx.db.query("terms").collect();
      const matchingTerm = terms.find((t) => t.name === args.term);
      if (matchingTerm) {
        sections = sections.filter((section) => section.termId === matchingTerm._id);
      } else {
        // If term not found, return empty array
        return [];
      }
    }

    // Filter by department if provided
    if (args.departmentId) {
      // Get all courses in this department
      const departmentId = args.departmentId; // TypeScript narrowing
      const departmentCourses = await ctx.db
        .query("courses")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();
      
      const courseIds = departmentCourses.map((c) => c._id);
      sections = sections.filter((section) => courseIds.includes(section.courseId));
    }

    // Enrich sections with course, instructor, and grade status information
    const sectionsWithStatus = await Promise.all(
      sections.map(async (section) => {
        // Get course information
        const course = await ctx.db.get(section.courseId);
        if (!course) {
          return null;
        }

        // Get department information
        const department = await ctx.db.get(course.departmentId);
        
        // Get instructor information
        const instructor = section.instructorId
          ? await ctx.db.get(section.instructorId)
          : null;
        
        const instructorName = instructor
          ? `${instructor.profile.firstName} ${instructor.profile.lastName}`
          : "Unassigned";

        // Get term information
        const term = await ctx.db.get(section.termId);
        const termName = term?.name || "Unknown";

        // Get all enrollments for this section
        const enrollments = await ctx.db
          .query("enrollments")
          .withIndex("by_sectionId", (q) => q.eq("sectionId", section._id))
          .filter((q) =>
            q.or(
              q.eq(q.field("status"), "enrolled"),
              q.eq(q.field("status"), "active")
            )
          )
          .collect();

        const totalStudents = enrollments.length;

        // Count students with final grades (enrollment.grade is set)
        const studentsWithGrades = enrollments.filter((e) => e.grade !== undefined && e.grade !== null).length;

        // Calculate percentage of students graded
        const percentageGraded = totalStudents > 0
          ? Math.round((studentsWithGrades / totalStudents) * 100)
          : 0;

        // Determine grade status
        // Locked = sections with submitted grades that are locked (isLocked=true OR finalGradesPosted=true with gradesEditable=false)
        // Pending = sections that are not locked (including unlocked sections that were previously submitted)
        // Grades Submitted = sections with submitted grades that are not locked and not editable (transitional state)
        let gradeStatus: "Grades Submitted" | "Pending" | "Locked";
        if (section.isLocked === true) {
          // Section is explicitly locked
          gradeStatus = "Locked";
        } else if (section.finalGradesPosted && section.gradesEditable === false) {
          // Grades posted but not editable (locked state)
          gradeStatus = "Locked";
        } else if (section.finalGradesPosted && section.gradesEditable === true) {
          // Unlocked section with submitted grades - show as Pending (open for editing)
          gradeStatus = "Pending";
        } else if (section.finalGradesPosted) {
          // Grades posted but gradesEditable is undefined/null - treat as submitted but not yet locked
          gradeStatus = "Grades Submitted";
        } else {
          // No grades posted yet
          gradeStatus = "Pending";
        }

        return {
          _id: section._id,
          courseCode: course.code,
          courseTitle: course.title,
          departmentId: course.departmentId,
          departmentName: department?.name || "Unknown",
          instructorId: section.instructorId,
          instructorName,
          termId: section.termId,
          termName,
          totalStudents,
          studentsWithGrades,
          percentageGraded,
          gradeStatus,
          finalGradesPosted: section.finalGradesPosted ?? false,
          gradesEditable: section.gradesEditable ?? true,
          isLocked: section.isLocked ?? false,
        };
      })
    );

    // Filter out null entries
    return sectionsWithStatus.filter((s) => s !== null) as Array<{
      _id: Id<"sections">;
      courseCode: string;
      courseTitle: string;
      departmentId: Id<"departments">;
      departmentName: string;
      instructorId: Id<"users"> | null;
      instructorName: string;
      termId: Id<"terms">;
      termName: string;
      totalStudents: number;
      studentsWithGrades: number;
      percentageGraded: number;
      gradeStatus: "Grades Submitted" | "Pending" | "Locked";
      finalGradesPosted: boolean;
      gradesEditable: boolean;
      isLocked: boolean;
    }>;
  },
});

/**
 * Send reminder notification to instructor
 * Input: instructorId
 * Logic: Triggers a notification "Please submit grades for [Section]"
 */
export const sendReminder = mutation({
  args: {
    token: v.optional(v.string()),
    instructorId: v.id("users"),
    sectionId: v.id("sections"),
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

    // Verify role is registrar
    if (!user.roles.includes("registrar")) {
      throw new Error("Access denied: Registrar role required");
    }

    // Verify instructor exists
    const instructor = await ctx.db.get(args.instructorId);
    if (!instructor) {
      throw new Error("Instructor not found");
    }

    // Get section information
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    // Verify instructor is assigned to this section
    if (section.instructorId !== args.instructorId) {
      throw new Error("Instructor is not assigned to this section");
    }

    // Get course information for the notification message
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Create notification for the instructor
    await ctx.db.insert("notifications", {
      userId: args.instructorId,
      message: `Please submit grades for ${course.code} - ${course.title}`,
      read: false,
      createdAt: Date.now(),
      courseId: course._id,
    });

    return { success: true };
  },
});

/**
 * Set section lock status (Registrar only)
 * Inputs: sectionId, locked (boolean), reason (string)
 * Logic:
 * - Updates the section's isLocked status
 * - If locking: sets enrollment status to "completed" and gradesEditable to false
 * - If unlocking: sets isLocked to false and gradesEditable to true
 * - Inserts a record into grade_audit_log
 * - If unlocking, triggers a notification to the Instructor
 */
export const setSectionLock = mutation({
  args: {
    token: v.optional(v.string()),
    sectionId: v.id("sections"),
    locked: v.boolean(),
    reason: v.string(),
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

    // Verify role is registrar
    if (!user.roles.includes("registrar")) {
      throw new Error("Access denied: Registrar role required");
    }

    // Validate reason is not empty
    if (!args.reason || args.reason.trim().length === 0) {
      throw new Error("Reason is required for lock/unlock actions");
    }

    // Get section
    const section = await ctx.db.get(args.sectionId);
    if (!section) {
      throw new Error("Section not found");
    }

    // Get course information for notifications
    const course = await ctx.db.get(section.courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    // Update section's isLocked status
    await ctx.db.patch(args.sectionId, {
      isLocked: args.locked,
      gradesEditable: args.locked ? false : true, // Lock: disable editing, Unlock: enable editing
    });

    // Get all enrollments in this section
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    // Update enrollment status based on lock/unlock action
    if (args.locked) {
      // If locking, update all enrollments to "completed" status
      for (const enrollment of enrollments) {
        await ctx.db.patch(enrollment._id, {
          status: "completed",
        });
      }
    } else {
      // If unlocking, update all enrollments back to "active" status
      for (const enrollment of enrollments) {
        await ctx.db.patch(enrollment._id, {
          status: "active",
        });
      }
    }

    // Insert record into grade_audit_log
    await ctx.db.insert("grade_audit_log", {
      adminId: userId,
      sectionId: args.sectionId,
      action: args.locked ? "LOCK" : "UNLOCK",
      reason: args.reason.trim(),
      timestamp: Date.now(),
    });

    // If unlocking, trigger notification to instructor
    if (!args.locked && section.instructorId) {
      await ctx.db.insert("notifications", {
        userId: section.instructorId,
        message: `Section ${course.code} - ${course.title} has been unlocked for grading.`,
        read: false,
        createdAt: Date.now(),
        courseId: course._id,
      });
    }

    return { success: true, locked: args.locked };
  },
});

/**
 * Get grade audit log entries (Registrar only)
 * Returns: List of all grade audit log entries with admin, section, and course information
 */
export const getGradeAuditLog = query({
  args: {
    token: v.optional(v.string()),
    sectionId: v.optional(v.id("sections")), // Optional filter by section
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

    // Verify role is registrar
    if (!user.roles.includes("registrar")) {
      throw new Error("Access denied: Registrar role required");
    }

    // Get audit log entries
    let auditLogs = await ctx.db.query("grade_audit_log").collect();

    // Filter by section if provided
    if (args.sectionId) {
      auditLogs = auditLogs.filter((log) => log.sectionId === args.sectionId);
    }

    // Sort by timestamp (most recent first)
    auditLogs.sort((a, b) => b.timestamp - a.timestamp);

    // Enrich with admin, section, and course information
    const enrichedLogs = await Promise.all(
      auditLogs.map(async (log) => {
        const admin = await ctx.db.get(log.adminId);
        const section = await ctx.db.get(log.sectionId);
        const course = section ? await ctx.db.get(section.courseId) : null;

        return {
          _id: log._id,
          adminId: log.adminId,
          adminName: admin
            ? `${admin.profile.firstName} ${admin.profile.lastName}`
            : "Unknown",
          sectionId: log.sectionId,
          sectionName: section && course ? `${course.code} - ${course.title}` : "Unknown",
          action: log.action,
          reason: log.reason,
          timestamp: log.timestamp,
        };
      })
    );

    return enrichedLogs;
  },
});

/**
 * Process term end: Calculate academic standing and lock sections
 * Input: termId
 * Logic:
 * - Fetch all students active in the term
 * - Calculate Term GPA for each student
 * - Set academic standing based on GPA ranges
 * - Lock all sections for that term
 */
export const processTermEnd = mutation({
  args: {
    token: v.optional(v.string()),
    termId: v.id("terms"),
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

    // Verify role is registrar
    if (!user.roles.includes("registrar")) {
      throw new Error("Access denied: Registrar role required");
    }

    // Get term
    const term = await ctx.db.get(args.termId);
    if (!term) {
      throw new Error("Term not found");
    }

    // Check that all sections in the term with enrollments have final grades posted
    const allSections = await ctx.db
      .query("sections")
      .withIndex("by_termId", (q) => q.eq("termId", args.termId))
      .collect();

    // Check each section to see if it has enrollments and if grades are posted
    const sectionsWithoutGrades: Array<{ section: typeof allSections[0]; courseName: string }> = [];
    
    for (const section of allSections) {
      // Only check sections that have enrollments
      if (section.enrollmentCount > 0 && !section.finalGradesPosted) {
        const course = await ctx.db.get(section.courseId);
        sectionsWithoutGrades.push({
          section,
          courseName: course ? `${course.code} - ${course.title}` : "Unknown Course",
        });
      }
    }

    if (sectionsWithoutGrades.length > 0) {
      const sectionsInfo = sectionsWithoutGrades.map((s) => s.courseName);
      throw new Error(
        `Cannot process term end: ${sectionsWithoutGrades.length} section(s) with enrollments do not have final grades posted. ` +
        `Please ensure all instructors have published final grades before processing. ` +
        `Sections pending: ${sectionsInfo.join(", ")}`
      );
    }

    // Get all enrollments for this term
    const enrollments = await ctx.db
      .query("enrollments")
      .withIndex("by_termId", (q) => q.eq("termId", args.termId))
      .collect();

    // Get unique student IDs from enrollments
    const studentIds = [...new Set(enrollments.map((e) => e.studentId))];

    // Grade point mapping (using 5.0 scale as per enrollmentMutations.ts)
    // This matches the scale used when final grades are posted
    const getGradePoints = (letterGrade: string): number => {
      switch (letterGrade.toUpperCase()) {
        case "A":
          return 5.0;
        case "B":
          return 4.0;
        case "C":
          return 3.0;
        case "D":
          return 2.0;
        case "E":
          return 1.0;
        case "F":
          return 0.0;
        default:
          return 0.0;
      }
    };

    // Convert percentage to grade points (for when we need to compute from percentage)
    // This matches the scale in enrollmentMutations.ts convertPercentageToFinalGrade
    const percentageToGradePoints = (percentage: number): number => {
      if (percentage >= 70) return 5.0;
      if (percentage >= 60) return 4.0;
      if (percentage >= 50) return 3.0;
      if (percentage >= 45) return 2.0;
      if (percentage >= 40) return 1.0;
      return 0.0;
    };

    // Process each student
    const standingCounts = {
      "First Class": 0,
      "Second Class (Upper Division)": 0,
      "Second Class (Lower Division)": 0,
      "Third Class": 0,
      "Probation": 0,
    };

    for (const studentId of studentIds) {
      // Get student record
      const student = await ctx.db.get(studentId);
      if (!student) {
        continue;
      }

      // Get all enrollments for this student in this term
      const studentEnrollments = enrollments.filter(
        (e) => e.studentId === studentId && e.status === "completed"
      );

      if (studentEnrollments.length === 0) {
        // If no completed enrollments, skip or set to default standing
        continue;
      }

      // Calculate Term GPA
      let totalGradePoints = 0;
      let totalCredits = 0;

      for (const enrollment of studentEnrollments) {
        try {
          // Get section and course to get credits
          const section = await ctx.db.get(enrollment.sectionId);
          if (!section) continue;

          const course = await ctx.db.get(section.courseId);
          if (!course) continue;

          // Try to get grade from enrollment first (if already posted)
          let gradePoints = 0;
          if (enrollment.grade) {
            // Use the posted grade (already in 5.0 scale from enrollmentMutations)
            gradePoints = getGradePoints(enrollment.grade);
          } else {
            // Try to calculate final grade from assessments
            try {
              const { finalPercentage } = await computeFinalGrade(ctx.db, enrollment._id);
              // Convert percentage to grade points using 5.0 scale
              gradePoints = percentageToGradePoints(finalPercentage);
            } catch {
              // If final grade can't be calculated, skip this enrollment
              continue;
            }
          }

          // Only count courses with valid grades for GPA
          if (gradePoints >= 0) {
            totalGradePoints += gradePoints * course.credits;
            totalCredits += course.credits;
          }
        } catch {
          // Skip this enrollment if there's an error
          continue;
        }
      }

      // Calculate Term GPA
      const termGPA = totalCredits > 0 ? totalGradePoints / totalCredits : 0;
      const roundedGPA = Math.round(termGPA * 100) / 100;

      // Determine academic standing based on GPA
      let academicStanding: string;
      if (roundedGPA >= 4.5) {
        academicStanding = "First Class";
        standingCounts["First Class"]++;
      } else if (roundedGPA >= 3.5 && roundedGPA < 4.49) {
        academicStanding = "Second Class (Upper Division)";
        standingCounts["Second Class (Upper Division)"]++;
      } else if (roundedGPA >= 2.4 && roundedGPA < 3.49) {
        academicStanding = "Second Class (Lower Division)";
        standingCounts["Second Class (Lower Division)"]++;
      } else if (roundedGPA >= 1.5 && roundedGPA < 2.39) {
        academicStanding = "Third Class";
        standingCounts["Third Class"]++;
      } else {
        academicStanding = "Probation";
        standingCounts["Probation"]++;
      }

      // Update student record with academic standing
      await ctx.db.patch(studentId, {
        academicStanding,
      });
    }

    // Lock all sections for this term
    const sections = await ctx.db
      .query("sections")
      .withIndex("by_termId", (q) => q.eq("termId", args.termId))
      .collect();

    for (const section of sections) {
      await ctx.db.patch(section._id, {
        isLocked: true,
        gradesEditable: false,
      });
    }

    return {
      success: true,
      termName: term.name,
      studentsProcessed: studentIds.length,
      standingCounts,
    };
  },
});

