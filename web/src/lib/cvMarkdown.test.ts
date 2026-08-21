import { describe, expect, it } from "vitest";

import { cvToHtml, parseCv, parseInline, slug } from "./cvMarkdown";

describe("parseCv", () => {
  it("reads the shapes a CV is made of", () => {
    const blocks = parseCv(
      "# Olga Aksenova\n**Analyst**\n\n---\n\n## Work Experience\n- one\n- two",
    );
    expect(blocks.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "rule",
      "heading",
      "list",
    ]);
  });

  it("gives headings the id pandoc would give them", () => {
    expect(slug("Certifications & Courses")).toBe("certifications-courses");
    expect(slug("Languages")).toBe("languages");
  });

  it("drops blank lines rather than turning them into paragraphs", () => {
    expect(parseCv("a\n\n\n\nb")).toHaveLength(2);
  });
});

describe("parseInline", () => {
  it("finds bold, italic and links", () => {
    expect(parseInline("**Market Research** | *May 2025*")).toEqual([
      { kind: "bold", text: "Market Research" },
      { kind: "text", text: " | " },
      { kind: "italic", text: "May 2025" },
    ]);
  });

  it("keeps a link only when the address is one you can safely click", () => {
    expect(parseInline("[LinkedIn](https://linkedin.com/in/x)")[0]).toEqual({
      kind: "link",
      text: "LinkedIn",
      href: "https://linkedin.com/in/x",
    });
    // a javascript: URL loses its link and keeps its words
    expect(parseInline("[Click](javascript:alert(1))")[0]).toEqual({
      kind: "text",
      text: "Click",
    });
  });
});

describe("cvToHtml", () => {
  it("escapes what React would have escaped for free", () => {
    const html = cvToHtml("## M&A Analyst\n- <script>alert(1)</script>");
    expect(html).toContain("M&amp;A Analyst");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes inside a link's address as well as its words", () => {
    const html = cvToHtml('[x](https://example.com/?a="b"&c=1)');
    expect(html).not.toContain('?a="b"');
    expect(html).toContain("&quot;");
    expect(html).toContain("&amp;c=1");
  });

  it("produces the elements the stylesheet addresses", () => {
    const html = cvToHtml(
      "# Name\n**Headline**\nContact\n\n## Languages\nRussian",
    );
    expect(html).toContain("<h1 id=\"name\">");
    expect(html).toContain("<h2 id=\"languages\">");
    // the stylesheet centres `h1 + p` and `h1 + p + p`, so the two paragraphs
    // after the name must stay adjacent siblings with nothing between them
    expect(html).toMatch(/<h1[^>]*>Name<\/h1>\n<p><strong>Headline<\/strong><\/p>\n<p>Contact<\/p>/);
  });
});
