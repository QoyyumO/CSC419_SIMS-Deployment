# Database Schema Documentation

This document provides comprehensive documentation for the database schema, including all entity collections and value objects defined in the Student Information Management System (SIMS).

## Overview

The schema is defined using Convex's schema definition system, which provides type safety and automatic index generation. All collections include an automatically generated `_id` field that serves as the primary key.

## Entity Collections

### Schools Collection

**Purpose:** Represents educational institutions in the system.

**Fields:**
- `name` (string) - Name of the school
- `address` (Address value object) - Physical address of the school
- `contact` (Contact value object) - Contact information for the school

**Indexes:**
- `by_name` - Index on `name` field for quick lookups

**Aggregate Root:** Yes (SchoolAggregate)

**Related Collections:**
- Referenced by: `departments.schoolId`

---

### Departments Collection

**Purpose:** Represents academic departments within schools.

**Fields:**
- `schoolId` (Id<"schools">) - Foreign key to the school this department belongs to
- `name` (string) - Name of the department
- `headId` (Id<"users">) - Foreign key to the user who is the department head

**Indexes:**
- `by_schoolId` - Index on `schoolId` for querying departments by school
- `by_headId` - Index on `headId` for querying departments by head
- `by_name` - Index on `name` field

**Foreign Key Relationships:**
- `schoolId` → `schools._id`
- `headId` → `users._id`

**Related Collections:**
- References: `schools`, `users`
- Referenced by: `programs.departmentId`

---

### Programs Collection

**Purpose:** Represents academic programs offered by departments.

**Fields:**
- `departmentId` (Id<"departments">) - Foreign key to the department offering this program
- `name` (string) - Name of the program
- `durationYears` (number) - Duration of the program in years
- `creditRequirements` (number) - Total credit hours required for the program
- `requiredCourses` (array of Id<"courses">) - Array of course IDs that are required for the program

**Indexes:**
- `by_departmentId` - Index on `departmentId` for querying programs by department
- `by_name` - Index on `name` for lookups

**Foreign Key Relationships:**
- `departmentId` → `departments._id`

**Related Collections:**
- References: `departments`, `courses` (via requiredCourses array)
- Referenced by: `courses.programIds` (many-to-many relationship)

---

### Course Versions Collection

**Purpose:** Represents versioned definitions of a course (e.g., curriculum changes).

**Fields:**
- `courseId` (Id<"courses">) - Foreign key to the course
- `version` (number) - Version number
- `title` (string) - Course title for this version
- `description` (string) - Course description for this version
- `credits` (number) - Credit hours for this version
- `prerequisites` (array of string) - Array of course codes that are prerequisites
- `isActive` (boolean) - Whether this version is currently active
- `createdAt` (number) - Unix timestamp when version was created

**Indexes:**
- `by_courseId` - Index on `courseId` for querying versions by course
- `by_courseId_isActive` - Composite index for querying active versions
- `by_courseId_version` - Composite index for querying by course and version

**Foreign Key Relationships:**
- `courseId` → `courses._id`

**Related Collections:**
- References: `courses`

---

### Courses Collection

**Purpose:** Represents individual courses that can be offered.

**Fields:**
- `code` (string) - Unique course code (e.g., "CSC101")
- `title` (string) - Course title
- `description` (string) - Course description
- `credits` (number) - Number of credit hours
- `prerequisites` (array of string) - Array of course codes (not IDs) that are prerequisites
- `departmentId` (Id<"departments">) - Foreign key to the department offering this course
- `programIds` (array of Id<"programs">) - Array of program IDs this course belongs to
- `status` (string) - Course status: "C" (Core/Required), "R" (Required), "E" (Elective)
- `level` (string) - Course level (e.g., "100", "200", "300", "400", "500")

**Indexes:**
- `by_code` - Index on `code` for unique lookups
- `by_departmentId` - Index on `departmentId` for querying courses by department
- `by_level` - Index on `level` for querying courses by level
- `by_status` - Index on `status` for querying courses by status
- `by_departmentId_level` - Composite index for querying courses by department and level

