export function AnswerCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border bg-card p-6 leading-relaxed whitespace-pre-wrap">{children}</div>;
}

// 답변이 쓴 지식 조각. 서버가 실제 검색 결과에 있는 지식 ID만 내려준다.
export function EvidenceCard({
  title,
  summary,
  strength,
}: {
  title: string;
  summary: string;
  strength: "강함" | "중간" | "혼재";
}) {
  return (
    <div className="rounded-tile border bg-card p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">근거 {strength}</span>
        {title}
      </p>
      {summary && <p className="mt-1 text-sm text-muted-foreground">{summary}</p>}
    </div>
  );
}

export function ConfirmCard({
  question,
  hint,
  buttons,
  selected,
  onSelect,
}: {
  question: string;
  hint?: string;
  buttons?: string[];
  selected?: string;
  onSelect?: (label: string) => void;
}) {
  return (
    <div className="rounded-card bg-secondary p-6">
      <p className="font-semibold">{question}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {buttons && buttons.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {buttons.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onSelect?.(b)}
              aria-pressed={selected === b}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected === b ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:ring-2 hover:ring-primary/40"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
