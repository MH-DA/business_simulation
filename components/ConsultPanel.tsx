"use client";

import { useEffect, useRef, useState } from "react";
import { ANSWERS, FAQ, type AnswerKey, type MockAnswer } from "@/lib/mock/chat";

// 03·04 챗봇 상담 영역. 5단계에서 lib/mock/chat 대신 /api/chat 응답으로 바꾼다.

type Message =
  | { id: number; role: "owner"; text: string }
  | { id: number; role: "ai"; answer: MockAnswer; answered?: string };

function pickAnswer(text: string): AnswerKey {
  const faq = FAQ.find((f) => f.question === text);
  if (faq) return faq.answerKey;
  if (/재방문|쿠폰|적립|단골|다시/.test(text)) return "retention";
  if (/신규|유입|새 손님|처음|노출/.test(text)) return "newCustomer";
  if (/강점|홍보|장점|자랑/.test(text)) return "strength";
  if (/불편|불만|개선|단점|부정/.test(text)) return "complaint";
  return "fallback";
}

const STRENGTH_STYLE: Record<string, string> = {
  강함: "bg-[#e4f2ea] text-[#2e7d5b]",
  중간: "bg-[#e3ecf7] text-[#2f5f9e]",
  혼재: "bg-[#fbf0dc] text-[#a86a12]",
};

