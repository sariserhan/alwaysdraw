/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as abuse from "../abuse.js";
import type * as bookmarks from "../bookmarks.js";
import type * as canvas from "../canvas.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as presence from "../presence.js";
import type * as snapshots from "../snapshots.js";
import type * as strokes from "../strokes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  abuse: typeof abuse;
  bookmarks: typeof bookmarks;
  canvas: typeof canvas;
  constants: typeof constants;
  crons: typeof crons;
  presence: typeof presence;
  snapshots: typeof snapshots;
  strokes: typeof strokes;
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
