/**
 * The CV as the agent reads it, built in the browser.
 *
 * A mirror of `profile_to_text` in src/profile.py, so that what the My CV page
 * shows and lets you correct is the same text the scorer and the CV writer
 * receive. The Python side renders one track at a time; here there is no
 * track, so nothing is hidden and a per-track wording falls back to its
 * default, or to the first variant when there is none.
 */

type Item = Record<string, unknown>;
type Section = { title: string; type: string; items: unknown[] };
type ProfileData = {
  contact?: { name?: string; details?: unknown[] };
  headline?: unknown;
  sections?: Section[];
  edited_text?: string;
};

function clean(text: unknown): string {
  return String(text ?? "").replace(/\s{2,}/g, " ").trim();
}

function variantText(item: Item): string {
  if (typeof item.default === "string") return item.default;
  const variants = (item.variants ?? {}) as Record<string, string>;
  return Object.values(variants).find((v) => typeof v === "string" && v) ?? "";
}

function itemText(item: Item): string {
  const raw = "variants" in item || "default" in item ? variantText(item) : String(item.text ?? "");
  if (!raw) return "";
  return clean(raw.replace("{metric}", String(item.metric ?? "")));
}

function renderEntries(items: unknown[], out: string[]) {
  for (const raw of items) {
    const item = raw as Item;
    const dates = item.dates as string | undefined;
    out.push(`\n### ${clean(item.heading)}`);
    const place = clean(item.subheading);
    if (place || dates) {
      out.push([place ? `*${place}*` : "", dates ? `*${dates}*` : ""].filter(Boolean).join(" "));
    }
    for (const bullet of (item.bullets as Item[] | undefined) ?? []) {
      const text = itemText(bullet);
      if (text) out.push(`- ${text}`);
    }
    const subs = (item.subitems as Item[] | undefined) ?? [];
    if (subs.length && item.subitems_label) {
      out.push("", `**${item.subitems_label}**`, "");
    }
    for (const sub of subs) {
      const subDates = sub.dates as string | undefined;
      out.push(`- ${clean(sub.heading)}` + (subDates ? ` | *${subDates}*` : ""));
      for (const subBullet of (sub.bullets as Item[] | undefined) ?? []) {
        const text = itemText(subBullet);
        if (text) out.push(`  - ${text}`);
      }
    }
  }
}

function renderCategories(items: unknown[], out: string[]) {
  for (const raw of items) {
    const item = raw as Item;
    out.push(`- **${item.label}:** ${((item.values as string[]) ?? []).join(", ")}`);
  }
}

function renderInline(items: unknown[], out: string[]) {
  const values = items
    .map((item) => (typeof item === "string" ? item : itemText(item as Item)))
    .filter(Boolean);
  out.push(values.join(" · "));
}

function renderList(items: unknown[], out: string[]) {
  for (const raw of items) {
    if (typeof raw === "string") {
      out.push(`- ${raw}`);
      continue;
    }
    const item = raw as Item;
    const text = itemText(item);
    if (!text) continue;
    const dates = item.dates as string | undefined;
    out.push(`- ${text}` + (dates ? ` | *${dates}*` : ""));
  }
}

function renderText(items: unknown[], out: string[]) {
  for (const raw of items) {
    const text = typeof raw === "string" ? clean(raw) : itemText(raw as Item);
    if (text) out.push(text);
  }
}

const RENDERERS: Record<string, (items: unknown[], out: string[]) => void> = {
  entries: renderEntries,
  categories: renderCategories,
  inline: renderInline,
  list: renderList,
  text: renderText,
};

/** The text the agent builds from the saved CV, before any correction. */
export function generatedText(profile: ProfileData): string {
  const out: string[] = [];
  out.push(`# ${profile.contact?.name ?? ""}`);
  const headline =
    profile.headline && typeof profile.headline === "object" ? itemText(profile.headline as Item) : "";
  if (headline) out.push(`**${headline}**`);
  const details = (profile.contact?.details ?? [])
    .map((d) => (typeof d === "string" ? d : String((d as Item)?.value ?? "")))
    .filter(Boolean);
  out.push(details.join(" · "));

  for (const section of profile.sections ?? []) {
    const render = RENDERERS[section.type] ?? RENDERERS.text;
    out.push(`\n## ${section.title}`);
    render(section.items ?? [], out);
  }
  return out.join("\n");
}

/** What the agent reads now: your correction when there is one. */
export function agentText(profile: ProfileData): string {
  const edited = profile.edited_text;
  return typeof edited === "string" && edited.trim() ? edited.trim() : generatedText(profile);
}
