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

**Example:**
```typescript
import { api } from "../_generated/api";
import { useMutation } from "convex/react";

const enrollStudent = useMutation(api.mutations.enrollmentMutations.enrollStudentInSection);

await enrollStudent({
  studentId: "...",
  sectionId: "..."
});
```

#### `dropEnrollment`

Drops a student from a section (withdrawal).

**Input:**
- `enrollmentId`: ID of the enrollment
- `userId`: ID of the user performing the action

**Transaction Steps:**
1. Validates enrollment exists and can be dropped
2. Updates enrollment status to "dropped"
3. Decrements section enrollment count
4. Creates audit log entry

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
2. Validates assessment belongs to section
3. Validates score ≤ maxScore
4. Calculates grade value (letter grade, points)
5. Creates or updates grade document
6. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  gradeId: Id<"grades">,
  gradeValue: {
    numeric: number,
    letter: string,
    points: number
  }
}
```

**Example:**
```typescript
const recordGrade = useMutation(api.mutations.gradeMutations.recordGrade);

await recordGrade({
  enrollmentId: "...",
  assessmentId: "...",
  score: 85,
  recordedByUserId: "..."
});
```

#### `recordFinalGrade`

Records final grade for an enrollment based on all assessments.

**Input:**
- `enrollmentId`: ID of the enrollment
- `recordedByUserId`: ID of the user recording the grade

**Transaction Steps:**
1. Retrieves all assessments for the section
2. Retrieves all grades for the enrollment
3. Calculates weighted final grade
4. Updates enrollment status to "completed"
5. Creates audit log entry

---

### Graduation Operations

#### `processStudentGraduation`

Processes a student's graduation with full degree audit.

**Input:**
- `studentId`: ID of the student
- `approverUserId`: ID of the user approving graduation

**Transaction Steps:**
1. Validates approver has authority
2. Runs degree audit (checks all program requirements)
3. Validates all requirements are satisfied
4. Updates student status to "graduated"
5. Creates graduation record
6. Creates audit log entry

**Returns:**
```typescript
{
  success: true,
  graduationId: Id<"graduationRecords">,
  studentId: Id<"students">,
  auditResult: {
    eligible: boolean,
    missingRequirements: string[],
    totalCredits: number,
    requiredCredits: number,
    gpa: number,
    requiredGPA: number
  }
}
```

**Example:**
```typescript
const processGraduation = useMutation(api.mutations.graduationMutations.processStudentGraduation);

await processGraduation({
  studentId: "...",
  approverUserId: "..."
});
```

#### `checkGraduationEligibility`

Checks if a student is eligible for graduation (read-only).

**Input:**
- `studentId`: ID of the student

**Returns:** Degree audit result with eligibility status

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

