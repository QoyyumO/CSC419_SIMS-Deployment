/**
 * Scheduled Functions (Cron Jobs)
 * 
 * Periodic tasks that run automatically to maintain system state.
 */

import { cronJobs } from "convex/server";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { sendEnrollmentDeadlineReminder } from "../lib/services/notificationService";

/**
 * Update sections with expired enrollment deadlines
 * This runs every hour to automatically close enrollment for sections
 * whose deadline has passed
 */
export const updateExpiredEnrollmentDeadlines = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    let updatedCount = 0;

    // Get all sections that are open for enrollment and have a deadline
    const sections = await ctx.db
      .query("sections")
      .filter((q) => 
        q.and(
          q.eq(q.field("isOpenForEnrollment"), true),
          q.neq(q.field("enrollmentDeadline"), undefined)
        )
      )
      .collect();

    for (const section of sections) {
      if (section.enrollmentDeadline && now > section.enrollmentDeadline) {
        // Deadline has passed, update section status
        await ctx.db.patch(section._id, {
          isOpenForEnrollment: false,
        });
        updatedCount++;
      }
    }

    return { updatedCount };
  },
});

/**
 * Send daily deadline reminders
 * This runs daily to send reminders for sections with enrollment deadlines
 * approaching within the next 24-48 hours
 */
export const runDailyDeadlineReminders = internalMutation({
  handler: async (ctx) => {
    // Find sections with enrollmentDeadline within next 24-48 hours
    const now = new Date();
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    
    // Get all sections that are open for enrollment and have a deadline
    const sections = await ctx.db
      .query("sections")
      .filter((q) => 
        q.and(
          q.eq(q.field("isOpenForEnrollment"), true),
          q.neq(q.field("enrollmentDeadline"), undefined)
        )
      )
      .collect();
    
    // Filter sections with deadlines in the next 24-48 hours
    const upcomingSections = sections.filter(section => {
      if (!section.enrollmentDeadline) return false;
      const deadline = section.enrollmentDeadline;
      return deadline >= nextDay.getTime() && deadline <= twoDays.getTime();
    });
    
    // Send reminders for each section
    let remindersSent = 0;
    for (const section of upcomingSections) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await sendEnrollmentDeadlineReminder(ctx.db as any, section._id);
        remindersSent++;
      } catch (e) {
        console.error("Error sending enrollment deadline reminders for section", section, e);
      }
    }
    
    return { remindersSent, sectionsChecked: upcomingSections.length };
  },
});

/**
 * Register cron jobs
 * 
 * This configures scheduled tasks to run automatically
 */
const crons = cronJobs();

// Update expired enrollment deadlines every hour at minute 0
crons.hourly(
  "updateExpiredEnrollmentDeadlines",
  {
    minuteUTC: 0, // Run at the start of each hour (minute 0)
  },
  internal.functions.cron.updateExpiredEnrollmentDeadlines
);

// Send daily deadline reminders every day at 9:00 AM UTC
crons.daily(
  "sendDailyDeadlineReminders",
  {
    hourUTC: 9, // Run at 9:00 AM UTC
    minuteUTC: 0,
  },
  internal.functions.cron.runDailyDeadlineReminders
);

export default crons;
