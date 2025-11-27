# Aggregate Roots and Invariants

This document defines the Aggregate boundaries and critical business rules (invariants) that must be enforced within a single transaction for each Aggregate in the Student Information Management System (SIMS).

## Overview

An **Aggregate** is a cluster of domain objects (entities and value objects) that are treated as a single unit for data changes. The **Aggregate Root** is the primary entry point for any changes to the Aggregate. All invariants must be enforced within a single transaction when modifying an Aggregate.

---

## 1. SchoolAggregate

**Root Entity:** `schools`

**Aggregate Boundary:**
- **Root:** `schools` (contains: name, address, contact)
- **Referenced Entities:** `departments`, `programs` (via foreign key references)

**Description:**
The SchoolAggregate represents an educational institution and its organizational structure. Departments and programs are referenced entities that belong to a school.

### Invariants

1. **Department Ownership**
   - A department must belong to a valid school
   - The `departments.schoolId` must reference an existing `schools._id`
   - **Enforcement:** Validate `schoolId` exists before creating/updating a department

2. **Cascade Deletion**
   - Deleting a school should cascade to its departments
   - **Enforcement:** When a school is deleted, all associated departments must be deleted or marked as inactive in the same transaction
   - **Note:** Programs may need special handling (archived vs deleted) depending on business rules

3. **School Uniqueness**
   - School name should be unique within the system (if required by business rules)
   - **Enforcement:** Check for duplicate school names before creation

### Transaction Boundaries

- Creating/updating a school: Single transaction
- Deleting a school: Must include cascade deletion of departments in the same transaction
- Creating a department: Must validate school exists in the same transaction

---

## 2. ProgramAggregate

**Root Entity:** `programs`

**Aggregate Boundary:**
- **Root:** `programs` (contains: code, name, requirements, departmentId)
- **Referenced Entities:** Required courses (via `courses` collection)

**Description:**
The ProgramAggregate represents an academic program with its requirements and course structure. It maintains references to courses that fulfill program requirements.

### Invariants

1. **Credit Requirements Consistency**
   - The total credit requirements for the program must be logically consistent
   - Minimum and maximum credit requirements must be valid (e.g., min ≤ max)
   - **Enforcement:** Validate credit totals when creating/updating program requirements

2. **Prerequisite Validity**
   - Course prerequisites referenced in program requirements must exist
   - All course IDs in `requirements` must reference valid courses in the `courses` collection
   - **Enforcement:** Validate all referenced course IDs exist before saving program requirements

3. **Program Code Uniqueness**
   - Program code must be unique within a department (or globally, depending on business rules)
   - **Enforcement:** Check for duplicate program codes before creation

4. **Department Association**
   - Program must belong to a valid department
   - The `programs.departmentId` must reference an existing `departments._id`
   - **Enforcement:** Validate department exists before creating/updating a program

### Transaction Boundaries

- Creating/updating a program: Must validate all course prerequisites exist in the same transaction
- Modifying program requirements: Must validate credit totals and course references in the same transaction

---

## 3. CourseAggregate

**Root Entity:** `courses`

**Aggregate Boundary:**
- **Root:** `courses` (contains: code, title, description, credits, prerequisites)
- **Value Objects:** Course syllabus versions (if stored as embedded documents)
- **Referenced Entities:** Prerequisites (self-referencing via `prerequisites` array)

**Description:**
The CourseAggregate represents a course offering with its metadata and prerequisite structure. Courses can have prerequisites that reference other courses.

### Invariants

1. **Course Code Uniqueness**
   - The course code must be unique across the institution
   - **Enforcement:** Check for duplicate course codes before creation/update
   - **Index:** `by_code` index supports uniqueness checks

2. **Prerequisite Validity**
   - All listed prerequisites must point to valid courses
   - All IDs in `prerequisites` array must reference existing courses in the `courses` collection
   - **Enforcement:** Validate all prerequisite course IDs exist before saving
   - **Circular Dependency Prevention:** A course cannot be a prerequisite of itself (directly or indirectly)

