// ...existing code...
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any; // replace with your Convex DB type if available

const templates = {
  enrollmentConfirmation: (data: { studentName: string; courseTitle: string }) =>
    `Hi ${data.studentName},\n\nYou are enrolled in "${data.courseTitle}". Welcome!\n\n- The Team`,
  gradePosted: (data: { studentName: string; courseTitle: string; grade: string }) =>
    `Hi ${data.studentName},\n\nA new grade (${data.grade}) was posted for "${data.courseTitle}".\n\n- The Team`,
  deadlineReminder: (data: { deadlineType: string; deadlineDate: Date; itemTitle?: string }) =>
    `Reminder: ${data.deadlineType} on ${format(new Date(data.deadlineDate), "PPP p")}${data.itemTitle ? ` for ${data.itemTitle}` : ""}.`,
  gradeAppeal: (data: { studentName: string; courseTitle?: string; status?: string }) =>
    `Hi ${data.studentName},\n\nYour grade appeal${data.status ? ` — ${data.status}` : ""}.\n\n- The Team`,
};

async function sendEmailMock(userId: string, subject: string, body: string) {
  // Replace with real email adapter (SES, SMTP, SendGrid) or inject email service.
  console.info(`[Email mock] to=${userId} subject=${subject}\n${body}`);
}

export async function sendNotification(db: DB, userId: string, message: string, type: string, metadata?: Record<string, unknown>) {
  const payload = {
    userId,
    message,
    type,
    metadata: metadata || null,
    read: false,
    createdAt: new Date(),
  };
  // Assumes a 'notifications' collection exists
  await db.insert("notifications", payload);
  // Optionally send email if metadata.email !== false or user preference requires
  if (metadata?.sendEmail !== false) {
    const subject = `[${type.toUpperCase()}] Notification`;
    await sendEmailMock(userId, subject, message);
  }
  return payload;
}

export async function sendEnrollmentConfirmation(db: DB, enrollmentId: string) {
  // Adjust the get/query calls to match your schema
  const enrollment = await db.get("enrollments", enrollmentId);
  if (!enrollment) return null;
  const user = await db.get("users", enrollment.userId);
  const section = await db.get("sections", enrollment.sectionId);
  const course = section ? await db.get("courses", section.courseId) : null;
  const message = templates.enrollmentConfirmation({
    studentName: user?.name || "Student",
    courseTitle: course?.title || section?.title || "the course",
  });
  return sendNotification(db, enrollment.userId, message, "enrollment", {
    enrollmentId,
    courseId: course?.id,
  });
}

export async function sendGradeNotification(db: DB, enrollmentId: string, assessmentId?: string) {
  const enrollment = await db.get("enrollments", enrollmentId);
  if (!enrollment) return null;
  const user = await db.get("users", enrollment.userId);
  const section = await db.get("sections", enrollment.sectionId);
  const course = section ? await db.get("courses", section.courseId) : null;
  // If assessmentId provided, fetch assessment/grade info
  const assessment = assessmentId ? await db.get("assessments", assessmentId) : null;
  const grade = assessment ? assessment.grade : enrollment.latestGrade;
  const message = templates.gradePosted({
    studentName: user?.name || "Student",
    courseTitle: course?.title || "the course",
    grade: grade ?? "N/A",
  });
  return sendNotification(db, enrollment.userId, message, "grade", {
    enrollmentId,
    assessmentId,
    courseId: course?.id,
  });
}

export async function sendDeadlineReminder(db: DB, userId: string, deadlineType: string, deadlineDate: Date, metadata?: Record<string, unknown>) {
  const message = templates.deadlineReminder({ 
    deadlineType, 
    deadlineDate, 
    itemTitle: metadata?.title as string | undefined 
  });
  return sendNotification(db, userId, message, "deadline", { deadlineType, deadlineDate, ...metadata });
}

export async function sendEnrollmentDeadlineReminder(db: DB, sectionId: string) {
  // Notify all students/targets for a section about enrollment deadline approaching
  const section = await db.get("sections", sectionId);
  if (!section) return null;
  // Example: find students interested/enrollable — replace with your logic
  const interested = await db.query("usersBySectionInterest", { sectionId });
  const promises = interested.map((user: { id: string }) =>
    sendDeadlineReminder(db, user.id, "Enrollment deadline", new Date(section.enrollmentDeadline), {
      sectionId,
      title: section.title,
    })
  );
  return Promise.all(promises);
}

export async function sendGradeAppealNotification(db: DB, appealId: string) {
  const appeal = await db.get("gradeAppeals", appealId);
  if (!appeal) return null;
  const user = await db.get("users", appeal.studentId);
  const message = templates.gradeAppeal({
    studentName: user?.name || "Student",
    status: appeal.status,
  });
  return sendNotification(db, appeal.studentId, message, "gradeAppeal", { appealId, status: appeal.status });
}
// ...existing code...