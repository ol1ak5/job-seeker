/**
 * The double border of the example on the front page: a card inside a card,
 * with a soft shadow. The vacancy table, the pop-up windows and the cards on
 * My CV and Settings all sit in one, so every page has the same look.
 *
 * `className` styles the inner card, where the content goes; `outer` adds to
 * the outer one (width, position).
 */
export default function Frame({
  children,
  className = "",
  outer = "",
  small = false,
}: {
  children: React.ReactNode;
  className?: string;
  outer?: string;
  /** Tighter corners and gap, for the little box under "+ Add column". */
  small?: boolean;
}) {
  return (
    <div
      className={`border border-line bg-surface shadow-[0_24px_60px_-34px_rgba(30,58,95,0.35)] ${
        small ? "rounded-xl p-1.5" : "rounded-2xl p-2"
      } ${outer}`}
    >
      <div className={`border border-line bg-surface ${small ? "rounded-lg" : "rounded-xl"} ${className}`}>
        {children}
      </div>
    </div>
  );
}
