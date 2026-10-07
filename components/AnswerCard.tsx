export function AnswerCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border bg-card p-6 leading-relaxed">{children}</div>;
}

export function ConfirmCard({ question, hint }: { question: string; hint: string }) {
  return (
    <div className="rounded-card bg-secondary p-6">
      <p className="font-semibold">{question}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
