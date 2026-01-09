# Transactional Mutations

This directory contains transactional operations that span multiple aggregates and ensure data consistency through atomic transactions.

## Overview

All mutations in this directory are designed to be **atomic** - either all operations succeed, or the entire transaction is rolled back. This ensures data consistency across multiple aggregates.

## Available Operations

### Enrollment Operations

#### `enrollStudentInSection`

Enrolls a student in a course section with full validation.

**Input:**
- `studentId`: ID of the student
- `sectionId`: ID of the section

**Transaction Steps:**
1. Validates student status is "active"
2. Validates section has available capacity
3. Checks prerequisites (via EnrollmentService)
4. Checks schedule conflicts (via EnrollmentService)
5. Creates enrollment document
6. Increments section enrollment count
7. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  enrollmentId: Id<"enrollments">,
  enrollmentCount: number
}
```

#### `enroll`

Enrolls current authenticated student in a section (simplified enrollment).

**Input:**
- `sectionId`: ID of the section
- `token`: Session token for authentication (required)
- `joinWaitlist`: Optional boolean to join waitlist if section is full

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is a student
3. Gets student record from userId
4. Validates section exists
5. Validates section is open for enrollment
6. Checks section-specific enrollment deadline (updates section if deadline passed)
7. Checks prerequisites (via EnrollmentService)
8. Checks schedule conflicts (via EnrollmentService)
9. Prevents duplicate enrollment in same course/term (checks existing enrollments)
10. Determines enrollment status ("active" or "waitlisted" if section full)
11. Creates enrollment document
12. Increments section enrollment count (only if not waitlisted)

**Returns:**
```typescript
{
  success: true,
  enrollmentId: Id<"enrollments">,
  enrollmentCount: number,
  status: "active" | "waitlisted"
}
```

#### `dropEnrollment`

Drops a student from a section (withdrawal).

**Input:**
- `enrollmentId`: ID of the enrollment
- `userId`: ID of the user performing the action

**Transaction Steps:**
1. Validates enrollment exists and can be dropped
2. Updates enrollment status to "dropped"
3. Decrements section enrollment count (if was active)
4. Auto-promotes first waitlisted student (if any)
5. Creates audit log entry

#### `dropCourse`

Drops course enrollment for current authenticated student.

**Input:**
- `enrollmentId`: ID of the enrollment
- `token`: Session token for authentication (required)

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is a student
3. Gets student record from userId
4. Validates enrollment exists
5. Validates enrollment belongs to authenticated student
6. Validates enrollment can be dropped (not already dropped/completed)
7. Updates enrollment status to "dropped"
8. Decrements section enrollment count (only if was active/enrolled, not waitlisted)
9. Auto-promotes first waitlisted student (sorted by _creationTime, oldest first)
10. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  promotedEnrollmentId: Id<"enrollments"> | null
}
```

---

### Grade Operations

#### `recordGrade`

Records a grade for an assessment.

**Input:**
- `enrollmentId`: ID of the enrollment
- `assessmentId`: ID of the assessment
- `score`: Numeric score achieved
- `recordedByUserId`: ID of the user recording the grade

**Transaction Steps:**
1. Reads enrollment and section
2. Validates section is not locked (isLocked === true)
3. Validates grades are editable (if finalGradesPosted, gradesEditable must be true)
4. Validates assessment exists and belongs to section
5. Validates score is between 0 and totalPoints
6. Calculates percentage (0-100) and rounds to 2 decimal places
7. Checks for existing grade (handles duplicates by deleting extras)
8. Creates or updates grade document (stores percentage only, not letter grade)
9. Creates audit log entry (CourseGradePosted for new, GradeEdited for updates)
10. Sends grade notification to student (fire-and-forget)

**Returns:**
```typescript
{
  success: true,
  gradeId: Id<"grades">,
  percentage: number
}
```

#### `updateGrades`

Updates multiple grades at once (bulk grade entry).

**Input:**
- `grades`: Array of `{ enrollmentId, assessmentId, score }`
- `token`: Session token for authentication (required)

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is an instructor
3. Processes all grades in parallel (Promise.all)
4. For each grade:
   - Validates enrollment exists
   - Validates instructor owns the section (section.instructorId === userId)
   - Validates section is not locked
   - Validates grades are editable
   - Validates assessment belongs to section
   - Validates score (0 to totalPoints)
   - Calculates percentage and rounds to 2 decimal places
   - Handles duplicate grades (deletes extras)
   - Creates or updates grade document
   - Creates audit log entry (CourseGradePosted or GradeEdited)
   - Creates notification for student (only for new grades)

