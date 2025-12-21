/**
 * Session Management Utilities
 * 
 * Provides secure session token generation, validation, and management.
 * Sessions use cryptographically secure random tokens with expiration.
 */

import { DatabaseWriter, DatabaseReader } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Generate a cryptographically secure random token
 * Uses Web Crypto API to generate a secure random token
 */
export function generateSessionToken(): string {
  // Generate 32 random bytes (256 bits) and convert to hex
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return token;
}

/**
 * Session expiration time: 5 hours in milliseconds
 */
const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

/**
 * Create a new session for a user
 * 
 * @param db Database writer
 * @param userId User ID to create session for
 * @returns Session token
 */
export async function createSession(
  db: DatabaseWriter,
  userId: Id<"users">
): Promise<string> {
  const token = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;

  await db.insert("sessions", {
    userId,
    token,
    expiresAt,
    createdAt: now,
  });

  return token;
}

/**
 * Validate a session token and return the user ID if valid
 * 
 * @param db Database reader
 * @param token Session token to validate
 * @returns User ID if token is valid, null otherwise
 */
export async function validateSessionToken(
  db: DatabaseReader,
  token: string
): Promise<Id<"users"> | null> {
  // Find session by token
  const session = await db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();

  if (!session) {
    return null;
  }

  // Check if session has expired
  const now = Date.now();
  if (session.expiresAt < now) {
    // Session expired - return null (cleanup will happen separately)
    return null;
  }

  return session.userId;
}

/**
 * Delete a session by token
 * 
 * @param db Database writer
 * @param token Session token to delete
 */
export async function deleteSessionByToken(
  db: DatabaseWriter,
  token: string
): Promise<void> {
  const session = await db
    .query("sessions")
    .withIndex("by_token", (q: any) => q.eq("token", token))
    .first();

  if (session) {
    await db.delete(session._id);
  }
}

/**
 * Delete all sessions for a user
 * Useful for logout or security purposes
 * 
 * @param db Database writer
 * @param userId User ID to delete all sessions for
 */
export async function deleteAllUserSessions(
  db: DatabaseWriter,
  userId: Id<"users">
): Promise<void> {
  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    await db.delete(session._id);
  }
}

/**
 * Clean up expired sessions
 * This can be called periodically to remove expired sessions from the database
 * 
 * @param db Database writer
 */
export async function cleanupExpiredSessions(
  db: DatabaseWriter
): Promise<number> {
  const now = Date.now();
  const expiredSessions = await db
    .query("sessions")
    .withIndex("by_expiresAt", (q: any) => q.lt("expiresAt", now))
    .collect();

  let deleted = 0;
  for (const session of expiredSessions) {
    await db.delete(session._id);
    deleted++;
  }

  return deleted;
}

