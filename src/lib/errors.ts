export type DomainConflictCode =
  | "TUITION_ALREADY_PAID"
  | "TUITION_CANCELLED"
  | "TUITION_EXEMPTED"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_ALREADY_CONFIRMED"
  | "IDEMPOTENCY_CONFLICT"
  | "STATEMENT_DUPLICATE"
  | "AMOUNT_MISMATCH"
  | "VERSION_CONFLICT";

export class ConflictError extends Error {
  readonly code?: DomainConflictCode;

  constructor(message: string, code?: DomainConflictCode) {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
