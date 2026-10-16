/**
 * Every refusal the server sends: a stable `code` the client can test, and an `error` in English for the player.
 * A code never changes once the client uses it; the text may.
 */
export type Refusal = { readonly code: string; readonly error: string };

const refusal = (code: string, error: string): Refusal => ({ code, error });

export const SIGNED_OUT = refusal("signed_out", "Please sign in again");
export const TOO_MANY_REQUESTS = refusal("too_many_requests", "Too many sign-in attempts. Please wait a minute and try again");
export const INVALID_REQUEST = refusal("invalid_request", "This sign-in request is not valid");
export const SERVER_ERROR = refusal("server_error", "Something went wrong on the server. Please try again");
export const UNKNOWN_BUILDING = refusal("unknown_building", "Unknown building");
export const INVALID_LEVEL = refusal("invalid_level", "Invalid level");

export { refusal };
