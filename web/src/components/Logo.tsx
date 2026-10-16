/** The mark and the name, the same on every page that shows them. */
export default function Logo({ size = "base" }: { size?: "base" | "large" }) {
  const large = size === "large";
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid place-items-center rounded-lg bg-brand font-mono font-medium text-white ${
          large ? "size-9 text-sm" : "size-7 text-xs"
        }`}
      >
        JS
      </span>
      <span
        className={`font-semibold tracking-tight text-ink ${large ? "text-2xl" : "text-base"}`}
      >
        Job Seeker
      </span>
    </span>
  );
}