**Foreign Key Relationships:**
- `departmentId` → `departments._id`

**Aggregate Root:** Yes (CourseAggregate)

**Related Collections:**
- References: `departments`, `programs` (via programIds array)
- Self-referencing: `prerequisites` array references other courses by code
- Referenced by: `sections.courseId`, `programs.requiredCourses`

---

### Sections Collection

**Purpose:** Represents specific course offerings in a term with scheduling and enrollment information.

**Fields:**
- `courseId` (Id<"courses">) - Foreign key to the course being offered
- `sessionId` (Id<"academicSessions">) - Academic session ID (part of AcademicPeriod)
- `termId` (Id<"terms">) - Term ID (part of AcademicPeriod)
- `instructorId` (Id<"users">) - Foreign key to the instructor teaching this section
- `capacity` (number) - Maximum number of students that can enroll
- `scheduleSlots` (array of ScheduleSlotSpec) - Array of schedule slot value objects
- `enrollmentCount` (number) - Current number of enrolled students
- `isOpenForEnrollment` (optional boolean) - Whether section is published and open for student enrollment
- `enrollmentDeadline` (optional number) - Unix timestamp for enrollment deadline
- `finalGradesPosted` (optional boolean) - Whether final grades have been posted for this section
- `gradesEditable` (optional boolean) - Whether grades can be edited (default true, false when final grades posted, can be reopened by registrar)
- `isLocked` (optional boolean) - Whether section is locked for grade editing (default false, set to true when term ends)

**Indexes:**
- `by_courseId` - Index on `courseId` for querying sections by course
- `by_termId` - Index on `termId` for querying sections by term
- `by_sessionId` - Index on `sessionId` for querying sections by session
- `by_instructorId` - Index on `instructorId` for querying sections by instructor
- `by_courseId_termId` - Composite index for querying sections by course and term

**Foreign Key Relationships:**
- `courseId` → `courses._id`
- `termId` → `terms._id`
- `sessionId` → `academicSessions._id`
- `instructorId` → `users._id`

**Aggregate Root:** Yes (SectionAggregate)

**Invariants:**
- `enrollmentCount` must never exceed `capacity`
- Sum of all assessment weights for the section must equal 100%

**Related Collections:**
- References: `courses`, `terms`, `academicSessions`, `users`
- Referenced by: `enrollments.sectionId`, `assessments.sectionId`, `grade_audit_log.sectionId`

---

### Users Collection

**Purpose:** Represents all system users (students, instructors, admins, etc.).

**Fields:**
- `email` (string) - Unique email address for authentication
- `hashedPassword` (string) - Hashed password (never store plain text)
- `roles` (array of strings) - Array of user roles (e.g., "student", "instructor", "admin", "registrar", "department_head")
- `profile` (FullName value object) - User profile information
  - `firstName` (string) - First name (required)
  - `middleName` (optional string) - Middle name (optional)
  - `lastName` (string) - Last name (required)
- `active` (optional boolean) - Whether the user account is active
- `notificationPreferences` (optional object) - Notification preferences
  - `email` (optional boolean) - Email notification preference
  - `frequency` (optional string) - Notification frequency: "immediate", "daily", "weekly"

**Indexes:**
- `by_email` - Index on `email` for unique lookups and authentication

**Aggregate Root:** Yes (UserAggregate)

**Invariants:**
- Password must be hashed
- Role assignments must be from a predefined set
- Email must be unique

**Related Collections:**
- Referenced by: `students.userId`, `instructors.userId`, `departments.headId`, `sections.instructorId`, `grades.recordedBy`, `auditLogs.userId`, `graduationRecords.approvedBy`, `sessions.userId`, `notifications.userId`, `grade_audit_log.adminId`, `transcripts.metadata.generatedBy`

---

### Students Collection

**Purpose:** Represents student-specific information linked to user accounts.

