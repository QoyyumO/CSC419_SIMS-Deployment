/**
 * Schools Management Functions
 *
 * Provides queries and mutations for fetching and creating schools.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateCreateSchool } from "../lib/aggregates";

/**
 * List all schools
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const schools = await ctx.db.query("schools").collect();
    
    return schools.map((school) => ({
      _id: school._id,
      name: school.name,
      address: school.address,
      contact: school.contact,
    }));
  },
});

/**
 * Create a new school
 */
export const create = mutation({
  args: {
    name: v.string(),
    address: v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
    }),
    contact: v.object({
      email: v.string(),
      phone: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateSchool(ctx.db, args.name);

    // Create the school
    const schoolId = await ctx.db.insert("schools", {
      name: args.name,
      address: args.address,
      contact: args.contact,
    });

    return { success: true, schoolId };
  },
});

