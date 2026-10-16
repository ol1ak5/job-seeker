/**
 * The opening of a signed-in page, in the landing page's voice: one line in
 * the ink colour, a second in grey, and an optional sentence under them.
 */
export default function PageIntro({
  title,
  subtitle,
  lead,
}: {
  title: string;
  subtitle?: string;
  lead?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
        <span className="block">{title}</span>
        {subtitle && <span className="block text-ink-faint">{subtitle}</span>}
      </h1>
      {lead && <p className="mx-auto mt-6 max-w-xl leading-relaxed text-ink-soft">{lead}</p>}
    </div>
  );
}