**Fields:**
- `userId` (Id<"users">) - Foreign key to the user account
- `studentNumber` (string) - Unique student identification number (part of StudentIdentifier)
- `admissionYear` (number) - Year the student was admitted (part of StudentIdentifier)
- `departmentId` (Id<"departments">) - Foreign key to the department the student belongs to
- `level` (string) - Student level (e.g., "Freshman", "Sophomore", "Junior", "Senior")
- `status` (string) - Student status (e.g., "active", "suspended", "graduated", "inactive")
- `academicStanding` (optional string) - Academic standing: "First Class", "Second Class (Upper Division)", "Second Class (Lower Division)", "Third Class", "Probation"

**Indexes:**
- `by_userId` - Index on `userId` for querying student by user account
- `by_studentNumber` - Index on `studentNumber` for unique lookups
- `by_departmentId` - Index on `departmentId` for querying students by department
- `by_status` - Index on `status` for filtering by student status

**Foreign Key Relationships:**
- `userId` → `users._id`
- `departmentId` → `departments._id`

**Aggregate Root:** Yes (StudentAggregate)

**Value Objects:**
- StudentIdentifier: `studentNumber` + `admissionYear`

**Invariants:**
- Student status controls allowed operations (e.g., only "active" students can enroll)
- Student number must be unique

**Related Collections:**
- References: `users`, `departments`
- Referenced by: `enrollments.studentId`, `transcripts.studentId`, `graduationRecords.studentId`

---

### Enrollments Collection

**Purpose:** Represents student enrollments in course sections.

**Fields:**
- `studentId` (Id<"students">) - Foreign key to the enrolled student
- `sectionId` (Id<"sections">) - Foreign key to the section
- `sessionId` (Id<"academicSessions">) - Academic session ID (part of AcademicPeriod)
- `termId` (Id<"terms">) - Term ID (part of AcademicPeriod)
- `status` (string) - Enrollment status (e.g., "active", "enrolled", "dropped", "completed", "failed", "waitlisted")
- `enrolledAt` (number) - Unix timestamp of when enrollment occurred
- `grade` (optional string) - Optional grade (e.g., "A", "B+", "85")
- `term` (optional string) - Optional term name as string

**Indexes:**
- `by_studentId` - Index on `studentId` for querying enrollments by student
- `by_sectionId` - Index on `sectionId` for querying enrollments by section
- `by_studentId_sectionId` - Composite index for unique enrollment checks
- `by_status` - Index on `status` for filtering by enrollment status
- `by_termId` - Index on `termId` for querying enrollments by term

**Foreign Key Relationships:**
- `studentId` → `students._id`
- `sectionId` → `sections._id`
- `sessionId` → `academicSessions._id`
- `termId` → `terms._id`

**Aggregate Root:** Yes (EnrollmentAggregate)

**Value Objects:**
- AcademicPeriod: `sessionId` + `termId`

**Invariants:**
- Once a final grade is recorded, enrollment status cannot be changed without an official appeal process
- A student cannot be enrolled in the same section multiple times

**Related Collections:**
- References: `students`, `sections`, `academicSessions`, `terms`
- Referenced by: `grades.enrollmentId`

---

### Assessments Collection

**Purpose:** Represents assessments (exams, assignments, etc.) for course sections.

**Fields:**
- `sectionId` (Id<"sections">) - Foreign key to the section this assessment belongs to
- `title` (string) - Title of the assessment
- `weight` (number) - Weight percentage (e.g., 30 for 30% of final grade)
- `totalPoints` (number) - Total points possible for this assessment
- `dueDate` (number) - Unix timestamp for due date

**Indexes:**
- `by_sectionId` - Index on `sectionId` for querying assessments by section

**Foreign Key Relationships:**
- `sectionId` → `sections._id`

**Invariants:**
- Sum of all assessment weights for a section must equal 100%

**Related Collections:**
- References: `sections`
- Referenced by: `grades.assessmentId`

---

### Grades Collection

**Purpose:** Represents individual grades for assessments.

**Fields:**
- `enrollmentId` (Id<"enrollments">) - Foreign key to the enrollment
- `assessmentId` (Id<"assessments">) - Foreign key to the assessment
- `grade` (number) - Numeric grade (percentage 0-100, rounded to 2 decimal places)
- `recordedBy` (Id<"users">) - Foreign key to the user who recorded the grade

