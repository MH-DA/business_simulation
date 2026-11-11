"use client";

import { ArrowUp, Check, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PROFILE_STEPS, stageOf, type ProfileAnswers } from "@/lib/profile";
import type { ConversationSummary, StoredMessage } from "@/lib/chats";
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

export function ConsultView({
  store,
  topKeywords,
  competitorId,
  initialConversations,
}: {
  store: StoreBrief;
  topKeywords: string[];
  competitorId?: string;
  initialConversations: ConversationSummary[];
}) {
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
    <ChatRoom
      store={store}
      topKeywords={topKeywords}
      competitorId={competitorId}
      answers={answers}
      initialConversations={initialConversations}
      onRedo={() => setOverride({ answers, done: false })}
    />
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

// 저장된 메시지(질문, 답변 순서) → 화면의 대화 묶음
function toTurns(messages: StoredMessage[], nextId: () => number): Turn[] {
  const turns: Turn[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      turns.push({ id: nextId(), question: m.content, answer: "", status: "done", evidence: [] });
    } else if (turns.length) {
      const last = turns[turns.length - 1];
      last.answer = m.content;
      last.evidence = m.evidence;
      last.confirm = m.confirm;
    }
  }
  return turns;
}

const dateText = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(+d) ? "" : `${d.getMonth() + 1}.${d.getDate()}.`;
};

