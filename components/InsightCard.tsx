import type { InsightLine } from "@/lib/result-view";

export function InsightCard({
  title,
  lines,
  note,
}: {
  title: string;
  lines: InsightLine[];
  note?: string;
}) {
  return (
    <section className="rounded-card border bg-card p-6 sm:p-8">
      <h3 className="text-xl font-bold">{title}</h3>
      {lines.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.keyword} className="rounded-tile bg-secondary/60 px-4 py-3 text-[15px] leading-relaxed">
              {l.text}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{note}</p>}
    </section>
  );
}
