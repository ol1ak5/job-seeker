import { describe, expect, it } from "vitest";

import {
  applyDecisions,
  buildHunks,
  buildSegments,
  inlineDiff,
} from "./diff";

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

describe("inlineDiff", () => {
  it("marks only the words that moved", () => {
    const { before, after } = inlineDiff(
      "  - Built valuation models",
      "  - Built power market valuation models",
    );
    expect(before.filter((p) => p.changed)).toEqual([]);
    expect(after.filter((p) => p.changed).map((p) => p.text).join("")).toContain(
      "power",
    );
  });

  it("shows a replacement on both sides", () => {
    const { before, after } = inlineDiff(
      "**Investment Banking Analyst**",
      "**Energy Market Analyst**",
    );
    expect(before.some((p) => p.changed)).toBe(true);
    expect(after.some((p) => p.changed)).toBe(true);
  });

  it("rejoins into exactly the original text", () => {
    const a = "one two   three";
    const b = "one four three";
    const { before, after } = inlineDiff(a, b);
    expect(before.map((p) => p.text).join("")).toBe(a);
    expect(after.map((p) => p.text).join("")).toBe(b);
  });

  it("finds nothing to mark in identical lines", () => {
    const { before, after } = inlineDiff("## Skills", "## Skills");
    expect(before.some((p) => p.changed)).toBe(false);
    expect(after.some((p) => p.changed)).toBe(false);
  });
});

describe("whitespace is not an edit", () => {
  it("ignores trailing spaces the model leaves behind", () => {
    expect(buildHunks("a\nb", "a   \nb\t")).toEqual([]);
  });

  it("still round-trips once whitespace has been levelled", () => {
    const before = "a\nold  ";
    const after = "a\nnew";
    const hunks = buildHunks(before, after);
    expect(hunks).toHaveLength(1);
    expect(applyDecisions(before, after, { 0: "keep" })).toBe("a\nold");
  });
});

describe("buildSegments", () => {
  it("returns the whole document, not only the changes", () => {
    const rebuilt = buildSegments(BEFORE, AFTER)
      .map((s) => (s.kind === "same" ? s.lines : s.after))
      .flat()
      .join("\n");
    expect(rebuilt).toBe(AFTER);
  });

  it("numbers changes the way buildHunks does, so decisions carry over", () => {
    const hunks = buildHunks(BEFORE, AFTER);
    const changes = buildSegments(BEFORE, AFTER).filter((s) => s.kind === "change");
    expect(changes).toHaveLength(hunks.length);
    changes.forEach((change, i) => {
      if (change.kind !== "change") return;
      expect(change.id).toBe(hunks[i].id);
      expect(change.after).toEqual(hunks[i].after);
      expect(change.before).toEqual(hunks[i].before);
    });
  });

  it("keeps the untouched text between the changes", () => {
    const same = buildSegments(BEFORE, AFTER)
      .filter((s) => s.kind === "same")
      .flatMap((s) => (s.kind === "same" ? s.lines : []));
    expect(same).toContain("## Work Experience");
    expect(same).toContain("  - Ran market research");
  });

  it("has nothing to decide when the two documents match", () => {
    expect(buildSegments(BEFORE, BEFORE).every((s) => s.kind === "same")).toBe(true);
  });
});
