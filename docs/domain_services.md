# Domain Services

This directory contains stateless domain services that coordinate complex business logic across multiple aggregates.

## Overview

Domain Services are stateless services that orchestrate operations spanning multiple aggregates. They encapsulate complex domain logic that doesn't naturally fit within a single aggregate boundary.

## Available Services

### EnrollmentService

**Purpose:** Orchestrates enrollment transactions, validates prerequisites, checks schedule conflicts, and enforces add/drop deadlines.

**Key Functions:**
- `checkPrerequisites(db, studentId, courseId)` - Validates student has completed all course prerequisites
- `checkScheduleConflicts(db, studentId, sectionId)` - Detects schedule conflicts with existing enrollments
- `validateEnrollmentDomainChecks(db, studentId, sectionId)` - Performs all enrollment domain checks

**Usage:**
```typescript
import { validateEnrollmentDomainChecks } from "../convex/lib/services/enrollmentService";

// In a mutation
await validateEnrollmentDomainChecks(ctx.db, studentId, sectionId);
```

### GradingService

**Purpose:** Computes final course grades from assessment scores, converts numeric scores to letter grades, and manages grade appeal workflows.

**Key Functions:**
- `convertScoreToGrade(score, maxScore)` - Converts numeric score to letter grade and points
- `computeFinalGrade(db, enrollmentId)` - Calculates weighted final grade from all assessments
- `validateGradeAppeal(db, gradeId, studentId)` - Validates a grade can be appealed
- `processGradeAppeal(db, appeal, reviewerId, approved, reviewNotes)` - Processes grade appeals

**Usage:**
```typescript
import { computeFinalGrade } from "../convex/lib/services/gradingService";

const { finalGrade, finalPercentage } = await computeFinalGrade(ctx.db, enrollmentId);
```

### GraduationService

**Purpose:** Evaluates a student's eligibility for graduation by running a degree audit against their program's requirements.

**Key Functions:**
- `runDegreeAudit(db, studentId)` - Comprehensive degree audit checking all requirements
- `validateProgramRequirements(db, studentId)` - Validates all program requirements are met

**Usage:**
```typescript
import { runDegreeAudit } from "../convex/lib/services/graduationService";

const auditResult = await runDegreeAudit(ctx.db, studentId);
if (auditResult.eligible) {
  // Process graduation
}
```

### SchedulingService

**Purpose:** Assigns rooms and times for sections, detecting and avoiding instructor and room conflicts.

**Key Functions:**
- `checkInstructorConflicts(db, instructorId, termId, scheduleSlots, excludeSectionId?)` - Checks for instructor schedule conflicts
- `checkRoomConflicts(db, termId, scheduleSlots, excludeSectionId?)` - Checks for room schedule conflicts
- `validateScheduleAssignment(db, instructorId, termId, scheduleSlots, excludeSectionId?)` - Validates schedule assignment (both instructor and room)
- `findAvailableRooms(db, termId, day, startTime, endTime)` - Finds available rooms for a time slot

**Usage:**
```typescript
import { validateScheduleAssignment } from "../convex/lib/services/schedulingService";

await validateScheduleAssignment(
  ctx.db,
  instructorId,
  termId,
  scheduleSlots
);
```

### TranscriptService

**Purpose:** Generates official transcripts, snapshots grades at a point in time, and computes cumulative GPA.

**Key Functions:**
- `calculateCumulativeGPA(entries)` - Calculates GPA from transcript entries
- `createTranscriptEntry(db, enrollmentId, term, year)` - Creates a transcript entry from completed enrollment
- `generateOfficialTranscript(db, studentId, generatedBy, format)` - Generates official transcript with metadata
- `addEnrollmentToTranscript(db, transcriptId, enrollmentId, term, year)` - Adds completed enrollment to transcript
- `snapshotGradesForTranscript(entries)` - Creates immutable snapshot of grades

**Usage:**
```typescript
import { generateOfficialTranscript } from "../convex/lib/services/transcriptService";

const transcript = await generateOfficialTranscript(
  ctx.db,
  studentId,
  userId,
  "pdf"
);
```

### AuditLogService

**Purpose:** Creates audit log entries for system events to ensure traceability.

**Key Functions:**
- `createAuditLog(db, entity, action, userId, entityId?, details?)` - Generic audit log creation
- `logStudentEnrolled(...)` - Logs student enrollment
- `logStudentDropped(...)` - Logs student drop
- `logCourseGradePosted(...)` - Logs grade posting
- `logGradeEdited(...)` - Logs grade edits with previous/new values
- `logGraduationApproved(...)` - Logs graduation approval
- `logSectionCancelled(...)` - Logs section cancellation
- `logUserRoleChanged(...)` - Logs user role changes

**Required Events:**
All significant domain events are logged:
- ✅ StudentEnrolled
- ✅ StudentDropped
- ✅ CourseGradePosted
- ✅ GradeEdited
- ✅ GraduationApproved
- ✅ SectionCancelled
- ✅ UserRoleChanged

**Usage:**
```typescript
import { logStudentEnrolled } from "../convex/lib/services/auditLogService";

await logStudentEnrolled(
  ctx.db,
  userId,
  enrollmentId,
  { studentId, sectionId, courseId }
);
```

## Service Design Principles

1. **Stateless:** Services don't maintain state between calls
2. **Pure Domain Logic:** Services contain business logic, not infrastructure concerns
3. **Aggregate Coordination:** Services coordinate operations across multiple aggregates
4. **Reusable:** Services can be used by multiple mutations/queries
5. **Testable:** Services are easily testable in isolation

## Error Handling

All services throw domain-specific errors:
- `InvariantViolationError` - Business rule violations
- `NotFoundError` - Missing entities
- `ValidationError` - Input validation failures

## Testing

Each service should have comprehensive unit tests covering:
- Happy path scenarios
- Error conditions
- Edge cases
- Boundary conditions

## Related Documentation

- [Aggregate Roots and Invariants](./aggregates_and_invariants.md)
- [Transactional Mutations](./transactional_mutations.md)

