/**
 * Graduation Mutations
 * 
 * Transactional operations for processing student graduations.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError } from "../lib/errors";
import {
  validateApproverAuthority,
} from "../lib/aggregates";
import {
  runDegreeAudit,
} from "../lib/services/graduationService";
import { logGraduationApproved, logAlumniProfileCreated } from "../lib/services/auditLogService";
import { Id } from "../_generated/dataModel";

/**
 * Operation: Process a Student's Graduation
 * 
 * This is a transactional operation that:
 * 1. Runs degree audit
 * 2. Validates all graduation requirements are satisfied
 * 3. Updates student status to "graduated"
 * 4. Creates graduation record
 * 5. Creates audit log
 * 
 * All steps are atomic - if any step fails, the entire transaction is rolled back.
 * The student's status only changes if the graduation record is successfully created.
 */
export const processStudentGraduation = mutation({
  args: {
    studentId: v.id("students"),
    approverUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Step 1: Read student
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new NotFoundError("Student", args.studentId);
    }

    // Step 2: Validate approver has authority
    await validateApproverAuthority(ctx.db, args.approverUserId);

    // Step 3: Run degree audit (GraduationService)
    // This checks all graduation requirements
    const auditResult = await runDegreeAudit(ctx.db, args.studentId);

    // Step 4: Invariant Check: All graduation requirements must be satisfied
    if (!auditResult.eligible) {
      throw new Error(
        `Student does not meet graduation requirements: ${auditResult.missingRequirements.join("; ")}`
      );
    }

    // Step 5: Update student status to "graduated"
    // This happens atomically with graduation record creation
    await ctx.db.patch(args.studentId, {
      status: "graduated",
    });

    // Step 6: Create graduation record
    const graduationId = await ctx.db.insert("graduationRecords", {
      studentId: args.studentId,
      approvedBy: args.approverUserId,
      date: Date.now(),
    });

    // Step 7: Create audit log entry
    await logGraduationApproved(
      ctx.db,
      args.approverUserId,
      graduationId,
      {
        studentId: args.studentId,
        departmentId: student.departmentId,
        auditResult: {
          totalCredits: auditResult.totalCredits,
          requiredCredits: auditResult.requiredCredits,
          gpa: auditResult.gpa,
          requiredGPA: auditResult.requiredGPA,
        },
      }
    );

    // Auto-create alumni profile (defaults: email from user, phone/address empty, employmentStatus unknown)
    const user = await ctx.db.get(student.userId);
    const alumniId = await ctx.db.insert("alumniProfiles", {
      studentId: args.studentId,
      graduationYear: new Date().getFullYear(),
      contactInfo: {
        email: user?.email ?? "",
        phone: "",
        address: {
          street: "",
          city: "",
          state: "",
          postalCode: "",
          country: "",
        },
      },
      employmentStatus: "unknown",
    });

    // Audit log for alumni profile creation
    await logAlumniProfileCreated(ctx.db, args.approverUserId, alumniId, {
      graduationId,
      studentId: args.studentId,
      graduationYear: new Date().getFullYear(),
    });

    return {
      success: true,
      graduationId,
      studentId: args.studentId,
      auditResult,
      alumniId,
    };
  },
});

/**
 * Get graduation eligibility status (query - non-transactional)
 * 
 * This is a read-only operation to check if a student is eligible for graduation.
 */
export const checkGraduationEligibility = mutation({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const auditResult = await runDegreeAudit(ctx.db, args.studentId);

    return {
      eligible: auditResult.eligible,
      missingRequirements: auditResult.missingRequirements,
      totalCredits: auditResult.totalCredits,
      requiredCredits: auditResult.requiredCredits,
      gpa: auditResult.gpa,
      requiredGPA: auditResult.requiredGPA,
    };
  },
});

/**
 * Get all students for graduation management
 * 
 * Returns list of all active students (not graduated) with their user and department information.
 * Only accessible to users with approver authority.
 */