**Indexes:**
- `by_enrollmentId` - Index on `enrollmentId` for querying grades by enrollment
- `by_assessmentId` - Index on `assessmentId` for querying grades by assessment
- `by_recordedBy` - Index on `recordedBy` for querying grades by recorder
- `by_enrollmentId_assessmentId` - Composite index for unique grade lookups

**Foreign Key Relationships:**
- `enrollmentId` → `enrollments._id`
- `assessmentId` → `assessments._id`
- `recordedBy` → `users._id`

**Note:** The grades table stores only numeric percentage (0-100). Letter grade mapping happens in the transcript service when generating transcripts. Grade values (letter, points) are computed on-the-fly for display purposes.

**Related Collections:**
- References: `enrollments`, `assessments`, `users`

---

### Transcripts Collection

**Purpose:** Represents student academic transcripts with immutable grade entries.

**Fields:**
- `studentId` (Id<"students">) - Foreign key to the student
- `entries` (array of transcript entry objects) - Array of transcript entries, each containing:
  - `courseCode` (string) - Course code
  - `courseTitle` (string) - Course title
  - `credits` (number) - Credit hours
  - `grade` (GradeValue value object) - Grade information
  - `term` (string) - Term identifier
  - `year` (number) - Academic year
- `gpa` (number) - Cumulative GPA (computed from entries)
- `metadata` (optional ReportMetadata value object) - Transcript generation metadata

**Indexes:**
- `by_studentId` - Index on `studentId` for querying transcripts by student

**Foreign Key Relationships:**
- `studentId` → `students._id`

**Aggregate Root:** Yes (TranscriptAggregate)

**Value Objects:**
- GradeValue: Used in `entries[].grade`
- ReportMetadata: Used in `metadata` field

**Invariants:**
- GPA must be computed correctly based on a fixed formula
- Entries are immutable once added

**Related Collections:**
- References: `students`

---

### Academic Sessions Collection

**Purpose:** Represents academic sessions (e.g., "2024/2025") and their terms.

**Fields:**
- `yearLabel` (string) - Session year label (e.g., "2024/2025")
- `startDate` (number) - Unix timestamp of session start date
- `endDate` (number) - Unix timestamp of session end date
- `terms` (array of term objects) - Array of terms within the session, each containing:
  - `id` (string) - Term identifier within the session
  - `name` (string) - Term name
  - `startDate` (number) - Unix timestamp of term start
  - `endDate` (number) - Unix timestamp of term end

**Indexes:**
- `by_yearLabel` - Index on `yearLabel` for unique lookups

**Aggregate Root:** Yes (AcademicCalendarAggregate)

**Note:** Terms are also stored in a separate `terms` collection for proper ID references in sections and enrollments.

**Invariants:**
- Terms must have valid dates and be non-overlapping within a session
- Session year labels must be unique

**Related Collections:**
- Referenced by: `terms.sessionId`, `sections.sessionId`, `enrollments.sessionId`

---

### Terms Collection

**Purpose:** Represents individual terms within academic sessions, enabling proper ID references.

**Fields:**
- `sessionId` (Id<"academicSessions">) - Foreign key to the academic session
- `name` (string) - Term name
- `startDate` (number) - Unix timestamp of term start date
- `endDate` (number) - Unix timestamp of term end date

**Indexes:**
- `by_sessionId` - Index on `sessionId` for querying terms by session

**Foreign Key Relationships:**
- `sessionId` → `academicSessions._id`

**Invariants:**
- Terms must have valid dates (startDate < endDate)
- Terms must be non-overlapping within a session

**Related Collections:**
- References: `academicSessions`
- Referenced by: `sections.termId`, `enrollments.termId`

---

### Graduation Records Collection

**Purpose:** Represents graduation approvals and records.

**Fields:**
- `studentId` (Id<"students">) - Foreign key to the graduating student
- `approvedBy` (Id<"users">) - Foreign key to the user who approved the graduation
- `date` (number) - Unix timestamp of graduation date

