/**
 * Departments Management Functions
 *
 * Provides queries and mutations for fetching and creating departments with their associated school information.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateDepartmentOwnership, NotFoundError } from "../lib/aggregates";

/**
 * List all departments with their school names
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const departments = await ctx.db.query("departments").collect();
    
    // Fetch school information for each department
    const departmentsWithSchools = await Promise.all(
      departments.map(async (department) => {
        const school = await ctx.db.get(department.schoolId);
        
        return {
          _id: department._id,
          name: department.name,
          schoolId: department.schoolId,
          schoolName: school?.name || "Unknown School",
          headId: department.headId,
        };
      })
    );
    
    return departmentsWithSchools;
  },
});

/**
 * Create a new department
 */
export const create = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    headId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Validate that the school exists
    await validateDepartmentOwnership(ctx.db, args.schoolId);

    // Validate that the head user exists
    const headUser = await ctx.db.get(args.headId);
    if (!headUser) {
      throw new NotFoundError("User", args.headId);
    }

    // Create the department
    const departmentId = await ctx.db.insert("departments", {
      schoolId: args.schoolId,
      name: args.name,
      headId: args.headId,
    });

    return { success: true, departmentId };
  },
});

