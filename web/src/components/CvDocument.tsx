import { parseCv, type Inline } from "@/lib/cvMarkdown";
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
 * What the Markdown means is decided in cvMarkdown, shared with the PDF
 * builder. This file only decides how to draw it.
 */
function draw(content: Inline[], keyPrefix: string): ReactNode[] {
  return content.map((piece, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (piece.kind) {
      case "bold":
        return <strong key={key}>{piece.text}</strong>;
      case "italic":
        return <em key={key}>{piece.text}</em>;
      case "link":
        return (
          <a key={key} href={piece.href} target="_blank" rel="noreferrer">
            {piece.text}
          </a>
        );
      default:
        return piece.text;
    }
  });
}

export default function CvDocument({ markdown }: { markdown: string }) {
  const blocks: JSX.Element[] = parseCv(markdown).map((block, i) => {
    switch (block.kind) {
      case "rule":
        return <hr key={i} />;
      case "heading": {
        const Tag = (["h1", "h2", "h3", "h4"] as const)[block.level - 1];
        // pandoc gives every heading an id from its text, and the stylesheet
        // uses one of them (#languages).
        return (
          <Tag key={i} id={block.id}>
            {draw(block.content, `h${i}`)}
          </Tag>
        );
      }
      case "list":
        return (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>{draw(item, `li${i}-${j}`)}</li>
            ))}
          </ul>
        );
      default:
        return <p key={i}>{draw(block.content, `p${i}`)}</p>;
    }
  });

  return <article className="cv-document">{blocks}</article>;
}
