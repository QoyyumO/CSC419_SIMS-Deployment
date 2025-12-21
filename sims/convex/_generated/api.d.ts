/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as examples_studentMutations from "../examples/studentMutations.js";
import type * as lib_aggregates_academicCalendarAggregate from "../lib/aggregates/academicCalendarAggregate.js";
import type * as lib_aggregates_courseAggregate from "../lib/aggregates/courseAggregate.js";
import type * as lib_aggregates_enrollmentAggregate from "../lib/aggregates/enrollmentAggregate.js";
import type * as lib_aggregates_graduationAggregate from "../lib/aggregates/graduationAggregate.js";
import type * as lib_aggregates_index from "../lib/aggregates/index.js";
import type * as lib_aggregates_programAggregate from "../lib/aggregates/programAggregate.js";
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
import type * as lib_services_schedulingService from "../lib/services/schedulingService.js";
import type * as lib_services_transcriptService from "../lib/services/transcriptService.js";
import type * as lib_session from "../lib/session.js";
import type * as mutations_assessmentMutations from "../mutations/assessmentMutations.js";
import type * as mutations_courseMutations from "../mutations/courseMutations.js";
import type * as mutations_enrollmentMutations from "../mutations/enrollmentMutations.js";
import type * as mutations_gradeMutations from "../mutations/gradeMutations.js";
import type * as mutations_graduationMutations from "../mutations/graduationMutations.js";
import type * as mutations_programMutations from "../mutations/programMutations.js";
import type * as mutations_sectionMutations from "../mutations/sectionMutations.js";
import type * as mutations_transcriptMutations from "../mutations/transcriptMutations.js";
import type * as mutations_userMutations from "../mutations/userMutations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "examples/studentMutations": typeof examples_studentMutations;
  "lib/aggregates/academicCalendarAggregate": typeof lib_aggregates_academicCalendarAggregate;
  "lib/aggregates/courseAggregate": typeof lib_aggregates_courseAggregate;
  "lib/aggregates/enrollmentAggregate": typeof lib_aggregates_enrollmentAggregate;
  "lib/aggregates/graduationAggregate": typeof lib_aggregates_graduationAggregate;
  "lib/aggregates/index": typeof lib_aggregates_index;
  "lib/aggregates/programAggregate": typeof lib_aggregates_programAggregate;
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
  "lib/services/schedulingService": typeof lib_services_schedulingService;
  "lib/services/transcriptService": typeof lib_services_transcriptService;
  "lib/session": typeof lib_session;
  "mutations/assessmentMutations": typeof mutations_assessmentMutations;
  "mutations/courseMutations": typeof mutations_courseMutations;
  "mutations/enrollmentMutations": typeof mutations_enrollmentMutations;
  "mutations/gradeMutations": typeof mutations_gradeMutations;
  "mutations/graduationMutations": typeof mutations_graduationMutations;
  "mutations/programMutations": typeof mutations_programMutations;
  "mutations/sectionMutations": typeof mutations_sectionMutations;
  "mutations/transcriptMutations": typeof mutations_transcriptMutations;
  "mutations/userMutations": typeof mutations_userMutations;
  users: typeof users;
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
