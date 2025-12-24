/**
 * Programs Management Functions
 *
 * Provides queries and mutations for fetching and managing academic programs.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { NotFoundError } from "./lib/aggregates";

/**
 * List all programs with their department information
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const programs = await ctx.db.query("programs").collect();
    
    // Fetch department information for each program
    const programsWithDepartments = await Promise.all(
      programs.map(async (program) => {
        const department = await ctx.db.get(program.departmentId);
        
        // Fetch required courses information
        const requiredCourses = await Promise.all(
          program.requiredCourses.map(async (courseId) => {
            const course = await ctx.db.get(courseId);
            return course
              ? {
                  _id: course._id,
                  code: course.code,
                  title: course.title,
                }
              : null;
          })
        );
        
        return {
          _id: program._id,
          name: program.name,
          departmentId: program.departmentId,
          departmentName: department?.name || "Unknown Department",
          durationYears: program.durationYears,
          creditRequirements: program.creditRequirements,
          requiredCourses: requiredCourses.filter((c) => c !== null),
        };
      })
    );
    
    return programsWithDepartments;
  },
});

/**
 * Get a single program by ID with full details
 */
export const getById = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) {
      throw new NotFoundError("Program", args.programId);
    }

    const department = await ctx.db.get(program.departmentId);
    
    // Fetch required courses information
    const requiredCourses = await Promise.all(
      program.requiredCourses.map(async (courseId) => {
        const course = await ctx.db.get(courseId);
        return course
          ? {
              _id: course._id,
              code: course.code,
              title: course.title,
              credits: course.credits,
            }
          : null;
      })
    );
    
    return {
      _id: program._id,
      name: program.name,
      departmentId: program.departmentId,
      department: department
        ? {
            _id: department._id,
            name: department.name,
          }
        : null,
      durationYears: program.durationYears,
      creditRequirements: program.creditRequirements,
      requiredCourses: requiredCourses.filter((c) => c !== null),
    };
  },
});

/**
 * List programs by department
 */
export const listByDepartment = query({
  args: {
    departmentId: v.id("departments"),
  },
  handler: async (ctx, args) => {
    const programs = await ctx.db
      .query("programs")
      .withIndex("by_departmentId", (q) => q.eq("departmentId", args.departmentId))
      .collect();
    
    return programs.map((program) => ({
      _id: program._id,
      name: program.name,
      durationYears: program.durationYears,
      creditRequirements: program.creditRequirements,
      requiredCoursesCount: program.requiredCourses.length,
    }));
  },
});

/**
 * Create a new program
 */
export const create = mutation({
  args: {
    departmentId: v.id("departments"),
    name: v.string(),
    durationYears: v.number(),
    creditRequirements: v.number(),
    requiredCourses: v.array(v.id("courses")),
  },
  handler: async (ctx, args) => {
    // Validate that the department exists
    const department = await ctx.db.get(args.departmentId);
    if (!department) {
      throw new NotFoundError("Department", args.departmentId);
    }

    // Validate that all required courses exist
    for (const courseId of args.requiredCourses) {
      const course = await ctx.db.get(courseId);
      if (!course) {
        throw new NotFoundError("Course", courseId);
      }
    }

    // Validate duration and credit requirements
    if (args.durationYears <= 0) {
      throw new Error("Duration must be a positive number");
    }
    if (args.creditRequirements <= 0) {
      throw new Error("Credit requirements must be a positive number");
    }

    // Create the program
    const programId = await ctx.db.insert("programs", {
      departmentId: args.departmentId,
      name: args.name,
      durationYears: args.durationYears,
      creditRequirements: args.creditRequirements,
      requiredCourses: args.requiredCourses,
    });

    return { success: true, programId };
  },
});

/**
 * Update an existing program
 */
export const update = mutation({
  args: {
    programId: v.id("programs"),
    name: v.optional(v.string()),
    durationYears: v.optional(v.number()),
    creditRequirements: v.optional(v.number()),
    requiredCourses: v.optional(v.array(v.id("courses"))),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) {
      throw new NotFoundError("Program", args.programId);
    }

    // Validate required courses if provided
    if (args.requiredCourses) {
      for (const courseId of args.requiredCourses) {
        const course = await ctx.db.get(courseId);
        if (!course) {
          throw new NotFoundError("Course", courseId);
        }
      }
    }

    // Validate duration and credit requirements if provided
    if (args.durationYears !== undefined && args.durationYears <= 0) {
      throw new Error("Duration must be a positive number");
    }
    if (args.creditRequirements !== undefined && args.creditRequirements <= 0) {
      throw new Error("Credit requirements must be a positive number");
    }

    // Build update object
    const updates: {
      name?: string;
      durationYears?: number;
      creditRequirements?: number;
      requiredCourses?: Id<"courses">[];
    } = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.durationYears !== undefined) updates.durationYears = args.durationYears;
    if (args.creditRequirements !== undefined) updates.creditRequirements = args.creditRequirements;
    if (args.requiredCourses !== undefined) updates.requiredCourses = args.requiredCourses;

    // Update the program
    await ctx.db.patch(args.programId, updates);

    return { success: true };
  },
});

/**
 * Delete a program
 */
export const remove = mutation({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) {
      throw new NotFoundError("Program", args.programId);
    }

    // Check if any students are enrolled in this program
    // Note: This would require a students.programId field, which may not exist yet
    // For now, we'll just delete the program
    // TODO: Add validation to check for dependent students

    await ctx.db.delete(args.programId);

    return { success: true };
  },
});

