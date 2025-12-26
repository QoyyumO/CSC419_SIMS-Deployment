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
- `token`: Session token for authentication
- `joinWaitlist`: Optional boolean to join waitlist if section is full

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is a student
3. Validates section is open for enrollment
4. Checks enrollment deadline
5. Checks prerequisites
6. Checks schedule conflicts
7. Prevents duplicate enrollment in same course/term
8. Creates enrollment (status: "active" or "waitlisted")
9. Increments section enrollment count (if not waitlisted)

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
- `token`: Session token for authentication

**Transaction Steps:**
1. Authenticates user via token
2. Validates enrollment belongs to authenticated student
3. Updates enrollment status to "dropped"
4. Decrements section enrollment count (if was active)
5. Auto-promotes first waitlisted student (if any)
6. Creates audit log entry

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
2. Validates section is not locked
3. Validates grades are editable (if final grades posted)
4. Validates assessment belongs to section
5. Validates score is between 0 and totalPoints
6. Calculates percentage (0-100)
7. Creates or updates grade document
8. Creates audit log entry (new grade or grade edit)

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
- `token`: Session token for authentication

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is an instructor
3. For each grade:
   - Validates enrollment exists
   - Validates instructor owns the section
   - Validates section is not locked
   - Validates grades are editable
   - Validates assessment belongs to section
   - Validates score
   - Creates or updates grade
   - Creates audit log entry
   - Creates notification for student (if new grade)

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
- `prerequisites`: Array of course codes
- `departmentId`: ID of the department
- `programIds`: Optional array of program IDs
- `status`: Optional course status ("C" = Core, "R" = Required, "E" = Elective)
- `level`: Course level
- `createdByUserId`: ID of the user creating the course

**Transaction Steps:**
1. Validates course code uniqueness
2. Validates prerequisites exist
3. Validates no circular prerequisites
4. Validates credit value
5. Validates course status
6. Creates course document
7. Adds course to program requiredCourses (if status is C or R)
8. Creates audit log entry

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
1. Validates course exists
2. Validates all updated fields
3. Updates course document
4. Syncs course with program requiredCourses based on status
5. Creates audit log entry

**Returns:**
```typescript
{
  success: true
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
1. Validates course exists
2. Validates instructor role
3. Validates schedule assignment (instructor and room conflicts)
4. Validates capacity
5. Creates section document
6. Creates audit log entry

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
- `token`: Session token for authentication
- `allowEditing`: Boolean to allow or lock grade editing

**Transaction Steps:**
1. Authenticates user via token
2. Validates user is registrar or admin
3. Validates section exists
4. Validates final grades have been posted
5. Updates gradesEditable field
6. Creates audit log entry

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
- `token`: Session token for authentication

**Transaction Steps:**
1. Authenticates user via token
2. Validates section exists
3. Validates assessment weight won't exceed 100%
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
- `token`: Session token for authentication

**Transaction Steps:**
1. Authenticates user via token
2. Validates assessment exists
3. Validates no grades have been recorded for this assessment
4. Creates audit log entry
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
2. Validates approver has authority
3. Runs degree audit (checks all program requirements)
4. Validates all requirements are satisfied
5. Updates student status to "graduated"
6. Creates graduation record
7. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  graduationId: Id<"graduationRecords">,
  studentId: Id<"students">,
  auditResult: DegreeAuditResult
}
```

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
1. Validates student exists
2. Gets or creates transcript
3. Recalculates GPA from current entries
4. Updates transcript with metadata
5. Creates audit log entry

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
1. Validates transcript exists
2. Creates transcript entry from enrollment
3. Adds entry to transcript
4. Recalculates GPA
5. Creates audit log entry

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
2. Validates new roles
3. Updates user roles
4. Creates audit log entry

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

