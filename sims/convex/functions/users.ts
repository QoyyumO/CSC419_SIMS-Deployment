/**
 * User Management Functions
 *
 * Provides queries and mutations for user profile management,
 * user lookup, and role-based filtering.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { NotFoundError, ValidationError } from "../lib/errors";
import { validateUpdateUser, validateCreateUser } from "../lib/aggregates";
import { UserRole } from "../lib/aggregates/types";
import { createSession } from "../lib/session";

/**
 * Hash a password using Web Crypto API (PBKDF2)
 * This is compatible with Convex's server environment
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const key = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hash));
  const saltArray = Array.from(salt);
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  // Return in format: $pbkdf2$iterations$salt$hash
  return `$pbkdf2$100000$${saltHex}$${hashHex}`;
}

/**
 * Get user by ID (without password)
 */
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    return {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    };
  },
});

/**
 * Get user by email (without password)
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    };
  },
});

/**
 * Get user profile with student-specific data if user is a student
 * Returns program, enrollment status, and current term/year information
 */
export const getProfile = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    const baseProfile = {
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    };

    // If user is a student, fetch student-specific data
    if (user.roles.includes("student")) {
      const student = await ctx.db
        .query("students")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .first();

      if (student) {
        // Get department information
        const department = await ctx.db.get(student.departmentId);
        
        // Get school information for the department
        let school = null;
        if (department) {
          school = await ctx.db.get(department.schoolId);
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

        // Get academic session for current term
        let currentSession = null;
        if (currentTerm) {
          currentSession = await ctx.db.get(currentTerm.sessionId);
        }

        return {
          ...baseProfile,
          student: {
            _id: student._id,
            studentNumber: student.studentNumber,
            admissionYear: student.admissionYear,
            level: student.level,
            status: student.status,
            department: department ? {
              _id: department._id,
              name: department.name,
              school: school ? {
                _id: school._id,
                name: school.name,
              } : null,
            } : null,
            currentTerm: currentTerm ? {
              _id: currentTerm._id,
              name: currentTerm.name,
              session: currentSession ? {
                _id: currentSession._id,
                yearLabel: currentSession.yearLabel,
              } : null,
            } : null,
          },
        };
      }
    }

    return baseProfile;
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    profile: v.object({
      firstName: v.optional(v.string()),
      middleName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    const updatedProfile = {
      ...user.profile,
      ...(args.profile.firstName !== undefined && { firstName: args.profile.firstName }),
      ...(args.profile.middleName !== undefined && { middleName: args.profile.middleName }),
      ...(args.profile.lastName !== undefined && { lastName: args.profile.lastName }),
    };

    await validateUpdateUser(
      ctx.db,
      args.userId,
      undefined, // email
      undefined, // hashedPassword
      undefined, // roles
      updatedProfile
    );

    await ctx.db.patch(args.userId, {
      profile: updatedProfile,
    });

    return {
      success: true,
      profile: updatedProfile,
    };
  },
});

/**
 * Get all users (admin use)
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    }));
  },
});

/**
 * Check if email is available
 */
export const checkEmailAvailability = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    return {
      available: !existing,
    };
  },
});

/**
 * Get users by role
 */
export const getUsersByRole = query({
  args: {
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();

    const usersWithRole = allUsers.filter((user) =>
      user.roles.includes(args.role as UserRole)
    );

    return usersWithRole.map((user) => ({
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    }));
  },
});

/**
 * List users with optional search and role filtering
 */
export const list = query({
  args: {
    searchTerm: v.optional(v.string()),
    roleFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let users = await ctx.db.query("users").collect();

    // Apply role filter if provided
    if (args.roleFilter) {
      users = users.filter((user) =>
        user.roles.includes(args.roleFilter as UserRole)
      );
    }

    // Apply search filter if provided
    if (args.searchTerm) {
      const searchLower = args.searchTerm.toLowerCase();
      users = users.filter((user) => {
        const emailMatch = user.email.toLowerCase().includes(searchLower);
        const firstNameMatch = user.profile.firstName.toLowerCase().includes(searchLower);
        const lastNameMatch = user.profile.lastName.toLowerCase().includes(searchLower);
        const fullName = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase();
        const fullNameMatch = fullName.includes(searchLower);
        
        return emailMatch || firstNameMatch || lastNameMatch || fullNameMatch;
      });
    }

    // Return users without password, with active status
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      roles: user.roles,
      profile: user.profile,
      active: user.active ?? true,
    }));
  },
});