**Returns:**
```typescript
{
  success: true,
  updated: number,
  results: Array<{ success: true, gradeId, enrollmentId, assessmentId }>
}
```

#### `recordFinalGrade`

Records final grade for an enrollment based on all assessments.

**Input:**
- `enrollmentId`: ID of the enrollment
- `recordedByUserId`: ID of the user recording the grade

**Transaction Steps:**
1. Retrieves all assessments for the section
2. Retrieves all grades for the enrollment
3. Validates all assessments have grades
4. Validates assessment weights sum to 100%
5. Calculates weighted final grade
6. Updates enrollment status to "completed"
7. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  finalGrade: GradeValue,
  finalPercentage: number
}
```

---

### Course Operations

#### `createCourse`

Creates a new course.

**Input:**
- `code`: Course code (e.g., "CSC101")
- `title`: Course title
- `description`: Course description
- `credits`: Number of credits
- `prerequisites`: Array of course codes (not IDs)
- `departmentId`: ID of the department
- `programIds`: Optional array of program IDs
- `status`: Optional course status ("C" = Core, "R" = Required, "E" = Elective, default: "E")
- `level`: Course level
- `createdByUserId`: ID of the user creating the course

**Transaction Steps:**
1. Validates all course invariants (code uniqueness, prerequisites, credits, circular dependencies)
2. Validates course status (if provided)
3. Validates program IDs exist (if provided)
4. Creates course document
5. Validates prerequisite chain (using CourseCatalogService) - rolls back if invalid
6. Adds course to program requiredCourses (if status is C or R and programIds provided)
7. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  courseId: Id<"courses">
}
```

#### `updateCourse`

Updates an existing course.

**Input:**
- `courseId`: ID of the course
- `code`, `title`, `description`, `credits`, `prerequisites`, `departmentId`, `programIds`, `status`, `level`: Optional fields to update
- `updatedByUserId`: ID of the user updating the course

**Transaction Steps:**
1. Gets current course
2. Validates all updated fields (code uniqueness, prerequisites, credits, status)
3. Validates program IDs exist (if provided)
4. Updates course document (only provided fields)
5. Validates prerequisite chain if prerequisites updated (reverts if invalid)
6. Syncs course with program requiredCourses based on status (adds/removes from requiredCourses)
7. Handles removed programs (removes course from their requiredCourses)
8. Creates audit log entry with previous/new values

**Returns:**
```typescript
{
  success: true
}
```

#### `createCourseVersion`

Creates a new course version (Department Head only).

**Input:**
- `token`: Session token for authentication (required)
- `courseId`: ID of the course
- `title`: Course title
- `description`: Course description
- `credits`: Number of credits
- `prerequisites`: Array of course codes

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is department_head
3. Validates course belongs to user's department
4. Creates course version (deactivates existing active versions)
5. Validates prerequisite chain (rolls back if invalid)
6. Returns version ID

**Returns:**
```typescript
{
  success: true,
  versionId: Id<"courseVersions">
}
```

---

### Section Operations

#### `createSection`

Creates a new section.

**Input:**
- `courseId`: ID of the course
- `sessionId`: ID of the academic session
- `termId`: ID of the term
- `instructorId`: ID of the instructor
- `capacity`: Maximum enrollment capacity
- `scheduleSlots`: Array of schedule slots `{ day, startTime, endTime, room }`
- `createdByUserId`: ID of the user creating the section

**Transaction Steps:**
1. Validates all section invariants (course exists, term exists, instructor role, capacity > 0, schedule slots)
2. Creates section document (enrollmentCount: 0)
3. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  sectionId: Id<"sections">
}
```

#### `updateSection`

Updates an existing section.

**Input:**
- `sectionId`: ID of the section
- `capacity`: Optional new capacity
- `scheduleSlots`: Optional new schedule slots
- `instructorId`: Optional new instructor ID
- `updatedByUserId`: ID of the user updating the section

**Transaction Steps:**
1. Validates section exists
2. Validates all updated fields
3. Validates capacity update (cannot reduce below current enrollment)
4. Validates schedule assignment (if scheduleSlots updated)
5. Updates section document
6. Creates audit log entry

**Returns:**
```typescript
{
  success: true
}
```

#### `cancelSection`

Cancels a section.

**Input:**
- `sectionId`: ID of the section
- `userId`: ID of the user cancelling the section
- `reason`: Optional cancellation reason

**Transaction Steps:**
1. Validates section exists
2. Gets enrolled students count
3. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  affectedEnrollments: number
}
```

