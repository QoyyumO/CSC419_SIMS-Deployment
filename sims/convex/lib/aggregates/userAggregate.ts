/**
 * UserAggregate Invariant Validation
 * 
 * Enforces invariants for the User aggregate root.
 * See ../docs/aggregates_and_invariants.md for detailed documentation.
 */

import { DatabaseReader } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { InvariantViolationError, NotFoundError, ValidationError } from "../errors";
import { UserRole } from "./types";

/**
 * Valid user roles
 */
export const VALID_USER_ROLES: UserRole[] = [
  "student",
  "instructor",
  "admin",
  "registrar",
  "department_head",
];

/**
 * Validates that a password is hashed (basic check - should start with hash identifier)
 */
export function validatePasswordIsHashed(hashedPassword: string): void {
  // Common hash prefixes: $2a$, $2b$, $2y$ (bcrypt), $argon2id$ (argon2)
  const hashPatterns = [
    /^\$2[ayb]\$/, // bcrypt
    /^\$argon2/, // argon2
    /^\$pbkdf2/, // pbkdf2
  ];

  const isHashed = hashPatterns.some((pattern) => pattern.test(hashedPassword));

  if (!isHashed) {
    throw new ValidationError(
      "hashedPassword",
      "Password must be properly hashed before storage"
    );
  }
}

/**
 * Validates role assignments are from predefined set
 */
export function validateRoles(roles: string[]): roles is UserRole[] {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw new InvariantViolationError(
      "UserAggregate",
      "Role Assignment Validity",
      "User must have at least one role"
    );
  }

  for (const role of roles) {
    if (!VALID_USER_ROLES.includes(role as UserRole)) {
      throw new InvariantViolationError(
        "UserAggregate",
        "Role Assignment Validity",
        `Invalid role '${role}'. Valid roles: ${VALID_USER_ROLES.join(", ")}`
      );
    }
  }

  return true;
}

/**
 * Validates username uniqueness
 */
export async function validateUsernameUniqueness(
  db: DatabaseReader,
  username: string,
  excludeId?: Id<"users">
): Promise<void> {
  const existing = await db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();

  if (existing && existing._id !== excludeId) {
    throw new InvariantViolationError(
      "UserAggregate",
      "Username Uniqueness",
      `Username '${username}' is already taken`
    );
  }
}

/**
 * Validates profile completeness
 */
export function validateProfile(profile: { firstName?: string; lastName?: string }): void {
  if (!profile.firstName || profile.firstName.trim() === "") {
    throw new ValidationError("profile.firstName", "First name is required");
  }

  if (!profile.lastName || profile.lastName.trim() === "") {
    throw new ValidationError("profile.lastName", "Last name is required");
  }
}

/**
 * Validates role consistency with related entities
 * (e.g., if user has student role, there should be a student record)
 */
export async function validateRoleConsistency(
  db: DatabaseReader,
  userId: Id<"users">,
  roles: UserRole[]
): Promise<void> {
  // Check if user has student role
  if (roles.includes("student")) {
    // Note: Student record validation could be added here if needed
    // For now, we allow student role assignment even if student record doesn't exist yet
    await db
      .query("students")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  }

  // Add similar checks for other roles if needed
}

/**
 * Validates all invariants for creating a user
 */
export async function validateCreateUser(
  db: DatabaseReader,
  username: string,
  hashedPassword: string,
  roles: string[],
  profile: { firstName?: string; lastName?: string; middleName?: string }
): Promise<void> {
  await validateUsernameUniqueness(db, username);
  validatePasswordIsHashed(hashedPassword);
  validateRoles(roles);
  validateProfile(profile);
  
  // Optional: validate role consistency
  // await validateRoleConsistency(db, userId, roles as UserRole[]);
}

/**
 * Validates all invariants for updating a user
 */
export async function validateUpdateUser(
  db: DatabaseReader,
  userId: Id<"users">,
  username?: string,
  hashedPassword?: string,
  roles?: string[],
  profile?: { firstName?: string; lastName?: string; middleName?: string }
): Promise<void> {
  const user = await db.get(userId);
  if (!user) {
    throw new NotFoundError("User", userId);
  }

  if (username && username !== user.username) {
    await validateUsernameUniqueness(db, username, userId);
  }

  if (hashedPassword) {
    validatePasswordIsHashed(hashedPassword);
  }

  if (roles) {
    validateRoles(roles);
  }

  if (profile) {
    validateProfile(profile);
  }
}

/**
 * Validates password change
 */
export function validatePasswordChange(newHashedPassword: string): void {
  validatePasswordIsHashed(newHashedPassword);
}