3. **Credit Value Validity**
   - Credits must be a positive number
   - Credits should be within a reasonable range (e.g., 0.5 to 6 credits)
   - **Enforcement:** Validate credit value on create/update

4. **Prerequisite Chain Integrity**
   - When deleting a course, check if it's referenced as a prerequisite
   - **Enforcement:** Prevent deletion or handle cascade updates to prerequisite lists

### Transaction Boundaries

- Creating/updating a course: Must validate all prerequisites exist and check for circular dependencies in the same transaction
- Deleting a course: Must check prerequisite references and handle updates in the same transaction

---

## 4. SectionAggregate

**Root Entity:** `sections`

**Aggregate Boundary:**
- **Root:** `sections` (contains: courseId, termId, instructorId, capacity, scheduleSlots, enrollmentCount)
- **Value Objects:** `scheduleSlots` (array of ScheduleSlotSpec)
- **Referenced Entities:** `assessments` (via foreign key), `instructorId` (reference to users)

**Description:**
The SectionAggregate represents a specific course offering in a term with scheduling, enrollment limits, and assessment structure.

### Invariants

1. **Enrollment Capacity**
   - The `enrollmentCount` must never exceed `capacity`
   - **Enforcement:** 
     - When enrolling a student: Check `enrollmentCount < capacity` before incrementing
     - When updating capacity: Ensure `capacity >= enrollmentCount`
     - All enrollment operations must be atomic

2. **Assessment Weight Totals**
   - The sum of all `assessments.weight` for the section must equal 100%
   - **Enforcement:** 
     - When creating/updating an assessment: Recalculate total weight
     - When deleting an assessment: Recalculate total weight
     - Reject operations that would make total weight ≠ 100%

3. **Schedule Slot Validity**
   - Schedule slots must have valid time ranges (startTime < endTime)
   - Schedule slots should not overlap within the same section
   - **Enforcement:** Validate time ranges and check for overlaps when creating/updating schedule slots

4. **Instructor Assignment**
   - Instructor must be a valid user with appropriate role (e.g., "instructor", "professor")
   - **Enforcement:** Validate instructor exists and has required role before assignment

5. **Term Association**
   - Section must belong to a valid term
   - The `sections.termId` must reference an existing `terms._id`
   - **Enforcement:** Validate term exists before creating/updating a section

### Transaction Boundaries

- Enrolling a student: Must check capacity and increment enrollmentCount atomically
- Creating/updating assessments: Must validate weight totals in the same transaction
- Updating capacity: Must ensure capacity >= current enrollmentCount in the same transaction

---

## 5. StudentAggregate

**Root Entity:** `students`

**Aggregate Boundary:**
- **Root:** `students` (contains: userId, studentNumber, admissionYear, programId, level, status)
- **Referenced Entities:** 
  - `userId` (reference to User aggregate)
  - `enrollments` (via foreign key references)
  - `transcriptId` (reference to transcripts, if implemented)
- **Value Objects:** `StudentIdentifier` (studentNumber, admissionYear)

**Description:**
The StudentAggregate represents a student's academic record and status. It controls what operations a student can perform based on their status.

### Invariants

1. **Status-Based Operation Control**
   - The student's status (active/suspended/graduated) controls allowed operations
   - **Active students:** Can enroll in courses, view transcripts, update profile
   - **Suspended students:** Cannot enroll in new courses, may have limited access
   - **Graduated students:** Cannot enroll in courses, read-only access to records
   - **Enforcement:** 
     - Check student status before allowing enrollment operations
     - Validate status transitions (e.g., cannot go from graduated back to active without admin action)

2. **User Association**
   - Student must be associated with a valid user account
   - The `students.userId` must reference an existing `users._id`
   - **Enforcement:** Validate user exists before creating/updating a student record

