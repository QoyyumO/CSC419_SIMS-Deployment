# Aggregate Validation Library

This directory contains the implementation of aggregate root validation functions and invariant enforcement for the Student Information Management System (SIMS).

## Structure

```
convex/lib/
├── errors.ts                    # Domain error classes
├── aggregates/
│   ├── index.ts                # Main export file
│   ├── types.ts                # TypeScript type definitions
│   ├── schoolAggregate.ts      # School aggregate validations
│   ├── programAggregate.ts     # Program aggregate validations
│   ├── courseAggregate.ts      # Course aggregate validations
│   ├── sectionAggregate.ts     # Section aggregate validations
│   ├── studentAggregate.ts     # Student aggregate validations
│   ├── enrollmentAggregate.ts  # Enrollment aggregate validations
│   ├── userAggregate.ts        # User aggregate validations
│   ├── transcriptAggregate.ts  # Transcript aggregate validations
│   ├── academicCalendarAggregate.ts  # Academic calendar validations
│   └── graduationAggregate.ts  # Graduation aggregate validations
└── services/                   # Domain services (see domain_services.md)
```

## Usage

### Basic Example

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { validateCreateStudent } from "../lib/aggregates";

export const createStudent = mutation({
  args: {
    userId: v.id("users"),
    studentNumber: v.string(),
    programId: v.id("programs"),
    level: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate invariants BEFORE creating
    await validateCreateStudent(
      ctx.db,
      args.userId,
      args.studentNumber,
      args.programId,
      args.status as "active" | "suspended" | "graduated" | "inactive"
    );

    // If validation passes, create the student
    const studentId = await ctx.db.insert("students", {
      userId: args.userId,
      studentNumber: args.studentNumber,
      admissionYear: new Date().getFullYear(),
      programId: args.programId,
      level: args.level,
      status: args.status,
    });

    return studentId;
  },
});
```

### Error Handling

All validation functions throw domain-specific errors that should be caught and handled:

```typescript
import { 
  InvariantViolationError, 
  NotFoundError, 
  ValidationError 
} from "../lib/errors";

