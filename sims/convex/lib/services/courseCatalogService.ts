/**
 * Course Catalog Service
 *
 * Domain logic for managing versioned course definitions, prerequisite graphs,
 * and offering templates. This file provides a service object with method
 * stubs to be implemented.
 */

import { DatabaseReader, DatabaseWriter } from "../../_generated/server";
import { Id, Doc } from "../../_generated/dataModel";
import { NotFoundError } from "../errors";

export type CourseVersionPayload = {
  version: number;
  title: string;
  description: string;
  credits: number;
  prerequisites: string[]; // course codes
  isActive: boolean;
};

export const courseCatalogService = {
  async createCourseVersion(
    db: DatabaseWriter,
    courseId: Id<"courses">,
    payload: CourseVersionPayload
  ): Promise<Id<"courseVersions">> {
    const course = await db.get(courseId);
    if (!course) {
      throw new NotFoundError("Course", courseId as unknown as string);
    }

    // Determine next version number
    const existing = await db
      .query("courseVersions")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    let maxVersion = 0;
    for (const v of existing) {
      if (typeof v.version === "number" && v.version > maxVersion) {
        maxVersion = v.version;
      }
    }
    const nextVersion = maxVersion + 1;

    // Deactivate any currently active versions
    const activeVersions = existing.filter((v) => v.isActive);
    for (const av of activeVersions) {
      await db.patch(av._id, { isActive: false });
    }

    const createdAt = Date.now();
    const newId = await db.insert("courseVersions", {
      courseId,
      version: nextVersion,
      title: payload.title,
      description: payload.description,
      credits: payload.credits,
      prerequisites: payload.prerequisites || [],
      isActive: true,
      createdAt,
    });

    return newId;
  },

  async getCourseVersions(
    db: DatabaseReader,
    courseId: Id<"courses">
  ): Promise<Doc<"courseVersions">[]> {
    const versions = await db
      .query("courseVersions")
      .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
      .collect();

    // Return sorted by version ascending
    return versions.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
  },

  async getCurrentCourseVersion(
    db: DatabaseReader,
    courseId: Id<"courses">
  ): Promise<Doc<"courseVersions"> | null> {
    // Try compound index first
    let current = await db
      .query("courseVersions")
      .withIndex("by_courseId_isActive", (q) => q.eq("courseId", courseId).eq("isActive", true))
      .first();

    if (!current) {
      // Fallback: scan versions for active flag
      const versions = await db
        .query("courseVersions")
        .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
        .collect();
      current = versions.find((v) => v.isActive) || null;
    }

    return current || null;
  },

  async archiveCourseVersion(
    db: DatabaseWriter,
    courseVersionId: Id<"courseVersions">
  ): Promise<void> {
    const cv = await db.get(courseVersionId);
    if (!cv) {
      throw new NotFoundError("CourseVersion", courseVersionId as unknown as string);
    }

    if (!cv.isActive) {
      return; // already archived
    }

    await db.patch(courseVersionId, { isActive: false });
  },

  async getPrerequisitesGraph(
    db: DatabaseReader,
    courseId: Id<"courses">
  ): Promise<Record<string, string[]>> {
    const course = await db.get(courseId);
    if (!course) {
      throw new NotFoundError("Course", courseId as unknown as string);
    }

    const startCode: string = course.code;

    // adjacency map from course code -> array of prerequisite course codes
    const adjacency = new Map<string, string[]>();

    // visited set to avoid re-processing nodes
    const visited = new Set<string>();

    // recursion stack to detect cycles
    const stack = new Set<string>();

    const MAX_DEPTH = 50;

    async function resolve(code: string, depth = 0): Promise<void> {
      if (visited.has(code)) return;
      if (depth > MAX_DEPTH) {
        // stop deep recursion to avoid DoS
        adjacency.set(code, adjacency.get(code) ?? []);
        visited.add(code);
        return;
      }

      if (stack.has(code)) {
        // cycle detected; record node and stop deeper recursion
        adjacency.set(code, adjacency.get(code) ?? []);
        visited.add(code);
        return;
      }

      stack.add(code);

      // Try to resolve course by code
      const c = await db
        .query("courses")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();

      const prereqs: string[] = c && Array.isArray(c.prerequisites) ? c.prerequisites : [];

      adjacency.set(code, prereqs);

      for (const p of prereqs) {
        await resolve(p, depth + 1);
      }

      stack.delete(code);
      visited.add(code);
    }

    await resolve(startCode);

    // convert adjacency map to plain object for frontend
    const result: Record<string, string[]> = {};
    for (const [k, v] of adjacency.entries()) {
      result[k] = v;
    }

    return result;
  },

  async validatePrerequisiteChain(
    db: DatabaseReader,
    courseId: Id<"courses">,
    maxDepth: number = 50
  ): Promise<{ valid: true } | { valid: false; cycle?: string[]; reason?: string }> {
    const course = await db.get(courseId);
    if (!course) {
      throw new NotFoundError("Course", courseId as unknown as string);
    }

    const startCode: string = course.code;

    // Build adjacency using the existing graph builder
    const adjacency = await courseCatalogService.getPrerequisitesGraph(db, courseId);

    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    let foundCycle: string[] | null = null;
    let reason: string | undefined;

    function dfs(node: string, depth = 0): boolean {
      if (depth > maxDepth) {
        reason = `Exceeded max depth (${maxDepth}) starting from ${startCode}`;
        return true; // stop traversal
      }

      if (stack.has(node)) {
        // cycle detected; extract offending chain from path
        const idx = path.indexOf(node);
        if (idx >= 0) {
          foundCycle = path.slice(idx).concat(node);
        } else {
          foundCycle = [node, node];
        }
        return true;
      }

      if (visited.has(node)) return false;

      visited.add(node);
      stack.add(node);
      path.push(node);

      const neighbors = adjacency[node] || [];
      for (const n of neighbors) {
        if (dfs(n, depth + 1)) return true;
      }

      stack.delete(node);
      path.pop();
      return false;
    }

    // Start DFS from the requested course code
    dfs(startCode);

    if (foundCycle) {
      return { valid: false, cycle: foundCycle };
    }

    if (reason) {
      return { valid: false, reason };
    }

    return { valid: true };
  },

  async getOfferingTemplates(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _db: DatabaseReader,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _courseId: Id<"courses">
  ): Promise<unknown[]> {
    // TODO: return offering templates derived from current course version
    throw new Error("Not implemented: getOfferingTemplates");
  },

  async getDependentCourses(
    db: DatabaseReader,
    courseId: Id<"courses">,
    candidateCode?: string
  ): Promise<Array<{ _id: string; code: string; title: string; matched: string[] }>> {
    const course = await db.get(courseId);
    if (!course) {
      throw new NotFoundError("Course", courseId as unknown as string);
    }

    const targetCode = (candidateCode && candidateCode.trim()) || course.code;

    const allCourses = await db.query("courses").collect();

    const dependents = allCourses
      .filter((c) => c._id !== courseId && Array.isArray(c.prerequisites))
      .map((c) => {
        const matched = c.prerequisites.filter(
          (p: string) => p.trim().toLowerCase() === targetCode.trim().toLowerCase()
        );
        return { _id: c._id, code: c.code, title: c.title, matched };
      })
      .filter((c) => c.matched.length > 0);

    return dependents;
  },
};