3. **Program Association**
   - Student must belong to a valid program
   - The `students.programId` must reference an existing `programs._id`
   - **Enforcement:** Validate program exists before creating/updating a student

4. **Student Number Uniqueness**
   - Student number must be unique across the system
   - **Enforcement:** Check for duplicate student numbers before creation
   - **Index:** `by_studentNumber` index supports uniqueness checks

5. **One-to-One User Relationship**
   - A user account should typically map to one student record (unless business rules allow multiple)
   - **Enforcement:** Validate one-to-one relationship if required by business rules

### Transaction Boundaries

- Enrolling a student in a section: Must check student status in the same transaction
- Updating student status: Must validate status transition rules in the same transaction
- Creating a student: Must validate user and program exist in the same transaction

---

## 6. EnrollmentAggregate

**Root Entity:** `enrollments`

**Aggregate Boundary:**
- **Root:** `enrollments` (contains: studentId, sectionId, status, enrolledAt, sessionId, termId)
- **Referenced Entities:** `grades` (via foreign key references)

**Description:**
The EnrollmentAggregate represents a student's enrollment in a course section. It maintains the enrollment status and associated grades.

### Invariants

1. **Final Grade Immutability**
   - Once a final grade is recorded, the enrollment status cannot be changed without an official appeal process
   - **Enforcement:**
     - Check if final grade exists before allowing status changes
     - Require special permission/flag for status changes after final grade
     - Log all status changes after final grade for audit purposes

2. **Enrollment Status Validity**
   - Status must be from a predefined set (e.g., "enrolled", "dropped", "completed", "failed", "withdrawn")
   - **Enforcement:** Validate status value against allowed set

3. **Unique Enrollment**
   - A student cannot be enrolled in the same section multiple times
   - **Enforcement:** Check for existing enrollment before creating new one
   - **Index:** `by_studentId_sectionId` composite index supports uniqueness checks

4. **Student and Section Validity**
   - Enrollment must reference valid student and section
   - The `enrollments.studentId` must reference an existing `students._id`
   - The `enrollments.sectionId` must reference an existing `sections._id`
   - **Enforcement:** Validate both references exist before creating enrollment

5. **Term Consistency**
   - Enrollment term must match section term
   - The `enrollments.termId` should match `sections.termId`
   - **Enforcement:** Validate term consistency when creating enrollment

### Transaction Boundaries

- Creating enrollment: Must validate student, section, and check for duplicates in the same transaction
- Changing enrollment status: Must check for final grade and validate status transition in the same transaction
- Recording final grade: Must update enrollment status appropriately in the same transaction

---

## 7. AcademicCalendarAggregate

**Root Entity:** `academicSessions`

**Aggregate Boundary:**
- **Root:** `academicSessions` (contains: label, terms array)
- **Referenced Entities:** `terms` (separate collection with sessionId reference)
- **Value Objects:** Term-level rules (add/drop deadlines, if stored as embedded)

**Description:**
The AcademicCalendarAggregate represents academic sessions and their terms with scheduling rules and deadlines.

### Invariants

1. **Term Date Validity**
   - Terms must have valid dates
   - `startDate` must be before `endDate`
   - Dates must be in the future or past as appropriate (no invalid date ranges)
   - **Enforcement:** Validate date ranges when creating/updating terms

2. **Non-Overlapping Terms**
   - Terms must be non-overlapping within a session
   - No two terms in the same session should have overlapping date ranges
   - **Enforcement:** 
     - Check for date overlaps when creating/updating a term
     - Validate: `term1.endDate < term2.startDate` OR `term2.endDate < term1.startDate`

3. **Session Label Uniqueness**
   - Session labels should be unique (e.g., "Fall 2024", "Spring 2025")
   - **Enforcement:** Check for duplicate labels before creation
   - **Index:** `by_label` index supports uniqueness checks

