import { describe, expect, it } from "vitest";
import { settle, STALE_ERROR } from "./jobs";

const now = Date.parse("2026-11-15T17:30:00Z");
const job = (status: string, created_at: string) => ({ status, created_at, error: null });

describe("settle", () => {
  it("leaves a recent running job alone", () => {
    expect(settle(job("running", "2026-11-15T17:20:00Z"), now)?.status).toBe("running");
  });

  it("treats a job running for over 25 minutes as failed", () => {
    const settled = settle(job("running", "2026-11-15T16:40:00Z"), now);
    expect(settled?.status).toBe("failed");
    expect(settled?.error).toBe(STALE_ERROR);
  });

  it("never changes a finished job", () => {
    expect(settle(job("done", "2026-11-01T10:00:00Z"), now)?.status).toBe("done");
  });

  it("passes no job through", () => {
    expect(settle(null, now)).toBeNull();
  });
});
