import { describe, expect, it } from "vitest";

import { applyDecisions, buildHunks } from "./diff";

const BEFORE = `# Olga Aksenova
**Investment Banking Analyst**

## Work Experience

- **CaixaBank CIB** | *2023-2026*
  - Built valuation models
  - Ran market research

## Skills
Python, SQL`;

const AFTER = `# Olga Aksenova
**Energy Market Analyst**

## Work Experience

- **CaixaBank CIB** | *2023-2026*
  - Built power market valuation models
  - Ran market research

## Skills
Python, SQL, PLEXOS`;

describe("buildHunks", () => {
  it("finds each separate change", () => {
    const hunks = buildHunks(BEFORE, AFTER);
    expect(hunks).toHaveLength(3);
    expect(hunks[0].before).toEqual(["**Investment Banking Analyst**"]);
    expect(hunks[0].after).toEqual(["**Energy Market Analyst**"]);
  });

  it("carries the line above, so a change can be placed", () => {
    const hunks = buildHunks(BEFORE, AFTER);
    expect(hunks[0].context).toBe("# Olga Aksenova");
    expect(hunks[2].context).toBe("## Skills");
  });

  it("says nothing about two identical documents", () => {
    expect(buildHunks(BEFORE, BEFORE)).toEqual([]);
  });

  it("ignores changes that are only blank lines", () => {
    expect(buildHunks("a\n\nb", "a\n\n\nb")).toEqual([]);
  });

  it("handles a pure addition and a pure removal", () => {
    expect(buildHunks("a\nb", "a\nnew\nb")[0]).toMatchObject({
      before: [],
      after: ["new"],
    });
    expect(buildHunks("a\ngone\nb", "a\nb")[0]).toMatchObject({
      before: ["gone"],
      after: [],
    });
  });
});

describe("applyDecisions", () => {
  it("accepting everything gives back exactly what the model wrote", () => {
    const hunks = buildHunks(BEFORE, AFTER);
    const all = Object.fromEntries(hunks.map((h) => [h.id, "accept" as const]));
    expect(applyDecisions(BEFORE, AFTER, all)).toBe(AFTER);
  });

  it("rejecting everything gives back exactly what you had", () => {
    const hunks = buildHunks(BEFORE, AFTER);
    const none = Object.fromEntries(hunks.map((h) => [h.id, "keep" as const]));
    expect(applyDecisions(BEFORE, AFTER, none)).toBe(BEFORE);
  });

  it("deciding nothing at all is the same as accepting", () => {
    expect(applyDecisions(BEFORE, AFTER, {})).toBe(AFTER);
  });

  it("mixes the answers one change at a time", () => {
    const result = applyDecisions(BEFORE, AFTER, { 0: "keep", 1: "accept" });
    expect(result).toContain("**Investment Banking Analyst**");
    expect(result).not.toContain("**Energy Market Analyst**");
    expect(result).toContain("Built power market valuation models");
  });

  it("puts a hand-written replacement in verbatim", () => {
    const result = applyDecisions(BEFORE, AFTER, {
      0: { edited: "**Energy Analyst, Madrid**" },
    });
    expect(result).toContain("**Energy Analyst, Madrid**");
    expect(result).not.toContain("**Energy Market Analyst**");
    expect(result).not.toContain("**Investment Banking Analyst**");
  });

  it("keeps the rest of the document untouched whatever is decided", () => {
    const result = applyDecisions(BEFORE, AFTER, { 0: "keep" });
    expect(result).toContain("# Olga Aksenova");
    expect(result).toContain("## Work Experience");
    expect(result).toContain("- **CaixaBank CIB** | *2023-2026*");
  });
});
