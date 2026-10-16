/**
 * "20 minutes ago", for when the last search ran. What that search found is
 * deliberately not repeated beside it: it was true when the run ended, and a
 * vacancy deleted since would make it a lie. The numbers under the page title
 * are the current ones.
 */
export function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