export const createStudent = mutation({
  handler: async (ctx, args) => {
    try {
      await validateCreateStudent(ctx.db, ...);
      // Create student...
    } catch (error) {
      if (error instanceof InvariantViolationError) {
        // Handle business rule violation
        throw new Error(`Business rule violation: ${error.message}`);
      } else if (error instanceof NotFoundError) {
        // Handle missing entity
        throw new Error(`Not found: ${error.message}`);
      } else if (error instanceof ValidationError) {
        // Handle validation error
        throw new Error(`Validation failed: ${error.message}`);
      }
      throw error;
    }
  },
});
```

## Available Validation Functions

### School Aggregate
- `validateCreateSchool(db, name)`
- `validateUpdateSchool(db, schoolId, name?)`
- `validateDeleteSchool(db, schoolId)` - Returns count of dependent departments
- `validateDepartmentOwnership(db, schoolId)`
- `validateSchoolNameUniqueness(db, name, excludeId?)`

### Program Aggregate
- `validateCreateProgram(db, departmentId, code, requirements)`
- `validateUpdateProgram(db, programId, departmentId?, code?, requirements?)`
- `validateProgramDepartment(db, departmentId)`
- `validateProgramCodeUniqueness(db, code, departmentId, excludeId?)`
- `validateCreditRequirements(requirements)`
- `validateProgramCoursePrerequisites(db, requirements)`

### Course Aggregate
- `validateCreateCourse(db, code, credits, prerequisites)` - Validates all invariants for creating a course
- `validateUpdateCourse(db, courseId, code?, credits?, prerequisites?)` - Validates all invariants for updating a course
- `validateCourseCodeUniqueness(db, code, excludeId?)` - Validates course code uniqueness
- `validateCoursePrerequisites(db, prerequisites)` - Validates all prerequisites point to valid courses (by code)
- `validateNoCircularPrerequisites(courseCode, prerequisites)` - Validates course is not a prerequisite of itself
- `validateCreditValue(credits)` - Validates credit value is positive and ≤ 6
- `validateCourseStatus(status)` - Validates course status is "C", "R", or "E"
- `isRequiredCourse(status)` - Checks if course status is required (C or R)
- `getCoursesUsingAsPrerequisite(db, courseCode)` - Returns list of courses that use this course as a prerequisite

### Section Aggregate
- `validateCreateSection(db, courseId, termId, instructorId, capacity, scheduleSlots)` - Validates all invariants for creating a section
- `validateUpdateSection(db, sectionId, capacity?, scheduleSlots?, instructorId?)` - Validates all invariants for updating a section
- `validateSectionCanEnroll(db, sectionId)` - Validates section has available capacity for enrollment
- `validateEnrollmentCapacity(enrollmentCount, capacity)` - Validates enrollment count doesn't exceed capacity
- `validateCapacityUpdate(currentEnrollmentCount, newCapacity)` - Validates capacity update doesn't violate enrollment count
- `validateAssessmentWeights(db, sectionId, excludeAssessmentId?)` - Validates all assessment weights sum to 100%
- `validateAssessmentWeight(db, sectionId, newWeight, excludeAssessmentId?)` - Validates new assessment weight won't exceed 100% total
- `validateScheduleSlot(slot)` - Validates a single schedule slot (startTime < endTime)
- `validateNoOverlappingSlots(slots)` - Validates no overlapping schedule slots within the same section
- `validateInstructorRole(db, instructorId)` - Validates instructor has appropriate role (instructor, admin, or department_head)

### Student Aggregate
- `validateCreateStudent(db, userId, studentNumber, departmentId, status)` - Validates all invariants for creating a student
- `validateUpdateStudent(db, studentId, status?, departmentId?)` - Validates all invariants for updating a student
- `validateStudentCanEnroll(db, studentId)` - Validates student can enroll (status must be "active")
- `validateStudentNumberUniqueness(db, studentNumber, excludeId?)` - Validates student number uniqueness
- `validateUserAssociation(db, userId)` - Validates user exists
- `validateDepartmentAssociation(db, departmentId)` - Validates department exists
- `validateStatusTransition(currentStatus, newStatus)` - Validates status transition is allowed
- `validateCanEnroll(student)` - Validates student status allows enrollment operations
- `validateStudentStatus(status)` - Validates status is from allowed set: "active", "suspended", "graduated", "inactive"

### Enrollment Aggregate
- `validateCreateEnrollment(db, studentId, sectionId, termId, status)` - Validates all invariants for creating an enrollment
- `validateUpdateEnrollment(db, enrollmentId, newStatus?, requireAppeal?)` - Validates all invariants for updating an enrollment
- `validateUniqueEnrollment(db, studentId, sectionId, excludeId?)` - Validates student is not already enrolled in the same section
- `validateEnrollmentReferences(db, studentId, sectionId)` - Validates student and section references exist
- `validateTermConsistency(db, sectionId, termId)` - Validates enrollment term matches section term
- `validateEnrollmentStatus(status)` - Validates enrollment status is from allowed set: "enrolled", "active", "waitlisted", "dropped", "completed", "failed", "withdrawn", "pending"
- `validateStatusChange(db, enrollment, newStatus, requireAppeal?)` - Validates enrollment status can be changed (checks for final grade)
- `hasFinalGrade(db, enrollmentId)` - Checks if enrollment has any grades recorded

### User Aggregate
- `validateCreateUser(db, username, hashedPassword, roles, profile)`
- `validateUpdateUser(db, userId, username?, hashedPassword?, roles?, profile?)`
- `validatePasswordChange(newHashedPassword)`
- `validateEmailUniqueness(db, email, excludeId?)` - Validates email uniqueness (note: uses email, not username)
- `validatePasswordIsHashed(hashedPassword)`
- `validateRoles(roles)` - Validates roles are from allowed set
- `validateProfile(profile)` - Validates profile structure
- `validateRoleConsistency(db, userId, roles)` - Validates role consistency with user's other records

### Transcript Aggregate
- `validateCreateTranscript(db, studentId, entries, gpa, metadata?)` - Validates all invariants for creating a transcript
- `validateAddTranscriptEntry(db, transcriptId, newEntry)` - Validates all invariants for adding an entry to a transcript
- `recalculateAndValidateGPA(db, transcriptId)` - Recalculates and validates GPA matches entries, returns calculated GPA
- `calculateGPA(entries)` - Calculates GPA from transcript entries using formula: Σ(grade.points × credits) / Σ(credits)
- `validateGPA(transcript)` - Validates stored GPA matches calculated value from entries (0.01 tolerance)
- `validateTranscriptEntry(entry)` - Validates transcript entry structure (courseCode, credits > 0, grade.points 0-4)
- `validateTranscriptStudent(db, studentId)` - Validates student exists
- `validateMetadata(db, metadata?)` - Validates transcript metadata (generatedBy user exists, generatedAt is valid)

### Academic Calendar Aggregate
- `validateCreateAcademicSession(db, yearLabel, startDate, endDate)` - Validates all invariants for creating an academic session
- `validateUpdateAcademicSession(db, sessionId, yearLabel?, startDate?, endDate?)` - Validates all invariants for updating an academic session
- `validateCreateTerm(db, sessionId, name, startDate, endDate)` - Validates all invariants for creating a term
- `validateUpdateTerm(db, termId, startDate?, endDate?)` - Validates all invariants for updating a term
- `validateSessionYearLabelUniqueness(db, yearLabel, excludeId?)` - Validates session year label uniqueness
- `validateTermSession(db, sessionId)` - Validates term belongs to session
- `validateTermDates(startDate, endDate)` - Validates term dates (startDate < endDate)
- `validateNoOverlappingTerms(db, sessionId, termStartDate, termEndDate, excludeTermId?)` - Validates no overlapping terms in same session

### Graduation Aggregate
- `validateCreateGraduation(db, studentId, approvedBy, date, checkRequirements?)` - Validates all invariants for creating a graduation record
- `validateUpdateGraduation(db, graduationId, approvedBy?, date?)` - Validates all invariants for updating a graduation record
- `validateApproverAuthority(db, approverId)` - Validates approver has required role (only "registrar")
- `validateGraduationStudent(db, studentId)` - Validates student exists and returns student record
- `validateGraduationDate(date)` - Validates graduation date is valid timestamp
- `validateGraduationRequirements(db, studentId)` - Validates all graduation requirements are met (GPA ≥ 2.0, credits ≥ 120, no incomplete enrollments)
- `validateNoDuplicateGraduation(db, studentId, excludeId?)` - Validates no duplicate graduation records

## Error Types

### InvariantViolationError
Thrown when a business rule (invariant) is violated.

```typescript
throw new InvariantViolationError(
  "StudentAggregate",
  "Status-Based Operation Control",
  "Student with status 'suspended' cannot enroll in courses"
);
```

### NotFoundError
Thrown when a referenced entity doesn't exist.

```typescript
throw new NotFoundError("Student", studentId);
```

### ValidationError
Thrown when input validation fails.

```typescript
throw new ValidationError("email", "Invalid email format");
```

## Best Practices

1. **Always validate before mutations**: Call validation functions at the start of mutation handlers.

2. **Use transactions**: All validation and creation should happen in the same transaction (Convex mutations are atomic by default).

3. **Handle errors appropriately**: Catch domain errors and return user-friendly messages.

4. **Validate cross-aggregate references**: When creating entities that reference other aggregates, validate those references exist.

5. **Check invariants on updates**: When updating entities, validate that the update doesn't violate invariants.

6. **Use helper functions**: For complex validations, use the provided helper functions rather than duplicating logic.

## Testing

Each validation function should have corresponding unit tests. Example test structure:

```typescript
import { describe, it, expect } from "vitest";
import { validateCreateStudent } from "../lib/aggregates";

describe("StudentAggregate", () => {
  it("should validate student creation", async () => {
    // Test implementation
  });
  
  it("should reject duplicate student numbers", async () => {
    // Test implementation
  });
});
```

## Related Documentation

- [Aggregate Roots and Invariants](./aggregates_and_invariants.md)
- [Domain Services](./domain_services.md)
- [Transactional Mutations](./transactional_mutations.md)

