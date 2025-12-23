/**
 * Dashboard Queries
 * 
 * Provides queries for admin dashboard statistics and activity logs.
 */

import { query } from "./_generated/server";

/**
 * Get dashboard statistics
 * Returns counts of total users, students, and instructors
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    
    const totalUsers = allUsers.length;
    const students = allUsers.filter((user) => user.roles.includes("student")).length;
    const instructors = allUsers.filter((user) => user.roles.includes("instructor")).length;
    
    return {
      totalUsers,
      students,
      instructors,
    };
  },
});

/**
 * Get recent activity from audit logs
 * Returns the 5 most recent entries ordered by timestamp (descending)
 */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    const allLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .collect();
    
    // Sort by timestamp descending and take the 5 most recent
    const recentLogs = allLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    
    // Fetch user details for each log entry
    const activitiesWithUsers = await Promise.all(
      recentLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          _id: log._id,
          entity: log.entity,
          action: log.action,
          userId: log.userId,
          userEmail: user?.email || "Unknown",
          userName: user?.profile
            ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
            : "Unknown User",
          timestamp: log.timestamp,
          details: log.details,
        };
      })
    );
    
    return activitiesWithUsers;
  },
});