function ChatRoom({
  store,
  topKeywords,
  competitorId,
  answers,
  initialConversations,
  onRedo,
}: {
  store: StoreBrief;
  topKeywords: string[];
  competitorId?: string;
  answers: ProfileAnswers;
  initialConversations: ConversationSummary[];
  onRedo: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.status === "streaming");
  const stage = stageOf(answers);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns]);

  function patch(id: number, fn: (t: Turn) => Turn) {
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)));
  }

  function startNew() {
    setTurns([]);
    setActiveId(null);
    setOpenError("");
  }

  // 왼쪽 목록에서 이전 대화 열기
  async function open(id: string) {
    if (busy || opening || id === activeId) return;
    setOpening(id);
    setOpenError("");
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { messages: StoredMessage[] };
      setTurns(toTurns(data.messages, () => nextId.current++));
      setActiveId(id);
    } catch {
      setOpenError("대화를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setOpening(null);
    }
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
        body: JSON.stringify({ placeId: store.placeId, question, profile: answers, competitorId, conversationId: activeId ?? undefined }),
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
            | { type: "conversation"; conversation: ConversationSummary }
            | { type: "done"; evidence: Evidence[]; confirm?: Confirm }
            | { type: "error"; message: string };
          if (event.type === "delta") patch(id, (t) => ({ ...t, answer: t.answer + event.text }));
          else if (event.type === "conversation") {
            // 저장된 대화: 이어서 쓰도록 기억하고, 왼쪽 목록 맨 위로 올린다
            const c = event.conversation;
            setActiveId(c.id);
            setConversations((all) => [c, ...all.filter((x) => x.id !== c.id)]);
          }
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
    ? `손님들이 '${topKeywords.join("', '")}' 같은 점을 좋게 봤어요. 이 강점을 더 잘 알릴 방법을 함께 찾아볼게요. 요즘 가게 마케팅에서 가장 고민되는 점은 무엇인가요?`
    : "요즘 가게 마케팅에서 가장 고민되는 점을 편하게 알려주세요.";

  return (
    <main className="mx-auto grid w-full max-w-[1320px] gap-5 px-4 pb-10 sm:px-0 lg:grid-cols-[292px_1fr]">
      {/* 왼쪽: 상담 중인 가게 */}
      <aside className="flex flex-col rounded-card bg-secondary px-6 py-8 lg:min-h-[734px]">
        <p className="text-[13px] text-muted-foreground">지금 상담 중인 가게</p>
        <div className="mt-5 flex items-start justify-between gap-2">
          <p className="break-keep text-2xl font-bold">{store.name}</p>
          {store.rating != null && <p className="mt-1 shrink-0 font-bold text-star">★ {store.rating.toFixed(1)}</p>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{store.category.split(",").join(" · ")}</p>

        {/* 이전 대화 목록 (로그인한 사장님의 이 가게 상담 기록) */}
        <nav className="mt-8 flex min-h-0 flex-1 flex-col" aria-label="이전 대화">
          <p className="text-[13px] font-bold text-muted-foreground">이전 대화</p>
          {conversations.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">아직 저장된 대화가 없어요. 질문을 보내면 여기에 남아요.</p>
          ) : (
            <ul className="mt-3 flex max-h-[260px] flex-col gap-1 overflow-y-auto pr-1">
              {conversations.map((c) => {
                const on = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void open(c.id)}
                      disabled={busy || opening != null}
                      aria-current={on ? "true" : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed ${
                        on ? "bg-card font-bold text-primary" : "hover:bg-card/70"
                      }`}
                    >
                      <MessageSquare className="size-4 shrink-0 opacity-60" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{opening === c.id ? "불러오는 중…" : c.title}</span>
                      <span className="shrink-0 text-[11px] font-normal text-muted-foreground">{dateText(c.updatedAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {openError && <p className="mt-2 text-xs text-destructive">{openError}</p>}
        </nav>
        {stage && (
          <div className="mt-8 rounded-tile bg-card px-4 py-4">
            <p className="font-bold text-primary">{stage.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stage.desc}</p>
            <button type="button" onClick={onRedo} className="mt-2 text-xs text-muted-foreground underline underline-offset-2">
              답 다시 고르기
            </button>
          </div>
        )}
        <Link
          href={competitorId ? `/compare/${encodeURIComponent(store.placeId)}/${encodeURIComponent(competitorId)}` : `/compare/${encodeURIComponent(store.placeId)}`}
          className="mt-6 flex h-11 items-center justify-center rounded-xl border border-on-border bg-card text-sm font-bold text-primary"
        >
          {competitorId ? "경쟁 가게 비교 다시 보기 ↗" : "경쟁 가게와 비교하기 ↗"}
        </Link>
        <Link
          href={`/result/${encodeURIComponent(store.placeId)}`}
          className="mt-2.5 flex h-11 items-center justify-center rounded-xl border border-[#9cc0ff] bg-[#eaf2ff] text-sm font-bold text-info-foreground"
        >
          가게 분석 다시 보기 ↗
        </Link>
      </aside>

      {/* 오른쪽: 대화 */}
      <section className="flex flex-col rounded-[32px] bg-card px-5 py-6 sm:px-8 lg:min-h-[734px]">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">우리 가게 마케팅 이야기</h1>
          <button
            type="button"
            onClick={startNew}
            disabled={busy}
            className="h-11 rounded-xl bg-secondary px-7 text-sm font-bold text-primary disabled:opacity-50"
          >
            새 대화
          </button>
        </header>

        <div className="mt-8 flex max-h-[520px] flex-1 flex-col gap-5 overflow-y-auto pr-1" aria-live="polite">
          <BotBubble>
            <p className="text-[17px] font-bold">사장님, {store.name}의 가게 정보를 살펴봤어요.</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{greetingBody}</p>
          </BotBubble>

          {turns.length === 0 && (
            <div className="flex flex-col items-end gap-2">
              {QUICK.map((q) => (
                <button key={q} type="button" onClick={() => void send(q)} className="rounded-xl bg-secondary px-6 py-2.5 text-sm font-bold text-primary hover:brightness-95">
                  {q}
                </button>
              ))}
            </div>
          )}

          {turns.map((t) => (
            <div key={t.id} className="flex flex-col gap-5">
              <p className="self-end rounded-xl bg-secondary px-6 py-2.5 text-sm font-bold text-primary">{t.question}</p>
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
          className="mt-6 flex h-16 items-center gap-3 rounded-tile bg-off-bg pl-5 pr-2.5"
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
        <p className="mt-2 text-[11px] text-muted-foreground">답변은 가게 상황에 따라 달라질 수 있어요. 중요한 정보는 실행 전에 확인해 주세요.</p>
      </section>
    </main>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[850px]">
      <p className="text-[13px] font-bold text-primary">{SERVICE_NAME}</p>
      <div className="mt-2 rounded-[20px] bg-off-bg px-5 py-4">{children}</div>
    </div>
  );
}
