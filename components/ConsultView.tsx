"use client";

import { ArrowUp, Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PROFILE_STEPS, stageOf, type ProfileAnswers } from "@/lib/profile";
import { SERVICE_NAME } from "@/lib/config";
import { ConfirmCard, EvidenceCard } from "./AnswerCard";
import { MarkdownAnswer } from "./MarkdownAnswer";

type StoreBrief = { placeId: string; name: string; category: string; rating?: number };

const EMPTY: ProfileAnswers = PROFILE_STEPS.map(() => null);
const storageKey = (placeId: string) => `placement:profile:${placeId}`;

// 성향 파악(5단계)을 마치면 상담 화면으로 넘어간다. 고른 답은 이 브라우저 탭에만 잠깐 기억한다(로그인 후 DB 저장 예정).
function readSaved(placeId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(placeId));
  } catch {
    return null; // 저장소를 못 쓰면 처음부터 묻는다
  }
}

function parseSaved(raw: string | null): ProfileAnswers | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProfileAnswers;
    return Array.isArray(parsed) && parsed.length === EMPTY.length && parsed.every((v) => v != null) ? parsed : null;
  } catch {
    return null;
  }
}

const noSubscribe = () => () => {};

export function ConsultView({ store, topKeywords, competitorId }: { store: StoreBrief; topKeywords: string[]; competitorId?: string }) {
  // 서버 렌더에서는 저장값이 없다고 보고(null), 브라우저에서 sessionStorage 를 읽는다.
  const savedRaw = useSyncExternalStore(noSubscribe, () => readSaved(store.placeId), () => null);
  const saved = parseSaved(savedRaw);
  const [override, setOverride] = useState<{ answers: ProfileAnswers; done: boolean } | null>(null);
  const answers = override?.answers ?? saved ?? EMPTY;
  const done = override?.done ?? saved != null;

  function finish(final: ProfileAnswers) {
    setOverride({ answers: final, done: true });
    try {
      sessionStorage.setItem(storageKey(store.placeId), JSON.stringify(final));
    } catch {
      /* 무시 */
    }
  }

  return done ? (
    <ChatRoom store={store} topKeywords={topKeywords} competitorId={competitorId} answers={answers} onRedo={() => setOverride({ answers, done: false })} />
  ) : (
    <ProfileWizard key={answers.join(",")} initial={answers} onDone={finish} />
  );
}

/* ───────────── 성향 파악 1~5 ───────────── */

