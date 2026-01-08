/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cron from "../cron.js";
import type * as examples_studentMutations from "../examples/studentMutations.js";
import type * as functions_academicSessions from "../functions/academicSessions.js";
import type * as functions_alumni from "../functions/alumni.js";
import type * as functions_assessments from "../functions/assessments.js";
import type * as functions_auth from "../functions/auth.js";
import type * as functions_courses from "../functions/courses.js";
import type * as functions_cron from "../functions/cron.js";
import type * as functions_dashboard from "../functions/dashboard.js";
import type * as functions_department from "../functions/department.js";
import type * as functions_departments from "../functions/departments.js";
import type * as functions_enrollments from "../functions/enrollments.js";
import type * as functions_grades from "../functions/grades.js";
import type * as functions_instructors from "../functions/instructors.js";
import type * as functions_notifications from "../functions/notifications.js";
import type * as functions_programs from "../functions/programs.js";
import type * as functions_registrar from "../functions/registrar.js";
import type * as functions_schools from "../functions/schools.js";
import type * as functions_transcript from "../functions/transcript.js";
import type * as functions_users from "../functions/users.js";
import type * as lib_aggregates_academicCalendarAggregate from "../lib/aggregates/academicCalendarAggregate.js";
import type * as lib_aggregates_courseAggregate from "../lib/aggregates/courseAggregate.js";
import type * as lib_aggregates_enrollmentAggregate from "../lib/aggregates/enrollmentAggregate.js";
import type * as lib_aggregates_graduationAggregate from "../lib/aggregates/graduationAggregate.js";
import type * as lib_aggregates_index from "../lib/aggregates/index.js";
import type * as lib_aggregates_schoolAggregate from "../lib/aggregates/schoolAggregate.js";
import type * as lib_aggregates_sectionAggregate from "../lib/aggregates/sectionAggregate.js";
import type * as lib_aggregates_studentAggregate from "../lib/aggregates/studentAggregate.js";
import type * as lib_aggregates_transcriptAggregate from "../lib/aggregates/transcriptAggregate.js";
import type * as lib_aggregates_types from "../lib/aggregates/types.js";
import type * as lib_aggregates_userAggregate from "../lib/aggregates/userAggregate.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_services_auditLogService from "../lib/services/auditLogService.js";
import type * as lib_services_enrollmentService from "../lib/services/enrollmentService.js";
import type * as lib_services_gradingService from "../lib/services/gradingService.js";
import type * as lib_services_graduationService from "../lib/services/graduationService.js";
import type * as lib_services_index from "../lib/services/index.js";
import type * as lib_services_notificationService from "../lib/services/notificationService.js";
import type * as lib_services_schedulingService from "../lib/services/schedulingService.js";
import type * as lib_services_sectionService from "../lib/services/sectionService.js";
import type * as lib_services_transcriptService from "../lib/services/transcriptService.js";
import type * as lib_session from "../lib/session.js";
import type * as mutations_assessmentMutations from "../mutations/assessmentMutations.js";
import type * as mutations_courseMutations from "../mutations/courseMutations.js";
import type * as mutations_enrollmentMutations from "../mutations/enrollmentMutations.js";
import type * as mutations_gradeMutations from "../mutations/gradeMutations.js";
import type * as mutations_graduationMutations from "../mutations/graduationMutations.js";
import type * as mutations_sectionMutations from "../mutations/sectionMutations.js";
import type * as mutations_transcriptMutations from "../mutations/transcriptMutations.js";
import type * as mutations_userMutations from "../mutations/userMutations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cron: typeof cron;
  "examples/studentMutations": typeof examples_studentMutations;
  "functions/academicSessions": typeof functions_academicSessions;
  "functions/alumni": typeof functions_alumni;
  "functions/assessments": typeof functions_assessments;
  "functions/auth": typeof functions_auth;
  "functions/courses": typeof functions_courses;
  "functions/cron": typeof functions_cron;
  "functions/dashboard": typeof functions_dashboard;
  "functions/department": typeof functions_department;
  "functions/departments": typeof functions_departments;
  "functions/enrollments": typeof functions_enrollments;
  "functions/grades": typeof functions_grades;
  "functions/instructors": typeof functions_instructors;
  "functions/notifications": typeof functions_notifications;
  "functions/programs": typeof functions_programs;
  "functions/registrar": typeof functions_registrar;
  "functions/schools": typeof functions_schools;
  "functions/transcript": typeof functions_transcript;
  "functions/users": typeof functions_users;
  "lib/aggregates/academicCalendarAggregate": typeof lib_aggregates_academicCalendarAggregate;
  "lib/aggregates/courseAggregate": typeof lib_aggregates_courseAggregate;
  "lib/aggregates/enrollmentAggregate": typeof lib_aggregates_enrollmentAggregate;
  "lib/aggregates/graduationAggregate": typeof lib_aggregates_graduationAggregate;
  "lib/aggregates/index": typeof lib_aggregates_index;
  "lib/aggregates/schoolAggregate": typeof lib_aggregates_schoolAggregate;
  "lib/aggregates/sectionAggregate": typeof lib_aggregates_sectionAggregate;
  "lib/aggregates/studentAggregate": typeof lib_aggregates_studentAggregate;
  "lib/aggregates/transcriptAggregate": typeof lib_aggregates_transcriptAggregate;
  "lib/aggregates/types": typeof lib_aggregates_types;
  "lib/aggregates/userAggregate": typeof lib_aggregates_userAggregate;
  "lib/errors": typeof lib_errors;
  "lib/services/auditLogService": typeof lib_services_auditLogService;
  "lib/services/enrollmentService": typeof lib_services_enrollmentService;
  "lib/services/gradingService": typeof lib_services_gradingService;
  "lib/services/graduationService": typeof lib_services_graduationService;
  "lib/services/index": typeof lib_services_index;
  "lib/services/notificationService": typeof lib_services_notificationService;
  "lib/services/schedulingService": typeof lib_services_schedulingService;
  "lib/services/sectionService": typeof lib_services_sectionService;
  "lib/services/transcriptService": typeof lib_services_transcriptService;
  "lib/session": typeof lib_session;
  "mutations/assessmentMutations": typeof mutations_assessmentMutations;
  "mutations/courseMutations": typeof mutations_courseMutations;
  "mutations/enrollmentMutations": typeof mutations_enrollmentMutations;
  "mutations/gradeMutations": typeof mutations_gradeMutations;
  "mutations/graduationMutations": typeof mutations_graduationMutations;
  "mutations/sectionMutations": typeof mutations_sectionMutations;
  "mutations/transcriptMutations": typeof mutations_transcriptMutations;
  "mutations/userMutations": typeof mutations_userMutations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
