import type { JSX, ReactNode } from "react";

/**
 * A CV as a document rather than as source code.
 *
 * Rendered into React elements rather than into a string of HTML: this text
 * comes back from a language model, and handing model output to
 * dangerouslySetInnerHTML is how a stray tag becomes a script tag. Building
 * elements means nothing can escape into markup, so no sanitiser is needed and
 * none can be forgotten.
 *
 * Only the syntax a CV actually uses is understood - headings, bold, italic,
 * links, bullets, rules. Anything else is left as plain text, which is the
 * right failure: an unrecognised character shows up, it does not vanish.
 */

/** `**bold**`, `*italic*`, `[text](url)` - nested one level, which is enough. */
function inline(text: string, keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;

    if (token.startsWith("**")) {
      out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      const href = link?.[2] ?? "";
      // Only ordinary web links become links; anything else stays as text so a
      // javascript: URL can never be clicked.
      out.push(
        /^https?:\/\/|^mailto:/i.test(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:opacity-80"
          >
            {link?.[1]}
          </a>
        ) : (
          <span key={key}>{link?.[1]}</span>
        ),
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function CvDocument({ markdown }: { markdown: string }) {
  const blocks: JSX.Element[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="cv-list">
        {bullets.map((item, i) => (
          <li key={i}>{inline(item, `li${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);

    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();

    if (!line.trim()) continue;

    if (/^\s*(-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} className="cv-rule" />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1];
      blocks.push(
        <Tag key={blocks.length} className={`cv-h${level}`}>
          {inline(heading[2], `h${blocks.length}`)}
        </Tag>,
      );
      continue;
    }

    blocks.push(
      <p key={blocks.length} className="cv-p">
        {inline(line, `p${blocks.length}`)}
      </p>,
    );
  }
  flushBullets();

  return <article className="cv-document">{blocks}</article>;
}
