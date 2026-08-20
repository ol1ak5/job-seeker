/**
 * Turning an uploaded CV file into plain text.
 *
 * Runs on the server: the parsers are Node libraries, and the file should not
 * be handed to a third party from the browser anyway.
 */

export const ACCEPTED = ".pdf,.docx,.txt,.md";
export const MAX_BYTES = 5 * 1024 * 1024;

export class UnreadableCv extends Error {}

export async function extractCvText(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new UnreadableCv("That file is over 5 MB. A CV should be far smaller.");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = buffer.toString("utf-8");
  } else {
    throw new UnreadableCv(
      "Upload a .pdf, .docx, .txt or .md file. Old .doc files are not readable - " +
        "open it and save as .docx.",
    );
  }

  if (text.trim().length < 100) {
    // A scanned CV is a picture of text: the file has pages but no characters.
    throw new UnreadableCv(
      "Almost no text came out of that file. If it is a scan, the words are an " +
        "image - save the CV from your word processor as .docx or .pdf instead.",
    );
  }
  return text;
}
