import { describe, expect, it } from "vitest";

import { isSessionError } from "./session";

function error(message: string, code = "42501") {
  return { message, code, hint: "" };
}

describe("isSessionError", () => {
  it("recognises the wording a rejected token arrives with", () => {
    for (const message of [
      "JWT issued at future",
      "JWT expired",
      "invalid claim: missing sub claim",
      "JWSError JWSInvalidSignature",
      "Token is expired",
    ]) {
      expect(isSessionError(error(message)), message).toBe(true);
    }
  });

  it("recognises PostgREST's code for it", () => {
    expect(isSessionError(error("anything", "PGRST301"))).toBe(true);
  });

  it("leaves real data problems alone", () => {
    // these must still reach the reader: they say something about the data
    expect(isSessionError(error('column cvs.baseline does not exist', "42703"))).toBe(false);
    expect(isSessionError(error("duplicate key value", "23505"))).toBe(false);
    expect(isSessionError(error("permission denied for table vacancies"))).toBe(false);
  });

  it("treats no error as no problem", () => {
    expect(isSessionError(null)).toBe(false);
  });
});
