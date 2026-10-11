"use client";

import { useRef, useState } from "react";
import { FAQ } from "@/lib/sample-chat";
import { AnswerCard, ConfirmCard, EvidenceCard } from "./AnswerCard";
import { MarkdownAnswer } from "./MarkdownAnswer";

type Evidence = { id: string; knowledgeId: string; title: string; summary: string; strength: "강함" | "중간" | "혼재" };
type Confirm = { question: string; buttons: string[] };

type Turn = {
  id: number;
  question: string;
  answer: string;
  status: "streaming" | "done" | "unavailable" | "error";
  evidence: Evidence[];
  confirm?: Confirm;
  picked?: string; // 확인 카드에서 고른 버튼 (저장은 아직 하지 않는다)
};

const UNAVAILABLE = "챗봇을 준비 중이에요. 잠시 뒤에 다시 시도해 주세요.";
const FAILED = "답변을 만드는 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";

export function ChatPanel({ placeId }: { placeId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const busy = turns.some((t) => t.status === "streaming");

  function patch(id: number, fn: (t: Turn) => Turn) {
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    setTurns((all) => [...all, { id, question, answer: "", status: "streaming", evidence: [] }]);
    setDraft("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, question }),
      });
      if (!res.ok || !res.body) {
        const info = (await res.json().catch(() => null)) as { status?: string } | null;
        patch(id, (t) => ({ ...t, status: info?.status === "llm_unavailable" ? "unavailable" : "error" }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "done"; evidence: Evidence[]; confirm?: Confirm }
            | { type: "error"; message: string };
          if (event.type === "delta") patch(id, (t) => ({ ...t, answer: t.answer + event.text }));
          else if (event.type === "done") patch(id, (t) => ({ ...t, status: "done", evidence: event.evidence, confirm: event.confirm }));
          else patch(id, (t) => ({ ...t, status: "error" }));
        }
      }
      patch(id, (t) => (t.status === "streaming" ? { ...t, status: "done" } : t));
    } catch {
      patch(id, (t) => ({ ...t, status: "error" }));
    }
  }

  return (
    <section id="chat" className="scroll-mt-44 pb-24">
      <h2 className="text-[28px] font-bold">이제, 사장님의 고민을 들려주세요</h2>
      <p className="mt-2 text-muted-foreground">
        분석 결과를 바탕으로 우리 가게에 맞는 실행 방법을 함께 찾아드릴게요.
      </p>

      {turns.length === 0 && (
        <div className="mt-6 rounded-card bg-secondary p-6">
          <p className="font-semibold">자주 물어보는 질문</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FAQ.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="rounded-tile bg-card p-4 text-left text-[15px] font-medium transition hover:ring-2 hover:ring-primary/40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div className="mt-8 flex flex-col gap-4" aria-live="polite">
          <p className="text-sm font-semibold text-primary">맞춤 마케팅 상담</p>
          {turns.map((t) => (
            <div key={t.id} className="flex flex-col gap-4">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">사장님</span>
                <div className="max-w-[80%] rounded-card rounded-tr-md bg-primary px-5 py-3 text-primary-foreground">
                  {t.question}
                </div>
              </div>

              {t.status === "unavailable" && <AnswerCard>{UNAVAILABLE}</AnswerCard>}
              {t.status === "error" && !t.answer && <AnswerCard>{FAILED}</AnswerCard>}
              {t.answer && (
                <AnswerCard>
                  <MarkdownAnswer text={t.answer} />
                  {t.status === "streaming" && (
                    <span className="mt-3 block text-sm text-muted-foreground">답변을 이어서 쓰고 있어요…</span>
                  )}
                  {t.status === "error" && <span className="mt-2 block text-sm text-muted-foreground">{FAILED}</span>}
                </AnswerCard>
              )}
              {t.status === "streaming" && !t.answer && <p className="text-sm text-muted-foreground">답변을 만들고 있어요…</p>}

              {t.evidence.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">이 답변의 근거</p>
                  {t.evidence.map((e) => (
                    <EvidenceCard key={e.id} title={e.title} summary={e.summary} strength={e.strength} />
                  ))}
                </div>
              )}

              {t.confirm && (
                <ConfirmCard
                  question={t.confirm.question}
                  buttons={t.confirm.buttons}
                  selected={t.picked}
                  onSelect={(label) => patch(t.id, (x) => ({ ...x, picked: label }))}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <form
        className="mt-8 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="상담 내용 입력"
          placeholder="가게에 대한 고민이나 궁금한 점을 입력해주세요."
          maxLength={500}
          className="h-14 min-w-0 flex-1 rounded-xl border bg-card px-4 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-14 shrink-0 rounded-xl bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          보내기
        </button>
      </form>
    </section>
  );
}
