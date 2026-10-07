"use client";

import { useState } from "react";
import { FAQ, SAMPLE_ANSWERS, SAMPLE_CONFIRM, SAMPLE_NOTICE } from "@/lib/sample-chat";
import { AnswerCard, ConfirmCard } from "./AnswerCard";

export function ChatPanel() {
  const [question, setQuestion] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    setQuestion(t);
    setDraft("");
  }

  return (
    <section id="chat" className="scroll-mt-44 pb-24">
      <h2 className="text-[28px] font-bold">이제, 사장님의 고민을 들려주세요</h2>
      <p className="mt-2 text-muted-foreground">
        분석 결과를 바탕으로 우리 가게에 맞는 실행 방법을 함께 찾아드릴게요.
      </p>

      {question === null && (
        <div className="mt-6 rounded-card bg-secondary p-6">
          <p className="font-semibold">자주 물어보는 질문</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FAQ.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="rounded-tile bg-card p-4 text-left text-[15px] font-medium transition hover:ring-2 hover:ring-primary/40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {question !== null && (
        <div className="mt-8 flex flex-col gap-4" aria-live="polite">
          <p className="text-sm font-semibold text-primary">맞춤 마케팅 상담</p>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">사장님</span>
            <div className="max-w-[80%] rounded-card rounded-tr-md bg-primary px-5 py-3 text-primary-foreground">
              {question}
            </div>
          </div>
          {SAMPLE_ANSWERS.map((a) => (
            <AnswerCard key={a}>{a}</AnswerCard>
          ))}
          <ConfirmCard question={SAMPLE_CONFIRM.question} hint={SAMPLE_CONFIRM.hint} />
          <p className="text-xs text-muted-foreground">{SAMPLE_NOTICE}</p>
        </div>
      )}

      <form
        className="mt-8 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="상담 내용 입력"
          placeholder="가게에 대한 고민이나 궁금한 점을 입력해주세요."
          className="h-14 min-w-0 flex-1 rounded-xl border bg-card px-4 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-14 shrink-0 rounded-xl bg-primary px-6 font-bold text-primary-foreground transition hover:opacity-90"
        >
          보내기
        </button>
      </form>
    </section>
  );
}
