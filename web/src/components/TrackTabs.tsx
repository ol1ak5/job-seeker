import Link from "next/link";

/**
 * One search at a time.
 *
 * Two tracks are two careers - different CV, different criteria, different
 * judgement of what a good score means. Interleaving them makes every number
 * on the page meaningless: "four strong matches" says nothing if two of them
 * are for a job you would take and two are for a job you would not.
 *
 * The choice lives in the URL rather than in component state so that a reload,
 * a bookmark and a shared link all show the same list.
 */
export default function TrackTabs({
  tracks,
  active,
  counts,
}: {
  tracks: string[];
  active: string;
  counts: Record<string, number>;
}) {
  if (tracks.length < 2) return null;

  return (
    <nav aria-label="Which search" className="mb-5 flex flex-wrap gap-1">
      {tracks.map((track) => {
        const selected = track === active;
        return (
          <Link
            key={track}
            href={`/?track=${encodeURIComponent(track)}`}
            aria-current={selected ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
              selected
                ? "bg-brand/10 font-medium text-brand"
                : "text-ink-soft hover:bg-line-soft"
            }`}
          >
            {track}
            <span
              className={`ml-2 font-mono text-xs ${
                selected ? "text-brand/70" : "text-ink-faint"
              }`}
            >
              {counts[track] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
