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
- `validateCreateCourse(db, code, credits, prerequisites)`
- `validateUpdateCourse(db, courseId, code?, credits?, prerequisites?)`
- `validateCourseCodeUniqueness(db, code, excludeId?)`
- `validateCoursePrerequisites(db, prerequisites)`
- `validateNoCircularPrerequisites(courseId, prerequisites)`
- `validateCreditValue(credits)`
- `getCoursesUsingAsPrerequisite(db, courseId)`

### Section Aggregate
- `validateCreateSection(db, courseId, termId, instructorId, capacity, scheduleSlots)`
- `validateUpdateSection(db, sectionId, capacity?, scheduleSlots?, instructorId?)`
- `validateSectionCanEnroll(db, sectionId)`
- `validateEnrollmentCapacity(enrollmentCount, capacity)`
- `validateCapacityUpdate(currentEnrollmentCount, newCapacity)`
- `validateAssessmentWeights(db, sectionId, excludeAssessmentId?)`
- `validateAssessmentWeight(db, sectionId, newWeight, excludeAssessmentId?)`
- `validateNoOverlappingSlots(slots)`
- `validateInstructorRole(db, instructorId)`

### Student Aggregate
- `validateCreateStudent(db, userId, studentNumber, programId, status)`
- `validateUpdateStudent(db, studentId, status?, programId?)`
- `validateStudentCanEnroll(db, studentId)`
- `validateStudentNumberUniqueness(db, studentNumber, excludeId?)`
- `validateUserAssociation(db, userId)`
- `validateProgramAssociation(db, programId)`
- `validateStatusTransition(currentStatus, newStatus)`
- `validateCanEnroll(student)`

### Enrollment Aggregate
- `validateCreateEnrollment(db, studentId, sectionId, termId, status)`
- `validateUpdateEnrollment(db, enrollmentId, newStatus?, requireAppeal?)`
- `validateUniqueEnrollment(db, studentId, sectionId, excludeId?)`
- `validateEnrollmentReferences(db, studentId, sectionId)`
- `validateTermConsistency(db, sectionId, termId)`
- `validateStatusChange(db, enrollment, newStatus, requireAppeal?)`
- `hasFinalGrade(db, enrollmentId)`

### User Aggregate
- `validateCreateUser(db, username, hashedPassword, roles, profile)`
- `validateUpdateUser(db, userId, username?, hashedPassword?, roles?, profile?)`
- `validatePasswordChange(newHashedPassword)`
- `validateUsernameUniqueness(db, username, excludeId?)`
- `validatePasswordIsHashed(hashedPassword)`
- `validateRoles(roles)`
- `validateProfile(profile)`
- `validateRoleConsistency(db, userId, roles)`

### Transcript Aggregate
- `validateCreateTranscript(db, studentId, entries, gpa, metadata?)`
- `validateAddTranscriptEntry(db, transcriptId, newEntry)`
- `recalculateAndValidateGPA(db, transcriptId)`
- `calculateGPA(entries)`
- `validateGPA(transcript)`
- `validateTranscriptEntry(entry)`
- `validateTranscriptStudent(db, studentId)`
- `validateMetadata(db, metadata?)`

### Academic Calendar Aggregate
- `validateCreateAcademicSession(db, label)`
- `validateUpdateAcademicSession(db, sessionId, label?)`
- `validateCreateTerm(db, sessionId, name, startDate, endDate)`
- `validateUpdateTerm(db, termId, startDate?, endDate?)`
- `validateSessionLabelUniqueness(db, label, excludeId?)`
- `validateTermSession(db, sessionId)`
- `validateTermDates(startDate, endDate)`
- `validateNoOverlappingTerms(db, sessionId, termStartDate, termEndDate, excludeTermId?)`

### Graduation Aggregate
- `validateCreateGraduation(db, studentId, approvedBy, date, checkRequirements?)`
- `validateUpdateGraduation(db, graduationId, approvedBy?, date?)`
- `validateApproverAuthority(db, approverId)`
- `validateGraduationStudent(db, studentId)`
- `validateGraduationDate(date)`
- `validateProgramRequirements(db, studentId)`
- `validateNoDuplicateGraduation(db, studentId, excludeId?)`

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

