# Domain Services

This directory contains stateless domain services that coordinate complex business logic across multiple aggregates.

## Overview

Domain Services are stateless services that orchestrate operations spanning multiple aggregates. They encapsulate complex domain logic that doesn't naturally fit within a single aggregate boundary.

## Available Services

### EnrollmentService

**Purpose:** Orchestrates enrollment transactions, validates prerequisites, checks schedule conflicts, and enforces add/drop deadlines.

**Key Functions:**
- `checkPrerequisites(db, studentId, courseId)` - Validates student has completed all course prerequisites (checks past enrollments with status === 'completed' and passing grades). Throws error if prerequisites are missing.
- `checkScheduleConflicts(db, studentId, sectionId, excludeEnrollmentId?)` - Detects schedule conflicts with existing enrollments in the same term. Checks for overlapping schedule slots on the same day. Throws error if conflicts found.
- `checkEnrollmentDeadline(db)` - Checks if enrollment deadline has passed (reads from settings table with key "enrollmentDeadline", defaults to 30 days from now). Throws error if deadline passed.
- `validateEnrollmentDomainChecks(db, studentId, sectionId)` - Performs all enrollment domain checks (prerequisites and schedule conflicts). Combines prerequisite and schedule conflict checks.

**Usage:**
```typescript
import { validateEnrollmentDomainChecks } from "../convex/lib/services/enrollmentService";

// In a mutation
await validateEnrollmentDomainChecks(ctx.db, studentId, sectionId);
```

### GradingService

**Purpose:** Computes final course grades from assessment scores, converts numeric scores to letter grades, and manages grade appeal workflows.

**Key Functions:**
- `convertScoreToGrade(score, totalPoints)` - Converts numeric score to letter grade and points. Grade scale: A (≥90%, 4.0), B (≥80%, 3.0), C (≥70%, 2.0), D (≥60%, 1.0), F (<60%, 0.0). Returns GradeValue object with numeric, letter, and points.
- `computeFinalGrade(db, enrollmentId)` - Calculates weighted final grade from all assessments (validates weights sum to 100%). Returns finalGrade (GradeValue) and finalPercentage. Throws error if assessments missing or weights don't sum to 100%.
- `validateGradeAppeal(db, gradeId, studentId)` - Validates a grade can be appealed (checks grade belongs to student). Throws error if grade doesn't belong to student.
- `processGradeAppeal(db, appeal, reviewerId, approved, reviewNotes)` - Processes grade appeals (updates appeal status to "approved" or "rejected"). Note: Appeal storage is placeholder - requires separate collection in production.

**Usage:**
```typescript
import { computeFinalGrade } from "../convex/lib/services/gradingService";

const { finalGrade, finalPercentage } = await computeFinalGrade(ctx.db, enrollmentId);
```

### GraduationService

**Purpose:** Evaluates a student's eligibility for graduation by running a degree audit against their program's requirements.

**Key Functions:**
- `runDegreeAudit(db, studentId)` - Comprehensive degree audit checking all requirements. Checks: minimum credits (default: 120), minimum GPA (default: 2.0), and no incomplete enrollments. Returns DegreeAuditResult with eligibility status and missing requirements.
- `validateGraduationRequirements(db, studentId)` - Validates all program requirements are met (throws error if not eligible). Uses runDegreeAudit internally and throws InvariantViolationError if student is not eligible.

**Returns (DegreeAuditResult):**
```typescript
{
  eligible: boolean;
  missingRequirements: string[];
  totalCredits: number;
  requiredCredits: number; // Default: 120
  gpa: number;
  requiredGPA: number; // Default: 2.0
}
```

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
- `checkInstructorConflicts(db, instructorId, termId, scheduleSlots, excludeSectionId?)` - Checks for instructor schedule conflicts in the same term. Compares new schedule slots with existing sections taught by the instructor. Throws error if conflicts found.
- `checkRoomConflicts(db, termId, scheduleSlots, excludeSectionId?)` - Checks for room schedule conflicts in the same term. Checks if same room is used at overlapping times. Throws error if conflicts found.
- `validateScheduleAssignment(db, instructorId, termId, scheduleSlots, excludeSectionId?)` - Validates schedule assignment (both instructor and room, validates time ranges). Validates time ranges (startTime < endTime), checks instructor conflicts, and checks room conflicts.
- `findAvailableRooms(db, termId, day, startTime, endTime)` - Finds available rooms for a time slot. Currently returns empty array (placeholder - requires rooms collection implementation).

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

