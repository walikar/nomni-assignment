import { PayloadError } from '../orders/types';

export type Json = Record<string, unknown>;

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Money fields from both providers are integer minor units; reject anything else. */
export function cents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new PayloadError(`${field} must be an integer amount in minor units`);
  }
  return value;
}

export function optionalCents(value: unknown, field: string): number | null {
  return value === undefined || value === null ? null : cents(value, field);
}

export function quantity(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new PayloadError(`${field} must be a non-negative integer`);
  }
  return value;
}

export function joinName(...parts: unknown[]): string | null {
  const name = parts.map(str).filter(Boolean).join(' ');
  return name || null;
}