4. **Term-Session Association**
   - Terms must belong to a valid academic session
   - The `terms.sessionId` must reference an existing `academicSessions._id`
   - **Enforcement:** Validate session exists before creating/updating a term

5. **Add/Drop Deadline Validity**
   - Add/drop deadlines (if stored) must be within the term date range
   - **Enforcement:** Validate deadlines fall between term start and end dates

### Transaction Boundaries

- Creating/updating a term: Must validate dates and check for overlaps in the same transaction
- Creating an academic session: Must validate label uniqueness in the same transaction
- Updating term dates: Must re-validate non-overlap constraint in the same transaction

---

## 8. UserAggregate

**Root Entity:** `users`

**Aggregate Boundary:**
- **Root:** `users` (contains: username, hashedPassword, roles, profile)
- **Value Objects:** `FullName` (embedded in profile)

**Description:**
The UserAggregate represents system users with authentication credentials and role-based access control.

### Invariants

1. **Password Hashing**
   - Password must be hashed (never store plain text passwords)
   - The `hashedPassword` field must contain a properly hashed password
   - **Enforcement:** 
     - Always hash passwords before storing
     - Never allow direct updates to `hashedPassword` without hashing
     - Use secure hashing algorithm (e.g., bcrypt, argon2)

2. **Role Assignment Validity**
   - Role assignments must be from a predefined set
   - Valid roles: e.g., "student", "instructor", "admin", "registrar", "department_head"
   - **Enforcement:** 
     - Validate all roles in the `roles` array against allowed set
     - Reject invalid role assignments

3. **Username Uniqueness**
   - Username must be unique across the system
   - **Enforcement:** Check for duplicate usernames before creation
   - **Index:** `by_username` index supports uniqueness checks

4. **Profile Completeness**
   - Profile must contain required fields (firstName, lastName)
   - Middle name is optional
   - **Enforcement:** Validate required profile fields before saving

5. **Role Consistency**
   - User roles should be consistent with related entities
   - If user has "student" role, there should be a corresponding student record
   - If user has "instructor" role, they should be assignable as section instructor
   - **Enforcement:** Validate role-entity consistency when creating/updating users

### Transaction Boundaries

- Creating/updating a user: Must hash password and validate roles in the same transaction
- Changing user password: Must hash new password in the same transaction
- Updating user roles: Must validate role set in the same transaction

---

## 9. TranscriptAggregate

**Root Entity:** `transcripts`

**Aggregate Boundary:**
- **Root:** `transcripts` (contains: studentId, entries, gpa, metadata)
- **Value Objects:** 
  - Transcript entries (array of entry objects with GradeValue)
  - `ReportMetadata` (optional, embedded in metadata)

**Description:**
The TranscriptAggregate represents a student's academic transcript with computed GPA and immutable course entries.

### Invariants

1. **GPA Calculation Accuracy**
   - GPA must be computed correctly based on a fixed formula
   - Formula: `GPA = Σ(grade.points × credits) / Σ(credits)` for all entries
   - **Enforcement:**
     - Recalculate GPA whenever entries are added or modified
     - Validate calculated GPA matches stored GPA
     - Use consistent rounding (typically 2 decimal places)

2. **Entry Immutability**
   - Entries are immutable once added
   - **Enforcement:**
     - Do not allow direct updates to existing entries
     - To correct errors, add new entries with correction notes or use an audit trail
     - Only allow additions, not modifications or deletions

3. **Student Association**
   - Transcript must belong to a valid student
   - The `transcripts.studentId` must reference an existing `students._id`
   - **Enforcement:** Validate student exists before creating/updating transcript

4. **Entry Validity**
   - All transcript entries must have valid course codes, credits, and grades
   - Grade values must be within valid ranges
   - **Enforcement:** Validate entry data before adding to transcript

5. **One Transcript Per Student**
   - A student should have one primary transcript (unless business rules allow multiple)
   - **Enforcement:** Validate one-to-one relationship if required

