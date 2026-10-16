/**
 * Where the search stands, in one line under the page title: the numbers worth
 * knowing before reading any row, without cards competing with the table.
 */
export default function StatLine({
  total,
  strong,
  applied,
  inProcess,
}: {
  total: number;
  strong: number;
  applied: number;
  inProcess: number;
}) {
  const items = [
    { value: total, label: total === 1 ? "vacancy" : "vacancies" },
    { value: strong, label: strong === 1 ? "strong match" : "strong matches" },
    { value: applied, label: "applied" },
    { value: inProcess, label: "in process" },
  ];

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
          )}
          <span>
            <span className="font-semibold text-ink">{item.value}</span> {item.label}
          </span>
        </span>
      ))}
    </p>
  );
}
