/**
 * Assessment Queries
 * 
 * Provides queries for assessment management.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all assessments for a section
 */
export const getBySection = query({
  args: {
    sectionId: v.id("sections"),
  },
  handler: async (ctx, args) => {
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_sectionId", (q) => q.eq("sectionId", args.sectionId))
      .collect();

    // Sort by due date (earliest first)
    return assessments.sort((a, b) => a.dueDate - b.dueDate);
  },
});