**Indexes:**
- `by_studentId` - Index on `studentId` for querying graduation records by student
- `by_approvedBy` - Index on `approvedBy` for querying by approver
- `by_date` - Index on `date` for querying by graduation date

**Foreign Key Relationships:**
- `studentId` → `students._id`
- `approvedBy` → `users._id`

**Aggregate Root:** Yes (GraduationAggregate)

**Invariants:**
- A graduation record can only be created after all program requirements are confirmed

**Related Collections:**
- References: `students`, `users`

---

### Alumni Profiles Collection

**Purpose:** Stores alumni contact and employment information after graduation. Profiles are created automatically on graduation approval and can be edited by alumni or updated by administrators.

**Fields:**
- `studentId` (Id<"students">) - Foreign key to the graduated student
- `graduationYear` (number) - Year of graduation
- `contactInfo` (object) - Contact object containing:
  - `email` (string) - Email address
  - `phone` (string) - Phone number
  - `address` (object) - Address object containing:
    - `street` (string) - Street address
    - `city` (string) - City name
    - `state` (string) - State or province
    - `postalCode` (string) - Postal or ZIP code
    - `country` (string) - Country name
- `employmentStatus` (string) - Employment status (e.g., "employed", "seeking", "unknown")
- `currentEmployer` (optional string) - Current employer
- `jobTitle` (optional string) - Job title
- `linkedInUrl` (optional string) - LinkedIn profile URL

**Indexes:**
- `by_studentId` - Fast lookup by student
- `by_graduationYear` - Filter and aggregate by graduation year

**Foreign Key Relationships:**
- `studentId` → `students._id`

**Notes:**
- Profiles are created automatically when a student's graduation is approved (via processStudentGraduation mutation)
- Default values on creation: email from user account, empty phone/address, employmentStatus: "unknown"
- Administrators and registrars may also create or update profiles
- Alumni users may update their own profile information via the UI

---

### Audit Logs Collection

**Purpose:** Represents system audit trail for tracking all significant domain events.

**Fields:**
- `entity` (string) - Entity type (e.g., "enrollment", "grade", "user", "course", "section", "assessment", "transcript", "graduation")
- `action` (string) - Action performed (e.g., "StudentEnrolled", "GradeEdited", "CourseCreated", "SectionUpdated")
- `userId` (Id<"users">) - Foreign key to the user who performed the action
- `timestamp` (number) - Unix timestamp of when the action occurred
- `details` (any) - Flexible object for varying audit details (e.g., `{ "previousGrade": "A", "newGrade": "B" }`)

**Indexes:**
- `by_userId` - Index on `userId` for querying audit logs by user
- `by_entity` - Index on `entity` for querying by entity type
- `by_timestamp` - Index on `timestamp` for chronological queries
- `by_entity_action` - Composite index for querying by entity and action

**Foreign Key Relationships:**
- `userId` → `users._id`

**Required Events to Log:**
- StudentEnrolled, StudentDropped, StudentCreated, StudentUpdated
- CourseGradePosted, GradeEdited
- CourseCreated, CourseUpdated
- SectionCreated, SectionUpdated, SectionCancelled
- AssessmentCreated, AssessmentUpdated, AssessmentDeleted
- GraduationApproved
- UserRoleChanged
- TranscriptGenerated

**Log Structure:**
Each log entry includes:
- `entity`: Entity type (e.g., "enrollment", "grade")
- `action`: Action performed (e.g., "StudentEnrolled", "GradeEdited")
- `userId`: User who performed the action
- `timestamp`: When the action occurred
- `details`: Relevant details (e.g., `{ "previousGrade": "A", "newGrade": "B" }`)

**Related Collections:**
- References: `users`

### Instructors Collection

**Purpose:** Represents instructor-specific information linked to user accounts.

**Fields:**
- `userId` (Id<"users">) - Foreign key to the user account
- `departmentId` (Id<"departments">) - Foreign key to the department the instructor belongs to

**Indexes:**
- `by_userId` - Index on `userId` for querying instructor by user account
- `by_departmentId` - Index on `departmentId` for querying instructors by department

