import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Is this failure about the session rather than about the data?
 *
 * A rejected token surfaces as an ordinary query error carrying wording from
 * PostgREST or GoTrue - "JWT expired", "JWT issued at future", "invalid claim".
 * Printing that on the page tells the reader nothing they can act on: the
 * answer is always the same, sign in again, and the only thing the message
 * changes is how alarming it looks.
 *
 * "issued at future" is worth naming: it means the clock that signed the token
 * and the clock that checked it disagreed. It resolves itself, but a stored
 * session can carry the bad token around until it is replaced.
 */
export function isSessionError(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST301") return true;
  return /jwt|jws|token|invalid claim|not authenticated/i.test(
    `${error.message} ${error.hint ?? ""}`,
  );
}
