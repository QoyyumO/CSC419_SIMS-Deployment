/**
 * Notifications Queries and Mutations
 * 
 * Provides queries and mutations for fetching and managing user notifications.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateSessionToken } from "../lib/session";

/**
 * Get notifications for the current user
 * Returns all notifications for the authenticated user, ordered by creation date (newest first)
 */
export const getMyNotifications = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      return [];
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      return [];
    }

    // Get all notifications for this user, ordered by creation date (newest first)
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Sort by createdAt descending (newest first)
    const sortedNotifications = notifications.sort((a, b) => b.createdAt - a.createdAt);

    return sortedNotifications.map((notification) => ({
      _id: notification._id,
      message: notification.message,
      read: notification.read,
      createdAt: notification.createdAt,
      courseId: notification.courseId,
    }));
  },
});

/**
 * Get unread notifications count for the current user
 * Returns the count of unread notifications
 */
export const getUnreadCount = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      return 0;
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      return 0;
    }

    // Get unread notifications count using the composite index
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) => 
        q.eq("userId", userId).eq("read", false)
      )
      .collect();

    return unreadNotifications.length;
  },
});

/**
 * Mark a notification as read
 * Updates the notification's read status to true
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    // Get the notification
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification not found");
    }

    // Verify the notification belongs to the authenticated user
    if (notification.userId !== userId) {
      throw new Error("Access denied: You can only mark your own notifications as read");
    }

    // Mark as read if not already read
    if (!notification.read) {
      await ctx.db.patch(args.notificationId, {
        read: true,
      });
    }

    return { success: true };
  },
});

/**
 * Mark multiple notifications as read
 * Updates multiple notifications' read status to true
 */
export const markMultipleAsRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    // Mark each notification as read
    await Promise.all(
      args.notificationIds.map(async (notificationId) => {
        const notification = await ctx.db.get(notificationId);
        if (notification && notification.userId === userId && !notification.read) {
          await ctx.db.patch(notificationId, {
            read: true,
          });
        }
      })
    );

    return { success: true };
  },
});

/**
 * Get notification preferences for the current user
 * Returns the user's notification settings (email, frequency, etc.)
 */
export const getNotificationPreferences = query({
  args: {
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      return { email: true, frequency: "immediate" };
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      return { email: true, frequency: "immediate" };
    }

    // Get user's notification preferences
    const user = await ctx.db.get(userId);
    return user?.notificationPreferences || { email: true, frequency: "immediate" };
  },
});

/**
 * Save notification preferences for the current user
 * Updates the user's notification settings
 */
export const saveNotificationPreferences = mutation({
  args: {
    preferences: v.object({
      email: v.optional(v.boolean()),
      frequency: v.optional(v.string()),
    }),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate session token and get user
    if (!args.token) {
      throw new Error("Authentication required");
    }

    const userId = await validateSessionToken(ctx.db, args.token);
    if (!userId) {
      throw new Error("Invalid session token");
    }

    // Update user's notification preferences
    await ctx.db.patch(userId, {
      notificationPreferences: args.preferences,
    });

    return { success: true };
  },
});