**Foreign Key Relationships:**
- `userId` → `users._id`
- `departmentId` → `departments._id`

**Related Collections:**
- References: `users`, `departments`

---

### Sessions Collection

**Purpose:** Represents user authentication sessions with secure tokens.

**Fields:**
- `userId` (Id<"users">) - Foreign key to the user
- `token` (string) - Secure session token
- `expiresAt` (number) - Unix timestamp when session expires
- `createdAt` (number) - Unix timestamp when session was created

**Indexes:**
- `by_token` - Index on `token` for session lookup
- `by_userId` - Index on `userId` for querying sessions by user
- `by_expiresAt` - Index on `expiresAt` for cleanup of expired sessions

**Foreign Key Relationships:**
- `userId` → `users._id`

**Related Collections:**
- References: `users`

---

### Notifications Collection

**Purpose:** Represents user notifications.

**Fields:**
- `userId` (Id<"users">) - Foreign key to the user receiving the notification
- `message` (string) - Notification message
- `read` (boolean) - Whether the notification has been read
- `createdAt` (number) - Unix timestamp when notification was created
- `courseId` (optional Id<"courses">) - Optional course ID for navigation (e.g., grade notifications)

**Indexes:**
- `by_userId` - Index on `userId` for querying notifications by user
- `by_userId_read` - Composite index for querying unread notifications
- `by_createdAt` - Index on `createdAt` for chronological queries

**Foreign Key Relationships:**
- `userId` → `users._id`
- `courseId` → `courses._id` (optional)

**Related Collections:**
- References: `users`, `courses` (optional)

---

### Grade Audit Log Collection

**Purpose:** Represents audit trail for grade unlocking/locking actions by Registrar.

**Fields:**
- `adminId` (Id<"users">) - Registrar/admin who performed the action
- `sectionId` (Id<"sections">) - Section affected by the action
- `action` (string) - Action type: "UNLOCK" or "LOCK"
- `reason` (string) - Mandatory reason for the action
- `timestamp` (number) - Unix timestamp when action occurred

**Indexes:**
- `by_sectionId` - Index on `sectionId` for querying audit logs by section
- `by_adminId` - Index on `adminId` for querying by admin
- `by_timestamp` - Index on `timestamp` for chronological queries
- `by_sectionId_timestamp` - Composite index for section history

**Foreign Key Relationships:**
- `adminId` → `users._id`
- `sectionId` → `sections._id`

**Related Collections:**
- References: `users`, `sections`

---

### Settings Collection

**Purpose:** Represents system-wide configuration settings.

**Fields:**
- `key` (string) - Setting key (e.g., "enrollmentDeadline")
- `value` (any) - Setting value (flexible type)
- `updatedAt` (number) - Unix timestamp when setting was last updated

**Indexes:**
- `by_key` - Index on `key` for setting lookups

**Related Collections:**
- None (standalone configuration)

---

## Value Objects

Value objects are embedded structures within collections that represent domain concepts without their own identity.

### Address

**Used in:** `schools.address`

**Fields:**
- `street` (string) - Street address
- `city` (string) - City name
- `state` (string) - State or province
- `postalCode` (string) - Postal or ZIP code
- `country` (string) - Country name

**Example:**
```typescript
{
  street: "123 University Ave",
  city: "Springfield",
  state: "IL",
  postalCode: "62701",
  country: "USA"
}
```

---

### Contact

**Used in:** `schools.contact`

**Fields:**
- `email` (string) - Email address
- `phone` (string) - Phone number

**Example:**
```typescript
{
  email: "info@university.edu",
  phone: "+1-555-0123"
}
```

---

### ScheduleSlotSpec

**Used in:** `sections.scheduleSlots` (array)

**Fields:**
- `day` (string) - Day of the week (e.g., "Mon", "Tue", "Wed", "Thu", "Fri")
- `startTime` (string) - Start time (e.g., "09:00", "14:30")
- `endTime` (string) - End time (e.g., "10:30", "16:00")
- `room` (string) - Room identifier (e.g., "Room 101", "Building A-205")