#### `toggleGradeEditing`

Toggles grade editing for a section (Registrar only).

**Input:**
- `sectionId`: ID of the section
- `token`: Session token for authentication (required)
- `allowEditing`: Boolean to allow or lock grade editing

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is registrar or admin
3. Validates section exists
4. Validates final grades have been posted (finalGradesPosted must be true)
5. Updates gradesEditable field
6. Creates audit log entry with previous/new values

**Returns:**
```typescript
{
  success: true,
  gradesEditable: boolean
}
```

---

### Assessment Operations

#### `createAssessment`

Creates a new assessment.

**Input:**
- `sectionId`: ID of the section
- `title`: Assessment title
- `weight`: Assessment weight (0-100)
- `totalPoints`: Total points possible
- `dueDate`: Due date (Unix timestamp)
- `token`: Session token for authentication (required)

**Transaction Steps:**
1. Authenticates user via token
2. Validates section exists
3. Validates assessment weight won't exceed 100% total (using validateAssessmentWeight)
4. Validates weight is between 0 and 100
5. Validates totalPoints is positive
6. Creates assessment document
7. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  assessmentId: Id<"assessments">
}
```

#### `updateAssessment`

Updates an existing assessment.

**Input:**
- `assessmentId`: ID of the assessment
- `title`, `weight`, `totalPoints`, `dueDate`: Optional fields to update
- `token`: Session token for authentication

**Transaction Steps:**
1. Authenticates user via token
2. Validates assessment exists
3. Validates all updated fields
4. Validates weight won't exceed 100% (if weight updated)
5. Updates assessment document
6. Creates audit log entry

**Returns:**
```typescript
{
  success: true
}
```

#### `deleteAssessment`

Deletes an assessment.

**Input:**
- `assessmentId`: ID of the assessment
- `token`: Session token for authentication (required)

**Transaction Steps:**
1. Authenticates user via token
2. Validates assessment exists
3. Validates no grades have been recorded for this assessment (checks grades collection)
4. Creates audit log entry (before deletion)
5. Deletes assessment document

**Returns:**
```typescript
{
  success: true
}
```

---

### Graduation Operations

#### `processStudentGraduation`

Processes a student's graduation with full degree audit.

**Input:**
- `studentId`: ID of the student
- `approverUserId`: ID of the user approving graduation

**Transaction Steps:**
1. Validates student exists
2. Validates approver has authority (must be registrar)
3. Runs degree audit (checks credits ≥ 120, GPA ≥ 2.0, no incomplete enrollments)
4. Validates all requirements are satisfied (throws error if not eligible)
5. Updates student status to "graduated"
6. Creates graduation record
7. Creates audit log entry (GraduationApproved)
8. Auto-creates alumni profile (with default values)
9. Creates audit log entry (AlumniProfileCreated)

**Returns:**
```typescript
{
  success: true,
  graduationId: Id<"graduationRecords">,
  studentId: Id<"students">,
  auditResult: DegreeAuditResult,
  alumniId: Id<"alumniProfiles">
}
```

#### `checkGraduationEligibility`

Checks if a student is eligible for graduation (read-only).

**Input:**
- `studentId`: ID of the student

**Returns:** Degree audit result with eligibility status

#### `getAllStudentsForGraduation`

Gets all students for graduation management (Registrar only).

**Input:**
- `requesterUserId`: ID of the requesting user
- `departmentId`: Optional department filter
- `searchTerm`: Optional search term (name or student number)

**Returns:** List of students with enriched information (name, email, department, GPA, credits)

#### `getAllGraduationRecords`

Gets all graduation records with enriched information (Registrar only).

**Input:**
- `requesterUserId`: ID of the requesting user
- `studentId`: Optional student filter
- `startDate`: Optional start date filter
- `endDate`: Optional end date filter

**Returns:** List of graduation records with student and approver information

#### `checkGraduationEligibility`

Checks if a student is eligible for graduation (read-only).

**Input:**
- `studentId`: ID of the student

**Returns:** Degree audit result with eligibility status

---

### Transcript Operations

#### `generateTranscript`

Generates an official transcript for a student.

**Input:**
- `studentId`: ID of the student
- `generatedByUserId`: ID of the user generating the transcript
- `format`: Optional format (default: "pdf")

**Transaction Steps:**
1. Generates official transcript (via TranscriptService)
   - Gets or creates transcript
   - Recalculates GPA from current entries
   - Updates transcript with metadata (generatedBy, generatedAt, format)
2. Updates transcript document (if newly created)
3. Creates audit log entry (TranscriptGenerated)

**Returns:**
```typescript
{
  success: true,
  transcriptId: Id<"transcripts">,
  gpa: number,
  entriesCount: number
}
```

#### `addEnrollmentToTranscriptMutation`

Adds a completed enrollment to a student's transcript.

**Input:**
- `transcriptId`: ID of the transcript
- `enrollmentId`: ID of the enrollment
- `term`: Term name
- `year`: Year
- `addedByUserId`: ID of the user adding the enrollment

**Transaction Steps:**
1. Adds enrollment to transcript (via TranscriptService)
   - Validates enrollment is completed
   - Creates transcript entry (calculates final grade from assessments)
   - Removes duplicate entries (same courseCode, term, year)
   - Adds entry to transcript
   - Recalculates GPA
2. Creates audit log entry (TranscriptGenerated with action: "EnrollmentAddedToTranscript")

**Returns:**
```typescript
{
  success: true,
  updatedGpa: number,
  totalEntries: number
}
```

---

### User Operations

#### `changeUserRoles`

Changes user roles.

**Input:**
- `targetUserId`: ID of the user whose roles are being changed
- `newRoles`: Array of new roles
- `changedByUserId`: ID of the user making the change

**Transaction Steps:**
1. Validates user exists
2. Captures previous roles
3. Validates new roles (via validateUpdateUser)
4. Updates user roles
5. Creates audit log entry (UserRoleChanged with previous/new roles)

**Returns:**
```typescript
{
  success: true,
  previousRoles: string[],
  newRoles: string[]
}
```

---

## Error Handling

All mutations throw domain-specific errors that should be caught and handled:

```typescript
import {
  InvariantViolationError,
  NotFoundError,
  ValidationError
} from "../convex/lib/aggregates";

