/**
 * Reading a CV's Markdown into the handful of shapes a CV actually has.
 *
 * Two renderers need this: the page, which turns it into React elements, and
 * the PDF route, which turns it into a string of HTML because Next forbids
 * react-dom/server in the app directory. Parsing once means they cannot
 * disagree about what the document says - only about how to draw it.
 *
 * Only the syntax a CV uses is understood. Anything else stays plain text,
 * which is the right failure: an unrecognised character shows up rather than
 * vanishing.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: number; id: string; content: Inline[] }
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: Inline[][] }
  | { kind: "rule" };

/** "Certifications & Courses" -> "certifications-courses", as pandoc does. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Only ordinary web links become links, so a javascript: URL cannot be clicked. */
export function isSafeHref(href: string): boolean {
  return /^https?:\/\/|^mailto:/i.test(href);
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) {
      out.push({ kind: "text", text: text.slice(last, match.index) });
    }
    const token = match[0];

    if (token.startsWith("**")) {
      out.push({ kind: "bold", text: token.slice(2, -2) });
    } else if (token.startsWith("[")) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      const label = link?.[1] ?? "";
      const href = link?.[2] ?? "";
      out.push(
        isSafeHref(href)
          ? { kind: "link", text: label, href }
          : { kind: "text", text: label },
      );
    } else {
      out.push({ kind: "italic", text: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function parseCv(markdown: string): Block[] {
  const blocks: Block[] = [];
  let bullets: Inline[][] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push({ kind: "list", items: bullets });
    bullets = [];
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

    if (bullet) {
      bullets.push(parseInline(bullet[1]));
      continue;
    }
    flushBullets();

    if (!line.trim()) continue;

    if (/^\s*(-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        id: slug(heading[2]),
        content: parseInline(heading[2]),
      });
      continue;
    }

    blocks.push({ kind: "paragraph", content: parseInline(line) });
  }
  flushBullets();
  return blocks;
}

/**
 * The same document as a string of HTML, for the PDF builder.
 *
 * React escapes text for free; a string does not, so every piece of the CV goes
 * through `escape` on its way out. A CV carries an ampersand in "M&A" and
 * angle brackets in the odd job title, and one unescaped one would break the
 * document rather than merely look wrong.
 */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(content: Inline[]): string {
  return content
    .map((piece) => {
      switch (piece.kind) {
        case "bold":
          return `<strong>${escape(piece.text)}</strong>`;
        case "italic":
          return `<em>${escape(piece.text)}</em>`;
        case "link":
          return `<a href="${escape(piece.href)}">${escape(piece.text)}</a>`;
        default:
          return escape(piece.text);
      }
    })
    .join("");
}

export function cvToHtml(markdown: string): string {
  return parseCv(markdown)
    .map((block) => {
      switch (block.kind) {
        case "rule":
          return "<hr>";
        case "heading":
          return `<h${block.level} id="${escape(block.id)}">${inlineHtml(block.content)}</h${block.level}>`;
        case "list":
          return `<ul>${block.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</ul>`;
        default:
          return `<p>${inlineHtml(block.content)}</p>`;
      }
    })
    .join("\n");
}