### SectionService

**Purpose:** Manages section enrollment status and deadline operations.

**Key Functions:**
- `checkAndUpdateEnrollmentStatus(db, sectionId)` - Checks if enrollment deadline has passed and updates `isOpenForEnrollment` to false if deadline passed. Returns boolean indicating if section is open for enrollment. Uses DatabaseWriter to update section.
- `isEnrollmentDeadlinePassed(db, sectionId)` - Read-only check if enrollment deadline has passed. Returns true if deadline exists and has passed, false otherwise.
- `updateExpiredEnrollmentDeadlines(db)` - Updates all sections with passed enrollment deadlines (can be called periodically or from cron). Returns count of sections updated. Uses DatabaseWriter to update sections.

**Usage:**
```typescript
import { checkAndUpdateEnrollmentStatus } from "../convex/lib/services/sectionService";

const isOpen = await checkAndUpdateEnrollmentStatus(ctx.db, sectionId);
```

### TranscriptService

**Purpose:** Generates official transcripts, snapshots grades at a point in time, and computes cumulative GPA.

**Key Functions:**
- `calculateCumulativeGPA(entries)` - Calculates GPA from transcript entries using formula: Σ(grade.points × credits) / Σ(credits). Returns GPA rounded to 2 decimal places. Returns 0 if no entries.
- `createTranscriptEntry(db, enrollmentId, term, year)` - Creates a transcript entry from completed enrollment. Validates enrollment status is "completed", calculates final grade from all assessments (weighted average), converts to GradeValue with letter grade and points. Returns TranscriptEntry object.
- `generateOfficialTranscript(db, studentId, generatedBy, format)` - Generates official transcript with metadata. Gets or creates transcript, recalculates GPA from current entries, updates metadata (generatedBy, generatedAt, format). Returns Transcript object. Uses DatabaseWriter to create/update transcript.
- `addEnrollmentToTranscript(db, transcriptId, enrollmentId, term, year)` - Adds completed enrollment to transcript and recalculates GPA. Removes duplicate entries (same courseCode, term, year) before adding. Updates transcript entries and GPA atomically. Uses DatabaseWriter to update transcript.
- `snapshotGradesForTranscript(entries)` - Creates immutable snapshot of grades (deep copy for immutability). Returns new array with deep-copied entries and grade objects.

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
- `createAuditLog(db, entity, action, userId, entityId?, details?)` - Generic audit log creation. Inserts into auditLogs collection with timestamp. Returns audit log ID.
- `logStudentEnrolled(db, userId, enrollmentId, details?)` - Logs student enrollment. Entity: "enrollment", Action: "StudentEnrolled".
- `logStudentDropped(db, userId, enrollmentId, details?)` - Logs student drop. Entity: "enrollment", Action: "StudentDropped".
- `logStudentCreated(db, userId, studentId, details?)` - Logs student creation. Entity: "student", Action: "StudentCreated".
- `logStudentUpdated(db, userId, studentId, previousStatus?, newStatus?, details?)` - Logs student updates. Entity: "student", Action: "StudentUpdated". Includes status changes if provided.
- `logCourseGradePosted(db, userId, gradeId, details?)` - Logs grade posting. Entity: "grade", Action: "CourseGradePosted".
- `logGradeEdited(db, userId, gradeId, previousGrade, newGrade, details?)` - Logs grade edits with previous/new values. Entity: "grade", Action: "GradeEdited". Includes previousGrade and newGrade in details.
- `logCourseCreated(db, userId, courseId, details?)` - Logs course creation. Entity: "course", Action: "CourseCreated".
- `logCourseUpdated(db, userId, courseId, details?)` - Logs course updates. Entity: "course", Action: "CourseUpdated".
- `logSectionCreated(db, userId, sectionId, details?)` - Logs section creation. Entity: "section", Action: "SectionCreated".
- `logSectionUpdated(db, userId, sectionId, previousCapacity?, newCapacity?, details?)` - Logs section updates. Entity: "section", Action: "SectionUpdated". Includes capacity changes if provided.
- `logSectionCancelled(db, userId, sectionId, details?)` - Logs section cancellation. Entity: "section", Action: "SectionCancelled".
- `logAssessmentCreated(db, userId, assessmentId, details?)` - Logs assessment creation. Entity: "assessment", Action: "AssessmentCreated".
- `logAssessmentUpdated(db, userId, assessmentId, details?)` - Logs assessment updates. Entity: "assessment", Action: "AssessmentUpdated".
- `logAssessmentDeleted(db, userId, assessmentId, details?)` - Logs assessment deletion. Entity: "assessment", Action: "AssessmentDeleted".
- `logGraduationApproved(db, userId, graduationId, details?)` - Logs graduation approval. Entity: "graduation", Action: "GraduationApproved".
- `logAlumniProfileCreated(db, userId, alumniProfileId, details?)` - Logs alumni profile creation. Entity: "alumniProfile", Action: "AlumniProfileCreated".
- `logAlumniProfileUpdated(db, userId, alumniProfileId, details?)` - Logs alumni profile updates. Entity: "alumniProfile", Action: "AlumniProfileUpdated".
- `logUserRoleChanged(db, userId, targetUserId, previousRoles, newRoles, details?)` - Logs user role changes. Entity: "user", Action: "UserRoleChanged". Includes previousRoles and newRoles in details.
- `logTranscriptGenerated(db, userId, transcriptId, details?)` - Logs transcript generation. Entity: "transcript", Action: "TranscriptGenerated".