function AnswerBlock({
  answer,
  answered,
  onConfirm,
}: {
  answer: MockAnswer;
  answered?: string;
  onConfirm: (choice: string) => void;
}) {
  return (
    <div className="flex max-w-[870px] flex-col gap-4">
      <article className="rounded-2xl border border-line bg-card px-6 py-6">
        <h3 className="text-lg font-bold text-ink">{answer.title}</h3>
        <p className="mt-3 text-[15px] leading-7 text-muted">{answer.intro}</p>
        {answer.subheading && <p className="mt-4 text-[15px] font-semibold text-brand">{answer.subheading}</p>}
        {answer.points.length > 0 && (
          <ol className="mt-3 space-y-4">
            {answer.points.map((p, i) => (
              <li key={p.title}>
                <p className="text-[15px] font-bold text-ink">
                  {String(i + 1).padStart(2, "0")}
                  <span className="pl-2">{p.title}</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">{p.body}</p>
              </li>
            ))}
          </ol>
        )}
      </article>

      {answer.followup && (
        <article className="rounded-2xl border border-line bg-card px-6 py-6">
          <h3 className="text-lg font-bold text-ink">{answer.followup.title}</h3>
          <ol className="mt-3 space-y-1 text-sm text-muted">
            {answer.followup.steps.map((s, i) => (
              <li key={s}>
                <span aria-hidden="true">{"①②③④⑤"[i]} </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm leading-6 text-ink">{answer.followup.body}</p>
        </article>
      )}

      {answer.evidence.length > 0 && (
        <aside aria-label="답변 근거" className="flex flex-wrap gap-2">
          {answer.evidence.map((e) => (
            <div key={e.knowledgeId} className="flex-1 basis-[260px] rounded-xl border border-line bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-faint">근거</span>
                <span className="text-sm font-semibold text-ink">{e.title}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${STRENGTH_STYLE[e.strength]}`}>
                  근거 {e.strength}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-5 text-muted">{e.summary}</p>
            </div>
          ))}
        </aside>
      )}

      {answer.confirm && (
        <article className="rounded-2xl border border-confirm-line bg-confirm px-6 py-5">
          <p className="text-[11px] font-semibold text-confirm-ink">사장님 확인이 필요해요</p>
          <p className="mt-1 text-[15px] font-medium leading-7 text-ink">{answer.confirm.text}</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="답변 선택">
            {answer.confirm.buttons.map((b) => (
              <button
                key={b}
                type="button"
                disabled={answered !== undefined}
                aria-pressed={answered === b}
                onClick={() => onConfirm(b)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors disabled:cursor-default ${
                  answered === b
                    ? "border-confirm-ink bg-confirm-ink text-white"
                    : "border-confirm-line bg-white text-ink enabled:hover:border-confirm-ink disabled:opacity-50"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {answered && (
            <p className="mt-3 text-xs text-confirm-ink">답변을 저장했어요. 다음 상담에 반영할게요.</p>
          )}
        </article>
      )}
    </div>
  );
}

export function ConsultPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function ask(text: string) {
    const q = text.trim();
    if (!q) {
      setInputError("고민이나 궁금한 점을 입력해주세요.");
      return;
    }
    if (pending) return;
    setInputError(null);
    setInput("");
    setMessages((m) => [...m, { id: nextId.current++, role: "owner", text: q }]);
    setPending(true);
    // 실제 LLM 응답처럼 잠깐 기다렸다가 보여준다
    setTimeout(() => {
      setMessages((m) => [...m, { id: nextId.current++, role: "ai", answer: ANSWERS[pickAnswer(q)] }]);
      setPending(false);
    }, 700);
  }

  function confirm(id: number, choice: string) {
    // 5-4단계에서 POST /api/answers 로 저장한다
    setMessages((m) => m.map((msg) => (msg.id === id && msg.role === "ai" ? { ...msg, answered: choice } : msg)));
  }

  return (
    <div className="flex flex-col">
      {messages.length === 0 ? (
        <div className="pt-24 sm:pt-32">
          <h2 className="text-2xl font-bold text-ink">이제, 사장님의 고민을 들려주세요</h2>
          <p className="mt-3 text-sm text-muted">분석 결과를 바탕으로 우리 가게에 맞는 실행 방법을 함께 찾아드릴게요.</p>
          <div className="mt-6 rounded-t-2xl bg-mint px-3 pt-4 pb-3">
            <p className="px-2 text-sm font-semibold text-ink">자주 물어보는 질문</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {FAQ.map((f) => (
                <li key={f.question}>
                  <button
                    type="button"
                    onClick={() => ask(f.question)}
                    className="w-full rounded-xl border border-line bg-card px-4 py-3.5 text-left text-sm font-medium text-ink transition-colors hover:border-brand"
                  >
                    {f.question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="pt-8">
          <p className="px-4 text-sm font-bold text-brand">맞춤 마케팅 상담</p>
          <ul className="mt-8 flex flex-col gap-6" aria-live="polite">
            {messages.map((m) =>
              m.role === "owner" ? (
                <li key={m.id} className="flex flex-col items-end">
                  <span className="mb-2 text-xs text-muted">사장님</span>
                  <p className="max-w-[750px] rounded-2xl rounded-br-md bg-brand px-6 py-5 text-[15px] font-medium leading-7 text-white">
                    {m.text}
                  </p>
                </li>
              ) : (
                <li key={m.id}>
                  <span className="sr-only">AI 답변</span>
                  <AnswerBlock answer={m.answer} answered={m.answered} onConfirm={(c) => confirm(m.id, c)} />
                </li>
              ),
            )}
            {pending && (
              <li className="text-sm text-muted motion-safe:animate-pulse" role="status">
                답변을 준비하고 있어요…
              </li>
            )}
          </ul>
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        noValidate
        className={`flex flex-col gap-2 border border-line bg-card px-5 py-4 ${
          messages.length === 0 ? "rounded-b-2xl" : "mt-6 rounded-2xl"
        }`}
      >
        <div className="flex items-center gap-3">
          <label htmlFor="consult-input" className="sr-only">
            가게에 대한 고민이나 궁금한 점
          </label>
          <input
            id="consult-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="가게에 대한 고민이나 궁금한 점을 입력해주세요."
            aria-invalid={inputError ? true : undefined}
            aria-describedby={inputError ? "consult-input-error" : undefined}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink placeholder:text-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending}
            className="flex-none rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            보내기
          </button>
        </div>
        {inputError && (
          <p id="consult-input-error" role="alert" className="text-xs text-[#b23a3a]">
            {inputError}
          </p>
        )}
      </form>
    </div>
  );
}
