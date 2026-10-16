import { GoogleGenAI } from "@google/genai";

/**
 * Reading a CV into the structured profile the pipeline runs on.
 *
 * The schema below is the same one src/profile.py renders back out, so a
 * profile produced here and a profile written by hand are indistinguishable
 * downstream. If you change the schema, change both.
 *
 * This is the only place a CV is interpreted. The `jobseeker import-cv`
 * command did the same job in Python and is being retired: importing happens
 * on the site now, so there is one implementation, not two drifting ones.
 */

export type Profile = {
  contact: { name: string; details: string[] };
  headline: unknown;
  sections: { title: string; type: string; items: unknown[] }[];
  /** Your correction of the text the agent reads; replaces it when set. */
  edited_text?: string;
};

export class CvNotUnderstood extends Error {}

function instructions(tracks: string[]) {
  return `You convert a CV into a structured profile. Output ONLY data that appears in the CV - never invent employers, dates, metrics, skills or qualifications. Omit anything the CV does not state.

Schema:
- contact: {name, details: [strings - location, phone, email, links]}
- headline: {variants: {<track>: '<one-line positioning>'}} for each of these tracks: ${tracks.join(", ")}
- sections: ordered list; each {title, type, items, tracks?} where type is:
  * entries - jobs/projects: items have heading, subheading?, dates?, bullets[{default: text}], subitems?
  * categories - skills: items have label and values[]
  * inline - one line joined by dots: items are plain strings
  * list - certifications/education: items have text and dates?
  * text - paragraphs: items are plain strings

Use the CV's own section titles and order. Put a job's location in subheading and its period in dates. If a section belongs to only some tracks, add tracks: [..] to it.

Return ONLY a single JSON object - no markdown fences, no commentary before or after.`;
}

function parseProfile(raw: string): Profile {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new CvNotUnderstood(
      "The model did not return a readable profile. Try uploading again.",
    );
  }
  const profile = data as Profile;
  if (!profile?.contact || !Array.isArray(profile?.sections)) {
    throw new CvNotUnderstood(
      "The model could not find a name or any sections in that file. Is it a CV?",
    );
  }
  return profile;
}

export async function profileFromCv(
  cvText: string,
  tracks: string[],
): Promise<Profile> {
  const apiKey = (process.env.GOOGLE_API_KEY ?? "").trim().replace(/^['"]|['"]$/g, "");
  if (!apiKey) {
    throw new CvNotUnderstood("CV reading is not configured on this deployment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-pro-latest",
    contents: `${instructions(tracks.length ? tracks : ["general"])}

CV TEXT:
${cvText.slice(0, 20000)}

Produce the profile now.`,
  });

  if (!response.text) {
    throw new CvNotUnderstood("The model returned nothing. Try uploading again.");
  }
  return parseProfile(response.text);
}
