import { cvToHtml } from "@/lib/cvMarkdown";
import { renderPdf } from "@/lib/pdf";
import { createClient } from "@/lib/supabase/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The CV as a file, built here rather than by the reader's print dialog.
 *
 * Chrome honours the stylesheet's page margins; Safari applies its own and will
 * not be told otherwise, so the same CV was one page in one browser and two in
 * another. Building it on the server settles that: one Chromium, one set of
 * margins, the same file whoever asks.
 */

/**
 * The stylesheet is read rather than duplicated, because it is also what the
 * site renders with and what cv/make_pdf.sh feeds to Chrome. A second copy
 * would drift, and the drift would show up as a differently-shaped CV.
 *
 * The fonts are inlined: setContent gives the page no address, so nothing
 * relative would resolve, and a PDF builder that depends on a network fetch
 * fails in the least convenient way.
 */
function stylesheet(): string {
  const root = process.cwd();
  const css = readFileSync(path.join(root, "src/app/cv.css"), "utf-8");

  return css.replace(/url\("\/fonts\/([^"]+)"\)/g, (_, file: string) => {
    const bytes = readFileSync(path.join(root, "public/fonts", file));
    return `url("data:font/woff2;base64,${bytes.toString("base64")}")`;
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;
  const { data } = await supabase
    .from("cvs")
    .select("filename, markdown, approved_markdown")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return Response.json({ error: "No such CV." }, { status: 404 });
  }

  // Next forbids react-dom/server here, so the shared parser emits the markup
  // directly. Both renderers read the same document; only the drawing differs.
  const body = cvToHtml(data.approved_markdown ?? data.markdown);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${stylesheet()}</style></head>
<body><article class="cv-document">${body}</article></body></html>`;

  let pdf: Uint8Array;
  try {
    pdf = await renderPdf(html);
  } catch (exc) {
    return Response.json(
      { error: `Could not build the PDF: ${(exc as Error).message}` },
      { status: 500 },
    );
  }

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.filename.replace(/\.md$/, ".pdf")}"`,
      "Cache-Control": "no-store",
    },
  });
}
