import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError, ValidationError } from "../lib/errors";
import { validateApproverAuthority } from "../lib/aggregates";
import { logAlumniProfileCreated, logAlumniProfileUpdated } from "../lib/services/auditLogService";

/**
 * Get Alumni Profile by studentId
 */
export const getAlumniProfile = query({
  args: {
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("alumniProfiles")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .first();

    if (!profile) return null;

    const student = await ctx.db.get(profile.studentId);
    const user = student ? await ctx.db.get(student.userId) : null;
    const department = student ? await ctx.db.get(student.departmentId) : null;

    return {
      _id: profile._id,
      student: student
        ? {
            _id: student._id,
            studentNumber: student.studentNumber,
            admissionYear: student.admissionYear,
            department: department
              ? { _id: department._id, name: department.name }
              : null,
            user: user
              ? { _id: user._id, profile: user.profile, email: user.email }
              : null,
          }
        : null,
      graduationYear: profile.graduationYear,
      contactInfo: profile.contactInfo,
      employmentStatus: profile.employmentStatus,
      currentEmployer: profile.currentEmployer,
      jobTitle: profile.jobTitle,
      linkedInUrl: profile.linkedInUrl,
    };
  },
});

/**
 * Create Alumni Profile (requires approver authority)
 */
export const createAlumniProfile = mutation({
  args: {
    createdByUserId: v.id("users"),
    studentId: v.id("students"),
    graduationYear: v.number(),
    contactInfo: v.object({
      email: v.string(),
      phone: v.string(),
      address: v.object({
        street: v.optional(v.string()),
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
    }),
    employmentStatus: v.string(),
    currentEmployer: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // only admins/registrars/department heads can create manually
    await validateApproverAuthority(ctx.db, args.createdByUserId);

    const student = await ctx.db.get(args.studentId);
    if (!student) throw new NotFoundError("Student", args.studentId);

    // Ensure not already exists
    const existing = await ctx.db
      .query("alumniProfiles")
      .withIndex("by_studentId", (q) => q.eq("studentId", args.studentId))
      .first();

    if (existing) {
      throw new ValidationError("studentId", "Alumni profile already exists for this student");
    }

    // Ensure address fields are strings (schema requires string fields)
    const address = {
      street: args.contactInfo.address.street ?? "",
      city: args.contactInfo.address.city ?? "",
      state: args.contactInfo.address.state ?? "",
      postalCode: args.contactInfo.address.postalCode ?? "",
      country: args.contactInfo.address.country ?? "",
    };

    const alumniId = await ctx.db.insert("alumniProfiles", {
      studentId: args.studentId,
      graduationYear: args.graduationYear,
      contactInfo: { email: args.contactInfo.email, phone: args.contactInfo.phone, address },
      employmentStatus: args.employmentStatus,
      currentEmployer: args.currentEmployer,
      jobTitle: args.jobTitle,
      linkedInUrl: args.linkedInUrl,
    });

    // Audit log
    await logAlumniProfileCreated(ctx.db, args.createdByUserId, alumniId, {
      studentId: args.studentId,
      graduationYear: args.graduationYear,
    });

    return { success: true, alumniId };
  },
});

/**
 * Update Alumni Profile (alumni or admin)
 */
export const updateAlumniProfile = mutation({
  args: {
    requesterUserId: v.id("users"),
    alumniId: v.id("alumniProfiles"),
    updates: v.object({
      contactInfo: v.optional(
        v.object({
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          address: v.optional(
            v.object({
              street: v.optional(v.string()),
              city: v.optional(v.string()),
              state: v.optional(v.string()),
              postalCode: v.optional(v.string()),
              country: v.optional(v.string()),
            })
          ),
        })
      ),
      employmentStatus: v.optional(v.string()),
      currentEmployer: v.optional(v.string()),
      jobTitle: v.optional(v.string()),
      linkedInUrl: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.alumniId);
    if (!profile) throw new NotFoundError("AlumniProfile", args.alumniId);

    const student = await ctx.db.get(profile.studentId);
    if (!student) throw new NotFoundError("Student", profile.studentId);

    const user = await ctx.db.get(args.requesterUserId);
    if (!user) throw new NotFoundError("User", args.requesterUserId);

    // Allow if requester is the student user or approver
    const isOwner = student.userId && student.userId.toString() === args.requesterUserId.toString();
    if (!isOwner) {
      // Validate approver authority (admin/registrar)
      await validateApproverAuthority(ctx.db, args.requesterUserId);
    }

    const patch: Record<string, unknown> = {};
    if (args.updates.contactInfo) patch.contactInfo = { ...profile.contactInfo, ...args.updates.contactInfo };
    if (args.updates.employmentStatus !== undefined) patch.employmentStatus = args.updates.employmentStatus;
    if (args.updates.currentEmployer !== undefined) patch.currentEmployer = args.updates.currentEmployer;
    if (args.updates.jobTitle !== undefined) patch.jobTitle = args.updates.jobTitle;
    if (args.updates.linkedInUrl !== undefined) patch.linkedInUrl = args.updates.linkedInUrl;

    await ctx.db.patch(args.alumniId, patch);

    // Audit log
    await logAlumniProfileUpdated(ctx.db, args.requesterUserId, args.alumniId, {
      updates: args.updates,
    });

    return { success: true };
  },
});

/**
 * Get all alumni (admin/registrar) with optional filters
 */
export const getAllAlumni = query({
  args: {
    requesterUserId: v.id("users"),
    graduationYear: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
    employmentStatus: v.optional(v.string()),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await validateApproverAuthority(ctx.db, args.requesterUserId);

    let alumni = await ctx.db.query("alumniProfiles").collect();

    if (args.graduationYear) {
      alumni = alumni.filter((a) => a.graduationYear === args.graduationYear);
    }

    if (args.employmentStatus) {
      alumni = alumni.filter((a) => a.employmentStatus === args.employmentStatus);
    }

    // If department filter is provided, join students and filter
    if (args.departmentId) {
      const deptId = args.departmentId.toString();
      const studentIds = alumni.map((a) => a.studentId);
      const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));
      alumni = alumni.filter((a, idx) => students[idx] && students[idx].departmentId && students[idx].departmentId.toString() === deptId);
    }

    // Apply searchTerm (name)
    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      // Fetch students + users for matching
      const studentIds = alumni.map((a) => a.studentId);
      const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));
      const users = await Promise.all(students.map((s) => (s ? ctx.db.get(s.userId) : null)));

      alumni = alumni.filter((a, idx) => {
        const student = students[idx];
        const user = users[idx];
        if (!student || !user) return false;
        const fullName = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase();
        return fullName.includes(term);
      });
    }

    // Map to lightweight DTO
    const result = await Promise.all(
      alumni.map(async (a) => {
        const student = await ctx.db.get(a.studentId);
        const user = student ? await ctx.db.get(student.userId) : null;
        const department = student ? await ctx.db.get(student.departmentId) : null;

        return {
          _id: a._id,
          student: student ? { _id: student._id, studentNumber: student.studentNumber } : null,
          name: user ? `${user.profile.firstName} ${user.profile.lastName}` : null,
          graduationYear: a.graduationYear,
          department: department ? { _id: department._id, name: department.name } : null,
          employmentStatus: a.employmentStatus,
          contactInfo: a.contactInfo,
        };
      })
    );

    return result;
  },
});

