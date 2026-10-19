// The provider sent something we can't use, e.g. an order without an id.
// Webhook route answers 422 (DoorDash gets a "fail" confirmation instead).
export class InvalidPayloadError extends Error {}

// A call to another service failed, e.g. Uber's Get Order.
// Webhook route answers 502, which makes Uber retry later.
export class UpstreamError extends Error {}
