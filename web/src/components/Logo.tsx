/**
 * The mark and the name, the same on every page that shows them. The mark is
 * a briefcase with a tick: a job, found. app/icon.svg draws the same one for
 * the browser tab.
 */
export default function Logo({ size = "base" }: { size?: "base" | "large" }) {
  const large = size === "large";
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid place-items-center rounded-lg bg-brand text-white ${
          large ? "size-9" : "size-7"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={large ? "size-6" : "size-[19px]"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="7.5" width="16" height="11.5" rx="2" />
          <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
          <path d="m9 13 2 2 4-4" />
        </svg>
      </span>
      <span
        className={`font-semibold tracking-tight text-ink ${large ? "text-2xl" : "text-base"}`}
      >
        Job Seeker
      </span>
    </span>
  );
}
