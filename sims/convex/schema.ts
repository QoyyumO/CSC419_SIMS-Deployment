import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Core Entity Collections and Value Objects Schema
 * 
 * This schema defines all primary collections for the Student Information Management System (SIMS)
 * along with embedded value objects used within them.
 * 
 * AGGREGATE ROOTS:
 * Each collection marked as an Aggregate Root serves as the primary entry point for modifications
 * to that aggregate. All invariants must be enforced within a single transaction.
 * 
 * For detailed documentation on Aggregate boundaries and invariants, see:
 * ../docs/aggregates_and_invariants.md
 * 
 * Aggregate Roots in this schema:
 * - schools (SchoolAggregate)
 * - courses (CourseAggregate)
 * - sections (SectionAggregate)
 * - students (StudentAggregate)
 * - enrollments (EnrollmentAggregate)
 * - academicSessions (AcademicCalendarAggregate)
 * - users (UserAggregate)
 * - transcripts (TranscriptAggregate)
 * - graduationRecords (GraduationAggregate)
 */

export default defineSchema({
  // ============================================================================
  // CORE ENTITY COLLECTIONS
  // ============================================================================

  /**
   * Schools Collection (AGGREGATE ROOT: SchoolAggregate)
   * Represents educational institutions
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  schools: defineTable({
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
  })
    .index("by_name", ["name"]),

  /**
   * Departments Collection
   * Represents academic departments within schools
   * Foreign Keys: schoolId → schools._id, headId → users._id
   */
  departments: defineTable({
    schoolId: v.id("schools"),
    name: v.string(),
    headId: v.id("users"),
  })
    .index("by_schoolId", ["schoolId"])
    .index("by_headId", ["headId"])
    .index("by_name", ["name"]),

  /**
   * Programs Collection
   * Represents academic programs offered by departments (e.g., BSc Computer Science)
   * Foreign Keys: departmentId → departments._id
   */
  programs: defineTable({
    departmentId: v.id("departments"),
    name: v.string(),
    durationYears: v.number(),
    creditRequirements: v.number(),
    requiredCourses: v.array(v.id("courses")), // Array of course IDs that are required
  })
    .index("by_departmentId", ["departmentId"])
    .index("by_name", ["name"]),

  /**
   * Courses Collection (AGGREGATE ROOT: CourseAggregate)
   * Represents individual courses that can be offered
   * Foreign Keys: departmentId → departments._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  courses: defineTable({
    code: v.string(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    prerequisites: v.array(v.string()), // Course codes instead of IDs
    departmentId: v.id("departments"),
    programIds: v.array(v.id("programs")), // Array of program IDs this course belongs to
    status: v.string(), // Course status: "C" (Core/Required), "R" (Required), "E" (Elective)
    level: v.string(), // Course level: "100", "200", "300", "400", "500"
  })
    .index("by_code", ["code"])
    .index("by_departmentId", ["departmentId"])
    .index("by_level", ["level"])
    .index("by_status", ["status"])
    .index("by_departmentId_level", ["departmentId", "level"]),

  /**
   * Course Versions Collection
   * Represents versioned definitions of a course (e.g., curriculum changes)
   * Foreign Keys: courseId → courses._id
   */
  courseVersions: defineTable({
    courseId: v.id("courses"),
    version: v.number(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    prerequisites: v.array(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_courseId", ["courseId"])
    .index("by_courseId_isActive", ["courseId", "isActive"])
    .index("by_courseId_version", ["courseId", "version"]),

  /**
   * Sections Collection (AGGREGATE ROOT: SectionAggregate)
   * Represents specific course offerings in a term
   * Uses AcademicPeriod value object to contextualize the section
   * Foreign Keys: courseId → courses._id, termId → terms._id, instructorId → users._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  sections: defineTable({
    courseId: v.id("courses"),
    sessionId: v.id("academicSessions"), // AcademicPeriod: sessionId
    termId: v.id("terms"), // AcademicPeriod: termId
    instructorId: v.id("users"),
    capacity: v.number(),
    scheduleSlots: v.array(
      v.object({
        // ScheduleSlotSpec value object
        day: v.string(), // e.g., "Mon", "Tue", "Wed", etc.
        startTime: v.string(),
        endTime: v.string(),
        room: v.string(),
      })
    ),
    enrollmentCount: v.number(),
    isOpenForEnrollment: v.optional(v.boolean()), // Whether section is published and open for student enrollment
    enrollmentDeadline: v.optional(v.number()), // Unix timestamp for enrollment deadline
    finalGradesPosted: v.optional(v.boolean()), // Whether final grades have been posted for this section
    gradesEditable: v.optional(v.boolean()), // Whether grades can be edited (default true, false when final grades posted, can be reopened by registrar)
    isLocked: v.optional(v.boolean()), // Whether section is locked for grade editing (default false, set to true when term ends)
  })
    .index("by_courseId", ["courseId"])
    .index("by_termId", ["termId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_instructorId", ["instructorId"])
    .index("by_courseId_termId", ["courseId", "termId"]),

  /**
   * Users Collection (AGGREGATE ROOT: UserAggregate)
   * Represents all system users (students, instructors, admins, etc.)
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  users: defineTable({
    email: v.string(),
    hashedPassword: v.string(),
    roles: v.array(v.string()),
    profile: v.object({
      firstName: v.string(),
      middleName: v.optional(v.string()),
      lastName: v.string(),
    }),
    active: v.optional(v.boolean()),
    notificationPreferences: v.optional(v.object({
      email: v.optional(v.boolean()),
      frequency: v.optional(v.string()), // "immediate", "daily", "weekly"
    })),
  })
    .index("by_email", ["email"]),

  /**
   * Students Collection (AGGREGATE ROOT: StudentAggregate)
   * Represents student-specific information linked to users
   * Uses StudentIdentifier value object
   * Foreign Keys: userId → users._id, departmentId → departments._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  students: defineTable({
    userId: v.id("users"),
    studentNumber: v.string(), // StudentIdentifier: studentNumber
    admissionYear: v.number(), // StudentIdentifier: admissionYear
    departmentId: v.id("departments"),
    level: v.string(),
    status: v.string(),
    academicStanding: v.optional(v.string()), // Academic standing: "First Class", "Second Class (Upper Division)", "Second Class (Lower Division)", "Third Class", "Probation"
  })
    .index("by_userId", ["userId"])
    .index("by_studentNumber", ["studentNumber"])
    .index("by_departmentId", ["departmentId"])
    .index("by_status", ["status"]),

  /**
   * Instructors Collection
   * Represents instructor-specific information linked to users
   * Foreign Keys: userId → users._id, departmentId → departments._id
   */
  instructors: defineTable({
    userId: v.id("users"),
    departmentId: v.id("departments"),
  })
    .index("by_userId", ["userId"])
    .index("by_departmentId", ["departmentId"]),

  /**
   * Enrollments Collection (AGGREGATE ROOT: EnrollmentAggregate)
   * Represents student enrollments in course sections
   * Uses AcademicPeriod value object to contextualize the enrollment
   * Foreign Keys: studentId → students._id, sectionId → sections._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  enrollments: defineTable({
    studentId: v.id("students"),
    sectionId: v.id("sections"),
    sessionId: v.id("academicSessions"), // AcademicPeriod: sessionId
    termId: v.id("terms"), // AcademicPeriod: termId
    status: v.string(),
    enrolledAt: v.number(), // Unix timestamp
    grade: v.optional(v.string()), // Optional grade (e.g., "A", "B+", "85")
    term: v.optional(v.string()), // Optional term name as string
  })
    .index("by_studentId", ["studentId"])
    .index("by_sectionId", ["sectionId"])
    .index("by_studentId_sectionId", ["studentId", "sectionId"])
    .index("by_status", ["status"])
    .index("by_termId", ["termId"]),

  /**
   * Assessments Collection
   * Represents assessments (exams, assignments, etc.) for sections
   * Foreign Keys: sectionId → sections._id
   */
  assessments: defineTable({
    sectionId: v.id("sections"),
    title: v.string(),
    weight: v.number(), // Weight as percentage (e.g., 30 for 30%)
    totalPoints: v.number(), // Total points possible for this assessment
    dueDate: v.number(), // Unix timestamp for due date
  })
    .index("by_sectionId", ["sectionId"]),

  /**
   * Grades Collection
   * Represents individual grades for assessments
   * Stores numeric score only (percentage 0-100)
   * Letter grade mapping happens in transcript service
   * Foreign Keys: enrollmentId → enrollments._id, assessmentId → assessments._id, recordedBy → users._id
   */
  grades: defineTable({
    enrollmentId: v.id("enrollments"),
    assessmentId: v.id("assessments"),
    grade: v.number(), // Numeric grade (percentage 0-100)
    recordedBy: v.id("users"),
  })
    .index("by_enrollmentId", ["enrollmentId"])
    .index("by_assessmentId", ["assessmentId"])
    .index("by_recordedBy", ["recordedBy"])
    .index("by_enrollmentId_assessmentId", ["enrollmentId", "assessmentId"]),

  /**
   * Transcripts Collection (AGGREGATE ROOT: TranscriptAggregate)
   * Represents student academic transcripts
   * Foreign Keys: studentId → students._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  transcripts: defineTable({
    studentId: v.id("students"),
    entries: v.array(
      v.object({
        // Transcript entry structure
        courseCode: v.string(),
        courseTitle: v.string(),
        credits: v.number(),
        grade: v.object({
          numeric: v.number(),
          letter: v.string(),
          points: v.number(),
        }),
        term: v.string(),
        year: v.number(),
      })
    ),
    gpa: v.number(),
    metadata: v.optional(
      v.object({
        generatedBy: v.id("users"),
        generatedAt: v.number(), // Unix timestamp
        format: v.string(),
      })
    ),
  })
    .index("by_studentId", ["studentId"]),

  /**
   * Academic Sessions Collection (AGGREGATE ROOT: AcademicCalendarAggregate)
   * Represents academic sessions and their terms
   * Note: Terms are also stored in a separate 'terms' collection for proper id references
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  academicSessions: defineTable({
    yearLabel: v.string(), // e.g., "2024/2025"
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
    terms: v.array(
      v.object({
        id: v.string(), // Term identifier within the session
        name: v.string(),
        startDate: v.number(), // Unix timestamp
        endDate: v.number(), // Unix timestamp
      })
    ),
  })
    .index("by_yearLabel", ["yearLabel"]),

  /**
   * Terms Collection
   * Represents individual terms within academic sessions
   * This collection enables proper id references for sections and enrollments
   * Foreign Keys: sessionId → academicSessions._id
   */
  terms: defineTable({
    sessionId: v.id("academicSessions"),
    name: v.string(),
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
  })
    .index("by_sessionId", ["sessionId"]),

  /**
   * Graduation Records Collection (AGGREGATE ROOT: GraduationAggregate)
   * Represents graduation approvals and records
   * Foreign Keys: studentId → students._id, approvedBy → users._id
   * See ../docs/aggregates_and_invariants.md for invariants
   */
  graduationRecords: defineTable({
    studentId: v.id("students"),
    approvedBy: v.id("users"),
    date: v.number(), // Unix timestamp
  })
    .index("by_studentId", ["studentId"])
    .index("by_approvedBy", ["approvedBy"])
    .index("by_date", ["date"]),

  /**   * Alumni Profiles Collection
   * Represents alumni information for graduated students.
   * Foreign Keys: studentId -> students._id
   */
  alumniProfiles: defineTable({
    studentId: v.id("students"),
    graduationYear: v.number(),
    contactInfo: v.object({
      email: v.string(),
      phone: v.string(),
      address: v.object({
        street: v.string(),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      }),
    }),
    employmentStatus: v.string(),
    currentEmployer: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    linkedInUrl: v.optional(v.string()),
  })
    .index("by_studentId", ["studentId"])
    .index("by_graduationYear", ["graduationYear"]),

  /**   * Audit Logs Collection
   * Represents system audit trail for tracking changes
   * Foreign Keys: userId → users._id
   */
  auditLogs: defineTable({
    entity: v.string(),
    action: v.string(),
    userId: v.id("users"),
    timestamp: v.number(), // Unix timestamp
    details: v.any(), // Flexible object for varying audit details
  })
    .index("by_userId", ["userId"])
    .index("by_entity", ["entity"])
    .index("by_timestamp", ["timestamp"])
    .index("by_entity_action", ["entity", "action"]),

  /**
   * Sessions Collection
   * Represents user authentication sessions with secure tokens
   * Foreign Keys: userId → users._id
   */
  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(), // Secure session token
    expiresAt: v.number(), // Unix timestamp when session expires
    createdAt: v.number(), // Unix timestamp when session was created
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Notifications Collection
   * Represents user notifications
   * Foreign Keys: userId → users._id, courseId → courses._id (optional, for grade notifications)
   */
  notifications: defineTable({
    userId: v.id("users"),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(), // Unix timestamp
    courseId: v.optional(v.id("courses")), // Optional course ID for navigation (e.g., grade notifications)
  })
    .index("by_userId", ["userId"])
    .index("by_userId_read", ["userId", "read"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Grade Audit Log Collection
   * Represents audit trail for grade unlocking/locking actions by Registrar
   * Foreign Keys: adminId → users._id, sectionId → sections._id
   */
  grade_audit_log: defineTable({
    adminId: v.id("users"), // Registrar/admin who performed the action
    sectionId: v.id("sections"),
    action: v.union(v.literal("UNLOCK"), v.literal("LOCK")), // Action type
    reason: v.string(), // Mandatory reason for the action
    timestamp: v.number(), // Unix timestamp
  })
    .index("by_sectionId", ["sectionId"])
    .index("by_adminId", ["adminId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_sectionId_timestamp", ["sectionId", "timestamp"]),

  /**
   * Settings Collection
   * Represents system-wide configuration settings
   */
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_key", ["key"]),
});