**Example:**
```typescript
{
  day: "Mon",
  startTime: "09:00",
  endTime: "10:30",
  room: "Science Building 205"
}
```

---

### FullName

**Used in:** `users.profile`

**Fields:**
- `firstName` (string) - First name (required)
- `middleName` (optional string) - Middle name (optional)
- `lastName` (string) - Last name (required)

**Example:**
```typescript
{
  firstName: "John",
  middleName: "Michael",  // Optional
  lastName: "Doe"
}
```

---

### AcademicPeriod

**Used in:** `sections` and `enrollments` to contextualize them

**Fields:**
- `sessionId` (Id<"academicSessions">) - Academic session ID
- `termId` (Id<"terms">) - Term ID

**Note:** This is not a separate value object structure but rather a conceptual grouping of `sessionId` and `termId` fields in sections and enrollments.

---

### StudentIdentifier

**Used in:** `students`

**Fields:**
- `studentNumber` (string) - Unique student identification number
- `admissionYear` (number) - Year the student was admitted

**Note:** This is not a separate value object structure but rather a conceptual grouping of `studentNumber` and `admissionYear` fields in students.

---

### GradeValue

**Used in:** `grades.grade` and `transcripts.entries[].grade`

**Fields:**
- `numeric` (number) - Numeric grade value (typically 0-100 percentage)
- `letter` (string) - Letter grade (e.g., "A", "B", "C", "D", "F")
- `points` (number) - Grade points (typically 0.0-4.0 scale)

**Example:**
```typescript
{
  numeric: 85.5,
  letter: "B",
  points: 3.0
}
```

---

### ReportMetadata

**Used in:** `transcripts.metadata` (optional)

**Fields:**
- `generatedBy` (Id<"users">) - User who generated the transcript
- `generatedAt` (number) - Unix timestamp of when transcript was generated
- `format` (string) - Format of the transcript (e.g., "pdf", "html")

**Example:**
```typescript
{
  generatedBy: "user123",
  generatedAt: 1704067200000,
  format: "pdf"
}
```

---

## Indexes Summary

All indexes are automatically maintained by Convex and optimize query performance:

### Foreign Key Indexes
- All foreign key fields have indexes for efficient joins and lookups
- Composite indexes on frequently queried field combinations

### Unique Constraint Indexes
- `users.by_email` - Ensures email uniqueness (case-insensitive check in validation)
- `courses.by_code` - Ensures course code uniqueness
- `students.by_studentNumber` - Ensures student number uniqueness
- `academicSessions.by_yearLabel` - Ensures session year label uniqueness
- `enrollments.by_studentId_sectionId` - Ensures unique enrollment (student cannot enroll twice in same section)
- `grades.by_enrollmentId_assessmentId` - Ensures unique grade per enrollment-assessment pair

### Query Optimization Indexes
- Status fields (e.g., `students.by_status`, `enrollments.by_status`)
- Timestamp fields (e.g., `auditLogs.by_timestamp`, `graduationRecords.by_date`)
- Composite indexes for common query patterns

---

## Aggregate Roots

The following collections serve as aggregate roots:

1. **schools** - SchoolAggregate
2. **courses** - CourseAggregate
3. **sections** - SectionAggregate
4. **students** - StudentAggregate
5. **enrollments** - EnrollmentAggregate
6. **academicSessions** - AcademicCalendarAggregate
7. **users** - UserAggregate
8. **transcripts** - TranscriptAggregate
9. **graduationRecords** - GraduationAggregate

**Note:** The `programs` collection is not an aggregate root but is referenced by courses. Students now belong directly to departments, not programs.

For detailed information about aggregate boundaries and invariants, see [Aggregate Roots and Invariants](./aggregates_and_invariants.md).

---

## Related Documentation

- [Aggregate Roots and Invariants](./aggregates_and_invariants.md)
- [Aggregate Validations](./aggregate_validations.md)
- [Domain Services](./domain_services.md)
- [Transactional Mutations](./transactional_mutations.md)

---

## Schema File Location

The schema is defined in: `sims/convex/schema.ts`

To regenerate type definitions after schema changes, run:
```bash
npx convex dev
```

