"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SERVICE_NAME } from "@/lib/config";

// Figma 01 회원가입 · 02 로그인. 아이디·비밀번호 방식 (비밀번호 찾기는 아직 없음)

type Field = "loginId" | "password" | "passwordConfirm" | "displayName";
const ID_RULE = /^[A-Za-z0-9._-]{3,40}$/;
const PW_MIN = 8;

const authHref = (path: "/login" | "/signup", next: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`);

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="w-full max-w-[480px] rounded-[28px] bg-card px-7 py-10 shadow-sm sm:px-9">
      <h1 className="text-[28px] font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  type?: "text" | "password";
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className="mt-5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <div
        className={`mt-2 flex h-[52px] items-center rounded-xl border bg-card px-4 focus-within:border-primary ${
          error ? "border-destructive bg-destructive/5" : "border-input"
        }`}
      >
        <input
          id={id}
          type={isPw && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ disabled, busy, children }: { disabled: boolean; busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="mt-7 h-[56px] w-full rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
    >
      {busy ? "잠시만요…" : children}
    </button>
  );
}

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [v, setV] = useState({ loginId: "", password: "", passwordConfirm: "", displayName: "" });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [general, setGeneral] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: Field) => (val: string) => {
    setV((o) => ({ ...o, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  // 입력하면서 바로 보여주는 안내 (서버가 한 번 더 검사한다)
  const live: Partial<Record<Field, string>> = {
    loginId: v.loginId && !ID_RULE.test(v.loginId) ? "아이디는 영문, 숫자, 점(.), 밑줄(_), 하이픈(-)으로 3~40자예요." : undefined,
    password: v.password && v.password.length < PW_MIN ? `비밀번호는 ${PW_MIN}자 이상이에요.` : undefined,
    passwordConfirm: v.passwordConfirm && v.passwordConfirm !== v.password ? "비밀번호가 일치하지 않아요." : undefined,
  };
  const shown = (k: Field) => errors[k] ?? live[k];
  const ready = Object.values(v).every((x) => x.trim()) && !Object.values(live).some(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setGeneral("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { field?: Field; message?: string } | null;
    if (res?.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setBusy(false);
    const message = data?.message ?? "가입 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.";
    if (data?.field) setErrors((o) => ({ ...o, [data.field as Field]: message }));
    else setGeneral(message);
  }

  return (
    <Card title="회원가입" sub={`${SERVICE_NAME}에서 마케팅 함께 시작해요`}>
      <form onSubmit={submit} noValidate>
        <TextField id="loginId" label="아이디" value={v.loginId} onChange={set("loginId")} placeholder="아이디를 입력해주세요." error={shown("loginId")} autoComplete="username" />
        <TextField id="password" label="비밀번호" type="password" value={v.password} onChange={set("password")} placeholder="비밀번호를 입력해주세요." error={shown("password")} autoComplete="new-password" />
        <TextField
          id="passwordConfirm"
          label="비밀번호 확인"
          type="password"
          value={v.passwordConfirm}
          onChange={set("passwordConfirm")}
          placeholder="비밀번호를 다시 입력해주세요."
          error={shown("passwordConfirm")}
          autoComplete="new-password"
        />
        <TextField id="displayName" label="사용자 이름" value={v.displayName} onChange={set("displayName")} placeholder="사용자 이름을 입력해주세요." error={shown("displayName")} autoComplete="nickname" />
        {general && <p className="mt-4 text-[13px] text-destructive">{general}</p>}
        <SubmitButton disabled={!ready} busy={busy}>
          가입하기
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        이미 계정이 있으신가요?{" "}
        <Link href={authHref("/login", next)} className="font-bold text-primary">
          로그인
        </Link>
      </p>
    </Card>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password || busy) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
    }).catch(() => null);
    if (res?.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    const data = (await res?.json().catch(() => null)) as { message?: string } | null;
    setBusy(false);
    setError(data?.message ?? "로그인 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.");
  }

  return (
    <Card title="로그인" sub={`${SERVICE_NAME}에서 우리 가게 마케팅을 시작해보세요.`}>
      <form onSubmit={submit} noValidate>
        <TextField id="loginId" label="아이디" value={loginId} onChange={(x) => (setLoginId(x), setError(""))} placeholder="아이디를 입력해주세요." autoComplete="username" />
        <TextField
          id="password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={(x) => (setPassword(x), setError(""))}
          placeholder="비밀번호를 입력해주세요."
          error={error || undefined}
          autoComplete="current-password"
        />
        <SubmitButton disabled={!loginId.trim() || !password} busy={busy}>
          로그인
        </SubmitButton>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted-foreground">
        아직 계정이 없으신가요?{" "}
        <Link href={authHref("/signup", next)} className="font-bold text-primary">
          회원가입
        </Link>
      </p>
    </Card>
  );
}
