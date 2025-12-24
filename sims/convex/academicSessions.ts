/**
 * Academic Sessions and Terms Management Functions
 *
 * Provides queries and mutations for fetching and creating academic sessions and terms.
 * Admin-only operations.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { validateCreateAcademicSession, validateCreateTerm } from "./lib/aggregates/academicCalendarAggregate";

/**
 * List all academic sessions
 */
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("academicSessions").collect();
    
    return sessions.map((session) => ({
      _id: session._id,
      yearLabel: session.yearLabel,
      startDate: session.startDate,
      endDate: session.endDate,
    }));
  },
});

/**
 * List all terms
 */
export const listTerms = query({
  args: {},
  handler: async (ctx) => {
    const terms = await ctx.db.query("terms").collect();
    
    // Fetch session details for each term
    const termsWithSessions = await Promise.all(
      terms.map(async (term) => {
        const session = await ctx.db.get(term.sessionId);
        return {
          _id: term._id,
          sessionId: term.sessionId,
          sessionYearLabel: session?.yearLabel || "Unknown",
          name: term.name,
          startDate: term.startDate,
          endDate: term.endDate,
        };
      })
    );
    
    return termsWithSessions;
  },
});

/**
 * Get terms for a specific session
 */
export const getTermsBySession = query({
  args: {
    sessionId: v.id("academicSessions"),
  },
  handler: async (ctx, args) => {
    const terms = await ctx.db
      .query("terms")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    
    return terms.map((term) => ({
      _id: term._id,
      sessionId: term.sessionId,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
    }));
  },
});

/**
 * Create a new academic session
 */
export const createSession = mutation({
  args: {
    yearLabel: v.string(), // e.g., "2024/2025"
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateAcademicSession(
      ctx.db,
      args.yearLabel,
      args.startDate,
      args.endDate
    );

    // Create the academic session
    const sessionId = await ctx.db.insert("academicSessions", {
      yearLabel: args.yearLabel,
      startDate: args.startDate,
      endDate: args.endDate,
      terms: [], // Initialize with empty terms array
    });

    return { success: true, sessionId };
  },
});

/**
 * Create a new term
 */
export const createTerm = mutation({
  args: {
    sessionId: v.id("academicSessions"),
    name: v.string(), // e.g., "Fall"
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
  },
  handler: async (ctx, args) => {
    // Validate all invariants before creating
    await validateCreateTerm(
      ctx.db,
      args.sessionId,
      args.name,
      args.startDate,
      args.endDate
    );

    // Create the term
    const termId = await ctx.db.insert("terms", {
      sessionId: args.sessionId,
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
    });

    return { success: true, termId };
  },
});

