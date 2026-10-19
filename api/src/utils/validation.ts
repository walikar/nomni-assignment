import { InvalidPayloadError } from './errors';

// Small helpers for reading fields out of provider payloads safely.

export function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Returns the value as an array of objects, or [] if it isn't an array.
export function asObjectArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

// Returns a non-empty string, or null.
export function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

// Money from both providers is a whole number of cents. Anything else is rejected.
export function readCents(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InvalidPayloadError(`${fieldName} must be an integer amount in minor units`);
  }
  return value;
}

export function readOptionalCents(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) return null;
  return readCents(value, fieldName);
}

export function readQuantity(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new InvalidPayloadError(`${fieldName} must be a non-negative integer`);
  }
  return value;
}

// joinName('Kelley', 'W.') -> 'Kelley W.'; joinName(undefined, '') -> null
export function joinName(...parts: unknown[]): string | null {
  const name = parts.map(readText).filter(Boolean).join(' ');
  return name || null;
}

// labelWithQuantity('Milk', 2) -> '2× Milk'
export function labelWithQuantity(name: unknown, quantity: unknown): string {
  const label = readText(name) ?? '?';
  return typeof quantity === 'number' && quantity > 1 ? `${quantity}× ${label}` : label;
}