**Required Events:**
All significant domain events are logged:
- ✅ StudentEnrolled
- ✅ StudentDropped
- ✅ StudentCreated
- ✅ StudentUpdated
- ✅ CourseGradePosted
- ✅ GradeEdited
- ✅ CourseCreated
- ✅ CourseUpdated
- ✅ SectionCreated
- ✅ SectionUpdated
- ✅ SectionCancelled
- ✅ AssessmentCreated
- ✅ AssessmentUpdated
- ✅ AssessmentDeleted
- ✅ GraduationApproved
- ✅ AlumniProfileCreated
- ✅ AlumniProfileUpdated
- ✅ UserRoleChanged
- ✅ TranscriptGenerated

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

### CourseCatalogService

**Purpose:** Manages versioned course definitions, prerequisite graphs, and course catalog operations.

**Key Functions:**
- `createCourseVersion(db, courseId, payload)` - Creates a new course version. Deactivates existing active versions, assigns next version number. Returns course version ID.
- `getCourseVersions(db, courseId)` - Gets all versions for a course, sorted by version ascending.
- `getCurrentCourseVersion(db, courseId)` - Gets the currently active version for a course. Returns null if no active version.
- `archiveCourseVersion(db, courseVersionId)` - Archives a course version by setting isActive to false.
- `getPrerequisitesGraph(db, courseId)` - Builds prerequisite graph starting from a course. Returns adjacency map (course code -> prerequisite codes). Detects cycles and limits depth to prevent DoS.
- `validatePrerequisiteChain(db, courseId, maxDepth?)` - Validates prerequisite chain for circular dependencies. Returns validation result with cycle information if invalid.
- `getDependentCourses(db, courseId, candidateCode?)` - Gets all courses that depend on the given course as a prerequisite. Returns list with matched prerequisite codes.
- `getOfferingTemplates(db, courseId)` - Placeholder for offering templates (not implemented).

---

## Related Documentation

- [Aggregate Roots and Invariants](./aggregates_and_invariants.md)
- [Transactional Mutations](./transactional_mutations.md)