/**
 * Create a new user
 * 
 * Creates a new user account with hashed password and profile information.
 * Validates all user invariants before creation.
 * If the user has the 'student' role and student data is provided, also creates a student record.
 * This replaces the register function and does what register used to do.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    roles: v.array(v.string()),
    profile: v.object({
      firstName: v.string(),
      middleName: v.optional(v.string()),
      lastName: v.string(),
    }),
    studentData: v.optional(v.object({
      studentNumber: v.string(),
      departmentId: v.id("departments"),
      level: v.string(),
      status: v.string(),
    })),
    instructorData: v.optional(v.object({
      departmentId: v.id("departments"),
    })),
  },
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existingUser) {
      throw new ValidationError(
        "email",
        "Email already exists"
      );
    }

    // Hash the password
    const hashedPassword = await hashPassword(args.password);

    // Validate user creation invariants
    await validateCreateUser(
      ctx.db,
      args.email,
      hashedPassword,
      args.roles,
      args.profile
    );

    // Create the user
    const userId = await ctx.db.insert("users", {
      email: args.email,
      hashedPassword,
      roles: args.roles as UserRole[],
      profile: args.profile,
      active: true,
    });

    // If user has 'student' role and student data is provided, create student record
    let studentId = undefined;
    if (args.roles.includes("student") && args.studentData) {
      // Validate department exists
      const department = await ctx.db.get(args.studentData.departmentId);
      if (!department) {
        throw new NotFoundError("Department", args.studentData.departmentId);
      }

      // Validate student number uniqueness
      const existingStudent = await ctx.db
        .query("students")
        .withIndex("by_studentNumber", (q) => q.eq("studentNumber", args.studentData!.studentNumber))
        .first();
      
      if (existingStudent) {
        throw new ValidationError(
          "studentNumber",
          "Student number already exists"
        );
      }

      // Validate user doesn't already have a student record
      const existingStudentByUser = await ctx.db
        .query("students")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      
      if (existingStudentByUser) {
        throw new ValidationError(
          "userId",
          "User already has a student record"
        );
      }

      // Create the student record
      studentId = await ctx.db.insert("students", {
        userId: userId,
        studentNumber: args.studentData.studentNumber,
        admissionYear: new Date().getFullYear(),
        departmentId: args.studentData.departmentId,
        level: args.studentData.level,
        status: args.studentData.status,
      });
    }

    // If user has 'instructor' role and instructor data is provided, create instructor record
    let instructorId = undefined;
    if (args.roles.includes("instructor") && args.instructorData) {
      // Validate department exists
      const department = await ctx.db.get(args.instructorData.departmentId);
      if (!department) {
        throw new NotFoundError("Department", args.instructorData.departmentId);
      }

      // Validate user doesn't already have an instructor record
      const existingInstructor = await ctx.db
        .query("instructors")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      
      if (existingInstructor) {
        throw new ValidationError(
          "userId",
          "User already has an instructor record"
        );
      }

      // Create the instructor record
      instructorId = await ctx.db.insert("instructors", {
        userId: userId,
        departmentId: args.instructorData.departmentId,
      });
    }

    // Create a session for the newly created user (same as register did)
    const token = await createSession(ctx.db, userId);

    return {
      success: true,
      userId,
      email: args.email,
      token,
      roles: args.roles as UserRole[],
      profile: args.profile,
      studentId,
      instructorId,
    };
  },
});

/**
 * Toggle user active status
 */
export const toggleStatus = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      throw new NotFoundError("User", args.userId);
    }

    // Toggle the active status
    const newActiveStatus = !(user.active ?? true);

    await ctx.db.patch(args.userId, {
      active: newActiveStatus,
    });

    return {
      success: true,
      active: newActiveStatus,
    };
  },
});