try {
  await enrollStudent({ studentId, sectionId });
} catch (error) {
  if (error instanceof InvariantViolationError) {
    // Handle business rule violation
    console.error("Business rule violation:", error.message);
  } else if (error instanceof NotFoundError) {
    // Handle missing entity
    console.error("Not found:", error.message);
  } else {
    // Handle other errors
    console.error("Error:", error);
  }
}
```

## Transaction Guarantees

### Atomicity
All operations within a mutation are atomic. If any step fails:
- All database changes are rolled back
- No partial state is persisted
- Error is thrown to the caller

### Consistency
All invariants are validated before any changes are made:
- Aggregate invariants are checked
- Cross-aggregate references are validated
- Business rules are enforced

### Isolation
Convex mutations are executed in isolation:
- Each mutation sees a consistent snapshot of the database
- Concurrent mutations are serialized
- No dirty reads or write conflicts

## Related Services

These mutations use domain services for complex business logic:

- **EnrollmentService**: Prerequisite checks, schedule conflict detection
- **GraduationService**: Degree audit, requirement validation
- **AuditLogService**: Audit trail creation

See [Domain Services](./domain_services.md) for service implementations.

## Testing

Each mutation should be tested with:
1. **Happy path**: All validations pass, operation succeeds
2. **Invariant violations**: Business rules are violated
3. **Missing entities**: Referenced entities don't exist
4. **Concurrent operations**: Multiple mutations running simultaneously

## Best Practices

1. **Always validate first**: Check invariants before making changes
2. **Use services for complex logic**: Keep mutations focused on transaction orchestration
3. **Create audit logs**: Track all important operations
4. **Handle errors gracefully**: Return user-friendly error messages
5. **Test edge cases**: Ensure transactions handle all failure scenarios

## Related Documentation

- [Domain Services](./domain_services.md)
- [Aggregate Roots and Invariants](./aggregates_and_invariants.md)

