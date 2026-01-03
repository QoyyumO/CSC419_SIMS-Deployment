/**
 * Graduation Mutations
 * 
 * Transactional operations for processing student graduations.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError } from "../lib/errors";
import {
  validateApproverAuthority,
} from "../lib/aggregates";
import {
  runDegreeAudit,
} from "../lib/services/graduationService";
import { logGraduationApproved, logAlumniProfileCreated } from "../lib/services/auditLogService";

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

