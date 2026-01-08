import { sendEnrollmentDeadlineReminder } from "./lib/services/notificationService";

type DB = any;

export async function runDailyDeadlineReminders(db: DB) {
  // find sections with enrollmentDeadline within next 24-48 hours (adjust logic as needed)
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const sections = await db.query("sectionsWithEnrollmentDeadlineBetween", { start: now, end: nextDay });
  for (const section of sections) {
    try {
      await sendEnrollmentDeadlineReminder(db, section._id ?? section.id);
    } catch (e) {
      console.error("Error sending enrollment deadline reminders for section", section, e);
    }
  }
}
// Hook this file into your hosting scheduler (Cloud functions / cron) to run daily.