/**
 * Type definitions for Aggregate entities
 * 
 * These types represent the domain models for each aggregate root.
 * They should match the schema definitions but provide additional
 * type safety for business logic.
 */

import { Id } from "../../_generated/dataModel";

// ============================================================================
// School Aggregate Types
// ============================================================================

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Contact {
  email: string;
  phone: string;
}

export interface School {
  _id: Id<"schools">;
  name: string;
  address: Address;
  contact: Contact;
}

// ============================================================================
// Program Aggregate Types (REMOVED - Programs no longer exist)
// ============================================================================
// Programs have been removed from the schema. Students now belong directly to departments.

// ============================================================================
// Course Aggregate Types
// ============================================================================

export interface Course {
  _id: Id<"courses">;
  code: string;
  title: string;
  description: string;
  credits: number;
  prerequisites: string[]; // Course codes instead of IDs
}

// ============================================================================
// Section Aggregate Types
// ============================================================================

export interface ScheduleSlotSpec {
  day: string; // e.g., "Mon", "Tue", "Wed"
  startTime: string;
  endTime: string;
  room: string;
}

export interface Section {
  _id: Id<"sections">;
  courseId: Id<"courses">;
  sessionId: Id<"academicSessions">;
  termId: Id<"terms">;
  instructorId: Id<"users">;
  capacity: number;
  scheduleSlots: ScheduleSlotSpec[];
  enrollmentCount: number;
}

export interface Assessment {
  _id: Id<"assessments">;
  sectionId: Id<"sections">;
  title: string;
  weight: number;
  maxScore: number;
}

// ============================================================================
// Student Aggregate Types
// ============================================================================

export type StudentStatus = "active" | "suspended" | "graduated" | "inactive";

export interface Student {
  _id: Id<"students">;
  userId: Id<"users">;
  studentNumber: string;
  admissionYear: number;
  departmentId: Id<"departments">;
  level: string;
  status: StudentStatus;
}

// ============================================================================
// Enrollment Aggregate Types
// ============================================================================

export type EnrollmentStatus = 
  | "enrolled" 
  | "dropped" 
  | "completed" 
  | "failed" 
  | "withdrawn"
  | "pending";

export interface Enrollment {
  _id: Id<"enrollments">;
  studentId: Id<"students">;
  sectionId: Id<"sections">;
  sessionId: Id<"academicSessions">;
  termId: Id<"terms">;
  status: EnrollmentStatus;
  enrolledAt: number;
}

export interface GradeValue {
  numeric: number;
  letter: string;
  points: number;
}

export interface Grade {
  _id: Id<"grades">;
  enrollmentId: Id<"enrollments">;
  assessmentId: Id<"assessments">;
  grade: GradeValue;
  recordedBy: Id<"users">;
}

// ============================================================================
// User Aggregate Types
// ============================================================================

export type UserRole = 
  | "student" 
  | "instructor" 
  | "admin" 
  | "registrar" 
  | "department_head";

export interface FullName {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface User {
  _id: Id<"users">;
  email: string;
  hashedPassword: string;
  roles: UserRole[];
  profile: FullName;
}

// ============================================================================
// Transcript Aggregate Types
// ============================================================================

export interface TranscriptEntry {
  courseCode: string;
  courseTitle: string;
  credits: number;
  grade: GradeValue;
  term: string;
  year: number;
}

export interface ReportMetadata {
  generatedBy: Id<"users">;
  generatedAt: number;
  format: string;
}

export interface Transcript {
  _id: Id<"transcripts">;
  studentId: Id<"students">;
  entries: TranscriptEntry[];
  gpa: number;
  metadata?: ReportMetadata;
}

// ============================================================================
// Academic Calendar Aggregate Types
// ============================================================================

export interface Term {
  _id: Id<"terms">;
  sessionId: Id<"academicSessions">;
  name: string;
  startDate: number;
  endDate: number;
}

export interface AcademicSession {
  _id: Id<"academicSessions">;
  yearLabel: string;
  startDate: number;
  endDate: number;
  terms: Array<{
    id: string;
    name: string;
    startDate: number;
    endDate: number;
  }>;
}

// ============================================================================
// Graduation Aggregate Types
// ============================================================================

export interface GraduationRecord {
  _id: Id<"graduationRecords">;
  studentId: Id<"students">;
  approvedBy: Id<"users">;
  date: number;
}

