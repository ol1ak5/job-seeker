import type { Browser } from "puppeteer-core";

/**
 * Turning a page of HTML into a PDF, on the server.
 *
 * Printing from the reader's browser cannot be made reliable: Chrome honours
 * `@page` margins, Safari applies its own and offers no way to change them, and
 * a CV that fits on one page in one browser spills onto two in the other. The
 * page belongs to the dialog, and the dialog is not ours.
 *
 * So the same Chromium builds every PDF, with the margins written here rather
 * than chosen by whoever clicked. What the reader's browser is becomes
 * irrelevant, which is the whole point.
 */

const A4 = { format: "a4" as const, margin: { top: "13mm", right: "16mm", bottom: "13mm", left: "16mm" } };

async function launch(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  // Locally there is a real Chrome; on Vercel there is only the packaged build,
  // which is why the dependency exists at all.
  const local = process.env.LOCAL_CHROME_PATH;
  if (local) {
    return puppeteer.launch({ executablePath: local, headless: true });
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

export async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // The font decides where every justified line breaks. Measuring before it
    // is ready paginates the document against the fallback face.
    await page.evaluateHandle("document.fonts.ready");
    return await page.pdf({ ...A4, printBackground: false, preferCSSPageSize: false });
  } finally {
    await browser.close();
  }
}
