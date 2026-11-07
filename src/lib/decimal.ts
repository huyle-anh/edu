import { Prisma } from "@prisma/client";

export type DecimalValue =
  | Prisma.Decimal
  | number
  | string
  | null
  | undefined;

const ZERO = new Prisma.Decimal(0);

export function toDecimal(value: DecimalValue): Prisma.Decimal {
  if (value === null || value === undefined) {
    return ZERO;
  }

  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value);
}

export function decimalToNumber(value: DecimalValue): number {
  return Number(toDecimal(value).toFixed(2));
}

export function serializeDecimals<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return decimalToNumber(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeDecimals(item)) as T;
  }

  if (value instanceof Date || value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeDecimals(item)]),
  ) as T;
}
