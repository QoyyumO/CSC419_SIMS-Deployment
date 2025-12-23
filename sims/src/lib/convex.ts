/**
 * Convex Client Configuration
 * 
 * Sets up the Convex client for use in the Next.js application.
 * This file exports the Convex client instance and API types.
 */

import { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

// Get the Convex deployment URL from environment variables
// In development, this is typically set by `npx convex dev`
// In production, set NEXT_PUBLIC_CONVEX_URL in your environment
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL environment variable. " +
    "Please set it in your .env.local file. " +
    "Run `npx convex dev` to get the URL for development."
  );
}

// Create the Convex React client
export const convex = new ConvexReactClient(convexUrl);

// Export the API for type-safe function calls
export { api };

// Export types for use in components
export type { Id } from "../../convex/_generated/dataModel";

