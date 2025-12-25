/**
 * Scheduled Functions (Cron Jobs)
 * 
 * Periodic tasks that run automatically to maintain system state.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

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
 * Register cron jobs
 * 
 * This runs the enrollment deadline check every hour at minute 0
 */
const crons = cronJobs();

crons.hourly(
  "updateExpiredEnrollmentDeadlines",
  {
    minuteUTC: 0, // Run at the start of each hour (minute 0)
  },
  internal.cron.updateExpiredEnrollmentDeadlines
);

