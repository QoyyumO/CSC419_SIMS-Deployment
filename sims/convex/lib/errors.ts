/**
 * Domain Errors for Aggregate Invariant Violations
 * 
 * These errors represent business rule violations that should be caught
 * and handled appropriately in mutations.
 */

export class InvariantViolationError extends Error {
  constructor(
    public readonly aggregate: string,
    public readonly invariant: string,
    message: string
  ) {
    super(`[${aggregate}] ${invariant}: ${message}`);
    this.name = "InvariantViolationError";
  }
}

export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`Validation error for field '${field}': ${message}`);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string
  ) {
    super(`${entity} with id '${id}' not found`);
    this.name = "NotFoundError";
  }
}