/**
 * Search Alumni (by name, graduation year, department)
 */
export const searchAlumni = query({
  args: {
    requesterUserId: v.id("users"),
    searchTerm: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    departmentId: v.optional(v.id("departments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await validateApproverAuthority(ctx.db, args.requesterUserId);

    let alumni = await ctx.db.query("alumniProfiles").collect();

    if (args.graduationYear) {
      alumni = alumni.filter((a) => a.graduationYear === args.graduationYear);
    }

    if (args.departmentId) {
      const deptId = args.departmentId.toString();
      const studentIds = alumni.map((a) => a.studentId);
      const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));
      alumni = alumni.filter((a, idx) => students[idx] && students[idx].departmentId && students[idx].departmentId.toString() === deptId);
    }

    if (args.searchTerm) {
      const term = args.searchTerm.toLowerCase();
      const studentIds = alumni.map((a) => a.studentId);
      const students = await Promise.all(studentIds.map((id) => ctx.db.get(id)));
      const users = await Promise.all(students.map((s) => (s ? ctx.db.get(s.userId) : null)));

      alumni = alumni.filter((a, idx) => {
        const student = students[idx];
        const user = users[idx];
        if (!student || !user) return false;
        const fullName = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase();
        return fullName.includes(term);
      });
    }

    if (args.limit) return alumni.slice(0, args.limit);
    return alumni;
  },
});

/**
 * Get Alumni Profile by alumni profile id
 */
export const getAlumniById = query({
  args: {
    alumniId: v.id("alumniProfiles"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.alumniId);
    if (!profile) return null;

    const student = await ctx.db.get(profile.studentId);
    const user = student ? await ctx.db.get(student.userId) : null;
    const department = student ? await ctx.db.get(student.departmentId) : null;

    return {
      _id: profile._id,
      student: student
        ? {
            _id: student._id,
            studentNumber: student.studentNumber,
            admissionYear: student.admissionYear,
            department: department
              ? { _id: department._id, name: department.name }
              : null,
            user: user
              ? { _id: user._id, profile: user.profile, email: user.email }
              : null,
          }
        : null,
      graduationYear: profile.graduationYear,
      contactInfo: profile.contactInfo,
      employmentStatus: profile.employmentStatus,
      currentEmployer: profile.currentEmployer,
      jobTitle: profile.jobTitle,
      linkedInUrl: profile.linkedInUrl,
    };
  },
});