6. **Metadata Consistency**
   - If metadata exists, `generatedBy` must reference a valid user
   - `generatedAt` must be a valid timestamp
   - **Enforcement:** Validate metadata fields when present

### Transaction Boundaries

- Adding transcript entry: Must recalculate GPA and validate entry in the same transaction
- Creating transcript: Must validate student exists in the same transaction
- Updating GPA: Must ensure it matches calculated value from entries in the same transaction

---

## 10. GraduationAggregate

**Root Entity:** `graduationRecords`

**Aggregate Boundary:**
- **Root:** `graduationRecords` (contains: studentId, approvedBy, date)
- **Referenced Entities:** `studentId` (reference to students), `approvedBy` (reference to users)

**Description:**
The GraduationAggregate represents the graduation approval workflow and degree conferral process.

### Invariants

1. **Prerequisite Validation**
   - A graduation record can only be created after the graduation service has confirmed all requirements are met
   - **Enforcement:**
     - Check that student has completed all program requirements
     - Verify minimum GPA requirements are met
     - Confirm all required courses are completed with passing grades
     - Validate no outstanding holds or obligations

2. **Approval Authority**
   - The `approvedBy` user must have appropriate authority (e.g., "registrar", "admin", "department_head")
   - **Enforcement:** Validate approver has required role before creating graduation record

3. **Student Association**
   - Graduation record must belong to a valid student
   - The `graduationRecords.studentId` must reference an existing `students._id`
   - **Enforcement:** Validate student exists before creating graduation record

4. **Date Validity**
   - Graduation date must be a valid date
   - Date should typically be in the past or present (not future, unless for planned graduations)
   - **Enforcement:** Validate date format and logical constraints

5. **One Graduation Per Student Per Program**
   - A student should typically have one graduation record per program
   - **Enforcement:** Check for existing graduation record before creating new one (if business rules require uniqueness)

6. **Student Status Update**
   - Creating a graduation record should update student status to "graduated"
   - **Enforcement:** Update student status atomically with graduation record creation

### Transaction Boundaries

- Creating graduation record: Must validate all requirements, check approver authority, and update student status in the same transaction
- Approving graduation: Must verify all prerequisites are met in the same transaction

---

## Implementation Notes

### Transaction Enforcement

All invariants must be enforced within a single database transaction. In Convex, this means:

1. **Mutations** should validate all invariants before committing changes
2. **Queries** can read across aggregates but should not modify them
3. **Cross-aggregate operations** may require multiple transactions with eventual consistency

### Validation Functions

Consider creating validation helper functions for each aggregate:

```typescript
// Example structure (not actual implementation)
function validateSchoolAggregate(school: School, departments: Department[]) {
  // Validate invariants
  // Return validation result
}
```

### Error Handling

When invariants are violated:
1. Return descriptive error messages
2. Log violations for audit purposes
3. Prevent the operation from completing
4. Roll back any partial changes

### Testing

Each invariant should have corresponding unit tests:
- Test valid operations succeed
- Test invalid operations are rejected
- Test edge cases and boundary conditions

---

## Aggregate Interaction Patterns

### Allowed Patterns

1. **Aggregate Root → Referenced Entity (Read)**
   - Reading referenced entities is allowed
   - Example: Reading course details when viewing a section

2. **Aggregate Root → Value Object (Read/Write)**
   - Value objects are part of the aggregate
   - Example: Modifying schedule slots within a section

### Restricted Patterns

1. **Direct Modification of Referenced Entities**
   - Do not modify entities from other aggregates directly
   - Example: Do not modify a course when working with a section

2. **Cross-Aggregate Transactions**
   - Avoid modifying multiple aggregates in one transaction
   - Use eventual consistency or domain events for coordination

---

## Revision History

- **2024-01-XX**: Initial documentation of aggregates and invariants

