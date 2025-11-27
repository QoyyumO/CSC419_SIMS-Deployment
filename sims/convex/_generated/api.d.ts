/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

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

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
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