function ProfileWizard({ initial, onDone }: { initial: ProfileAnswers; onDone: (a: ProfileAnswers) => void }) {
  const [answers, setAnswers] = useState<ProfileAnswers>(initial);
  const [step, setStep] = useState(() => Math.max(0, initial.findIndex((v) => v == null)));
  const current = PROFILE_STEPS[step];
  const picked = answers[step];

  function pick(i: number) {
    const next = [...answers];
    next[step] = i;
    setAnswers(next);
  }
  function go(delta: number) {
    if (delta > 0 && picked == null) return;
    if (step + delta >= PROFILE_STEPS.length) return onDone(answers);
    setStep((s) => Math.max(0, s + delta));
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 pb-10 sm:px-0">
      <div className="flex min-h-[720px] flex-col items-center rounded-[40px] bg-panel px-5 py-16 sm:rounded-panel sm:px-[86px] sm:py-20">
        <ol className="flex w-full max-w-[720px] items-center" aria-label="성향 파악 단계">
          {PROFILE_STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "now" : "todo";
            return (
              <li key={s.key} className={`flex items-center ${i < PROFILE_STEPS.length - 1 ? "flex-1" : ""}`} aria-current={state === "now" ? "step" : undefined}>
                <span className="flex items-center gap-2">
                  <span
                    className={`flex size-[30px] items-center justify-center rounded-full text-[13px] font-bold ${
                      state === "todo" ? "border border-off-border bg-card text-off-text" : "bg-primary text-white"
                    }`}
                  >
                    {state === "done" ? <Check className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={`text-sm ${state === "now" ? "font-bold text-primary" : "text-off-text"}`}>{s.label}</span>
                </span>
                {i < PROFILE_STEPS.length - 1 && <span className={`mx-3 h-px flex-1 ${i < step ? "bg-primary" : "bg-on-border"}`} aria-hidden />}
              </li>
            );
          })}
        </ol>

        <div className="relative mt-24 w-full max-w-[720px]">
          <h1 className="text-[26px] font-bold">{current.question}</h1>
          <ul className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label={current.question}>
            {current.options.map((opt, i) => {
              const on = picked === i;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pick(i)}
                    className={`flex h-[50px] w-full items-center gap-4 rounded-xl border px-5 text-left text-[15px] transition ${
                      on ? "border-primary bg-on-bg font-bold text-primary" : "border-input bg-card hover:border-on-border"
                    }`}
                  >
                    <span className={`flex size-[18px] items-center justify-center rounded-full ${on ? "bg-primary" : "border border-input"}`} aria-hidden>
                      {on && <span className="size-2 rounded-full bg-white" />}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => go(-1)}
            disabled={step === 0}
            aria-label="이전 질문"
            className="absolute -left-[42px] top-[200px] hidden size-[30px] items-center justify-center rounded-full bg-on-border text-white disabled:opacity-40 sm:flex"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={picked == null}
            aria-label={step === PROFILE_STEPS.length - 1 ? "상담 시작하기" : "다음 질문"}
            className="absolute -right-[42px] top-[200px] hidden size-[30px] items-center justify-center rounded-full bg-primary text-white disabled:bg-on-border sm:flex"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <div className="mt-8 flex justify-between sm:justify-end">
            <button type="button" onClick={() => go(-1)} disabled={step === 0} className="text-sm text-muted-foreground disabled:invisible sm:hidden">
              이전
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={picked == null}
              className="h-12 rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground disabled:opacity-40"
            >
              {step === PROFILE_STEPS.length - 1 ? "상담 시작하기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ───────────── 마케팅 상담 ───────────── */

type Evidence = { id: string; knowledgeId: string; title: string; summary: string; strength: "강함" | "중간" | "혼재" };
type Confirm = { question: string; buttons: string[] };
type Turn = {
  id: number;
  question: string;
  answer: string;
  status: "streaming" | "done" | "unavailable" | "error";
  evidence: Evidence[];
  confirm?: Confirm;
  picked?: string;
};

const QUICK = ["우리 가게를 더 많이 알리고 싶어요", "플레이스 소개글을 바꾸고 싶어요", "무엇부터 해야 할지 모르겠어요"];
const UNAVAILABLE = "챗봇을 준비 중이에요. 잠시 뒤에 다시 시도해 주세요.";
const FAILED = "답변을 만드는 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";

function ChatRoom({
  store,
  topKeywords,
  competitorId,
  answers,
  onRedo,
}: {
  store: StoreBrief;
  topKeywords: string[];
  competitorId?: string;
  answers: ProfileAnswers;
  onRedo: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const turnRefs = useRef(new Map<number, HTMLDivElement>());
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "streaming");
  const stage = stageOf(answers);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns]);

  function patch(id: number, fn: (t: Turn) => Turn) {
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    setActiveTurn(id);
    setTurns((all) => [...all, { id, question, answer: "", status: "streaming", evidence: [] }]);
    setDraft("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: store.placeId, question, profile: answers, competitorId }),
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

  const greetingBody = topKeywords.length
    ? `손님들이 '${topKeywords.join("', '")}' 같은 점을 좋게 봤어요.\n이 강점을 더 잘 알릴 방법을 함께 찾아볼게요.\n요즘 가게 마케팅에서 가장 고민되는 점은 무엇인가요?`
    : "요즘 가게 마케팅에서 가장 고민되는 점을 편하게 알려주세요.";

  return (
    <main className="mx-auto mt-4 grid w-full max-w-[1320px] gap-5 px-4 pb-10 sm:px-6 lg:grid-cols-[292px_minmax(0,1fr)] xl:px-0">
      <aside className="flex min-w-0 flex-col rounded-card bg-secondary px-6 py-7 lg:h-[calc(100dvh-166px)] lg:min-h-[620px]">
        <p className="text-[13px] text-muted-foreground">지금 상담 중인 가게</p>
        <div className="mt-5 flex items-start justify-between gap-2">
          <p className="break-keep text-2xl font-bold">{store.name}</p>
          {store.rating != null && <p className="mt-1 shrink-0 font-bold text-star">★ {store.rating.toFixed(1)}</p>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{store.category.split(",").join(" · ")}</p>

        <nav aria-label="현재 대화 질문 목록" className="-mx-6 mt-5 max-h-40 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          {turns.map((turn) => (
            <button
              key={turn.id}
              type="button"
              aria-current={activeTurn === turn.id ? "true" : undefined}
              onClick={() => {
                setActiveTurn(turn.id);
                turnRefs.current.get(turn.id)?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
              className={`block w-full rounded-xl px-[18px] py-3.5 text-left text-xs leading-relaxed text-muted-foreground transition hover:bg-primary/5 ${activeTurn === turn.id ? "bg-primary/10" : ""}`}
            >
              {turn.question}
            </button>
          ))}
        </nav>

        <div className="mt-6 flex flex-col gap-2">
          {[
            { name: "마케팅 시작 단계", desc: "기본부터 차근차근 안내해드려요" },
            { name: "마케팅 개선 단계", desc: "지금 하는 마케팅을 더 잘하도록 도와드려요" },
          ].map((item) => (
            <div key={item.name} className={`rounded-tile border px-4 py-3 ${stage?.name === item.name ? "border-primary bg-on-border" : "border-transparent bg-[#d9d9d9]"}`}>
              <p className={`text-sm font-bold ${stage?.name === item.name ? "text-primary" : "text-off-text"}`}>{item.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
          <button type="button" onClick={onRedo} className="self-start text-xs text-muted-foreground underline underline-offset-2">
            성향 답 다시 고르기
          </button>
        </div>
        <Link
          href={`/result/${encodeURIComponent(store.placeId)}`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-[#9cc0ff] bg-[#dcebff] px-2 text-sm font-bold text-star"
        >
          가게 분석 다시 보기 ↗
        </Link>
        <Link
          href={competitorId ? `/compare/${encodeURIComponent(store.placeId)}/${encodeURIComponent(competitorId)}` : `/compare/${encodeURIComponent(store.placeId)}`}
          className="mt-1.5 flex min-h-11 items-center justify-center rounded-xl border border-[#9cc0ff] bg-[#dcebff] px-2 text-sm font-bold text-star"
        >
          {competitorId ? "경쟁자 분석 다시 보기 ↗" : "경쟁 가게와 비교하기 ↗"}
        </Link>
      </aside>

      {/* 오른쪽: 대화 */}
      <section className="flex min-w-0 flex-col rounded-card bg-card px-5 pb-[22px] pt-4 sm:px-8 lg:h-[calc(100dvh-166px)] lg:min-h-[620px]">
        <header className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 break-keep text-lg font-bold sm:text-xl">우리 가게 마케팅 이야기</h1>
          <button
            type="button"
            onClick={() => {
              setTurns([]);
              setDraft("");
              setActiveTurn(null);
            }}
            disabled={busy}
            className="h-11 shrink-0 rounded-xl bg-secondary px-4 text-sm font-bold text-primary disabled:opacity-50 sm:px-7"
          >
            새 대화
          </button>
        </header>

        <div className="mt-10 flex min-h-[340px] flex-1 flex-col gap-3.5 overflow-y-auto pr-1 lg:min-h-0" aria-live="polite">
          <BotBubble>
            <p className="text-[17px] font-bold">사장님, {store.name}의 가게 정보를 살펴봤어요.</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{greetingBody}</p>
          </BotBubble>

          {turns.length === 0 && (
            <div className="flex flex-col items-start gap-2.5">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="min-h-11 w-full max-w-[350px] rounded-xl bg-secondary px-5 py-2.5 text-sm font-bold text-primary hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {q}
                </button>
              ))}
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} ref={(node) => {
              if (node) turnRefs.current.set(t.id, node);
              else turnRefs.current.delete(t.id);
            }} className="flex scroll-mt-2 flex-col gap-5">
              <p className="min-h-11 max-w-full self-end break-words rounded-xl bg-secondary px-6 py-2.5 text-sm font-bold text-primary sm:min-w-[320px] sm:max-w-[80%] sm:text-center">{t.question}</p>
              {t.status === "unavailable" && <BotBubble>{UNAVAILABLE}</BotBubble>}
              {t.status === "error" && !t.answer && <BotBubble>{FAILED}</BotBubble>}
              {t.status === "streaming" && !t.answer && (
                <BotBubble>
                  <span className="animate-pulse text-muted-foreground">답변을 만들고 있어요…</span>
                </BotBubble>
              )}
              {t.answer && (
                <BotBubble>
                  <div className="text-[15px] leading-relaxed">
                    <MarkdownAnswer text={t.answer} />
                  </div>
                  {t.status === "streaming" && <span className="mt-3 block text-sm text-muted-foreground">답변을 이어서 쓰고 있어요…</span>}
                  {t.status === "error" && <span className="mt-2 block text-sm text-muted-foreground">{FAILED}</span>}
                </BotBubble>
              )}
              {t.evidence.length > 0 && (
                <div className="ml-0 flex max-w-[850px] flex-col gap-2 sm:ml-0">
                  <p className="text-sm font-bold">이 답변의 근거</p>
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
          <div ref={endRef} />
        </div>

        <form
          className="mt-6 flex min-h-16 shrink-0 items-center gap-3 rounded-tile bg-background pl-5 pr-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="상담 내용 입력"
            placeholder="사장님의 고민을 편하게 이야기해 주세요."
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-primary px-4 text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            보내기 <ArrowUp className="size-4" aria-hidden />
          </button>
        </form>
        <p className="sr-only">답변은 가게 상황에 따라 달라질 수 있어요. 중요한 정보는 실행 전에 확인해 주세요.</p>
      </section>
    </main>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[850px] shrink-0">
      <p className="text-[13px] font-bold text-primary">{SERVICE_NAME}</p>
      <div className="mt-3.5 break-words rounded-[20px] bg-background px-5 py-4">{children}</div>
    </div>
  );
}