export const getAllStudentsForGraduation = query({
  args: {
    requesterUserId: v.id("users"),
    departmentId: v.optional(v.id("departments")),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate requester has authority
    await validateApproverAuthority(ctx.db, args.requesterUserId);

    // Get all students that are not graduated
    let students = await ctx.db
      .query("students")
      .filter((q) => q.neq(q.field("status"), "graduated"))
      .collect();

    // Filter by department if provided
    if (args.departmentId) {
      students = students.filter((s) => s.departmentId === args.departmentId);
    }

    // Enrich students with user and department information
    const enrichedStudents = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        const department = await ctx.db.get(student.departmentId);

        // Get transcript for GPA and credits
        const transcript = await ctx.db
          .query("transcripts")
          .withIndex("by_studentId", (q) => q.eq("studentId", student._id))
          .first();

        const name = user
          ? `${user.profile.firstName} ${user.profile.lastName}`
          : "Unknown";

        // Apply search filter if provided
        if (args.searchTerm) {
          const searchLower = args.searchTerm.toLowerCase();
          const nameMatch = name.toLowerCase().includes(searchLower);
          const studentNumberMatch = student.studentNumber
            .toLowerCase()
            .includes(searchLower);
          if (!nameMatch && !studentNumberMatch) {
            return null;
          }
        }

        return {
          _id: student._id,
          studentNumber: student.studentNumber,
          name,
          email: user?.email ?? "",
          department: department
            ? {
                _id: department._id,
                name: department.name,
              }
            : null,
          status: student.status,
          level: student.level,
          gpa: transcript?.gpa ?? 0,
          totalCredits: transcript?.entries.reduce(
            (sum, entry) => sum + entry.credits,
            0
          ) ?? 0,
        };
      })
    );

    // Filter out nulls from search
    return enrichedStudents.filter(
      (s): s is NonNullable<typeof s> => s !== null
    );
  },
});

/**
 * Get all graduation records with approver and student information
 * 
 * Returns list of all graduation records with enriched information about
 * the student and the approver. Only accessible to registrars.
 */
export const getAllGraduationRecords = query({
  args: {
    requesterUserId: v.id("users"),
    studentId: v.optional(v.id("students")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate requester has authority (must be registrar)
    await validateApproverAuthority(ctx.db, args.requesterUserId);

    // Get all graduation records
    let graduationRecords = await ctx.db.query("graduationRecords").collect();

    // Filter by student if provided
    if (args.studentId) {
      graduationRecords = graduationRecords.filter(
        (record) => record.studentId === args.studentId
      );
    }

    // Filter by date range if provided
    if (args.startDate) {
      graduationRecords = graduationRecords.filter(
        (record) => record.date >= args.startDate!
      );
    }
    if (args.endDate) {
      graduationRecords = graduationRecords.filter(
        (record) => record.date <= args.endDate!
      );
    }

    // Sort by date (most recent first)
    graduationRecords.sort((a, b) => b.date - a.date);

    // Enrich records with student and approver information
    const enrichedRecords = await Promise.all(
      graduationRecords.map(async (record) => {
        const student = await ctx.db.get(record.studentId);
        const approver = await ctx.db.get(record.approvedBy);
        const department = student
          ? await ctx.db.get(student.departmentId)
          : null;

        // Get student user for name
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const studentName = studentUser
          ? `${studentUser.profile.firstName} ${studentUser.profile.lastName}`
          : "Unknown";

        const approverName = approver
          ? `${approver.profile.firstName} ${approver.profile.lastName}`
          : "Unknown";

        // Get graduation year from date
        const graduationYear = new Date(record.date).getFullYear();

        return {
          _id: record._id,
          studentId: record.studentId,
          studentName,
          studentNumber: student?.studentNumber ?? "N/A",
          department: department?.name ?? "N/A",
          approvedBy: record.approvedBy,
          approverName,
          approverEmail: approver?.email ?? "N/A",
          date: record.date,
          graduationYear,
        };
      })
    );

    return enrichedRecords;
  },
});

