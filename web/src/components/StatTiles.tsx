/**
 * The four numbers worth knowing before reading any row. A dashboard should
 * answer "where do I stand" before it answers "what is in the list".
 */
export default function StatTiles({
  total,
  strong,
  applied,
  followUps,
}: {
  total: number;
  strong: number;
  applied: number;
  followUps: number;
}) {
  const tiles = [
    { label: "Vacancies", value: total, tone: "text-ink" },
    { label: "Strong matches", value: strong, tone: "text-brand" },
    { label: "Applied", value: applied, tone: "text-ink" },
    { label: "Need follow-up", value: followUps, tone: "text-accent" },
  ];

  return (
    <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-line bg-surface px-4 py-3"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            {tile.label}
          </dt>
          <dd className={`mt-1 font-mono text-2xl ${tile.tone}`}>{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}
