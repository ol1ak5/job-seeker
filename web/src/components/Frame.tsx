/**
 * The double border of the example on the front page: a card inside a card,
 * with a soft shadow. The vacancy table, the Add a vacancy form and the cards
 * on My CV and Settings all sit in one, so every page has the same look. The
 * small pop-ups (a note, a new column) keep a single border.
 *
 * `className` styles the inner card, where the content goes; `outer` adds to
 * the outer one (width, position).
 */
export default function Frame({
  children,
  className = "",
  outer = "",
}: {
  children: React.ReactNode;
  className?: string;
  outer?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_60px_-34px_rgba(30,58,95,0.35)] ${outer}`}
    >
      <div className={`rounded-xl border border-line bg-surface ${className}`}>
        {children}
      </div>
    </div>
  );
}
