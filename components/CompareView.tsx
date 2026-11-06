import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CompareViewModel } from "@/lib/compare-view";
import type { StatusState } from "@/lib/result-view";

// 경쟁 가게 비교 결과 (Figma 시안 전 임시 디자인 — 분석 결과 화면과 같은 스타일)

function Pill({ state }: { state: StatusState }) {
  const on = state === "on";
  return (
    <span className={`inline-flex h-[26px] w-14 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-primary text-white" : "bg-off-pill text-off-pill-text"}`}>
      {on ? "ON" : state === "off" ? "OFF" : "확인 전"}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border bg-card px-6 py-6">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function CompareView({ view }: { view: CompareViewModel }) {
  const { mine, other, numbers } = view;
  const head = (
    <thead>
      <tr className="border-b text-left text-off-text">
        <th className="w-[32%] py-2 font-medium">항목</th>
        <th className="py-2 font-bold text-primary">
          <span className="line-clamp-1">{mine.store.name}</span>
        </th>
        <th className="py-2 font-medium">
          <span className="line-clamp-1">{other.store.name}</span>
        </th>
      </tr>
    </thead>
  );

  return (
    <>
      <p className="text-sm font-bold text-primary">경쟁 가게 비교</p>
      <h1 className="mt-1 break-keep text-[26px] font-bold leading-[1.45] sm:text-[32px]">
        {mine.store.name}와(과) {other.store.name}을(를) 나란히 봤어요
      </h1>
      <p className="mt-1 break-keep text-[13px] text-off-text">
        점수 없이 같은 항목을 나란히 놓았어요. 무엇을 먼저 할지는 사장님이 정해요. 현재 네이버 플레이스에 공개된 정보 기준이에요.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-[15px] lg:grid-cols-2">
        <Card title="숫자와 기본 정보">
          <table className="mt-3 w-full table-fixed text-sm">
            {head}
            <tbody>
              {numbers.rows.map((r) => (
                <tr key={r.item} className="border-b border-off-border last:border-0">
                  <td className="py-[7px] text-muted-foreground">{r.item}</td>
                  <td className="py-[7px] font-bold">{r.mine}</td>
                  <td className="py-[7px]">{r.top}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-[15px]">
          <Card title="플레이스 활용 현황">
            <table className="mt-3 w-full table-fixed text-sm">
              {head}
              <tbody>
                {mine.status.map((s, i) => (
                  <tr key={s.label} className="border-b border-off-border last:border-0">
                    <td className="py-1.5 text-muted-foreground">{s.label}</td>
                    <td className="py-1.5">
                      <Pill state={s.state} />
                    </td>
                    <td className="py-1.5">
                      <Pill state={other.status[i]?.state ?? "unknown"} />
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-off-border">
                  <td className="py-1.5 text-muted-foreground">인스타그램</td>
                  <td className="py-1.5">
                    <Pill state={mine.sns.instagram ? "on" : "off"} />
                  </td>
                  <td className="py-1.5">
                    <Pill state={other.sns.instagram ? "on" : "off"} />
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-muted-foreground">네이버 블로그</td>
                  <td className="py-1.5">
                    <Pill state={mine.sns.blog ? "on" : "off"} />
                  </td>
                  <td className="py-1.5">
                    <Pill state={other.sns.blog ? "on" : "off"} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title="손님이 고른 키워드 TOP 5">
            <div className="mt-3 grid grid-cols-2 gap-4">
              {[mine, other].map((side, idx) => (
                <div key={side.store.placeId} className={`rounded-tile px-4 py-3 ${idx === 0 ? "bg-on-bg" : "bg-off-bg"}`}>
                  <p className={`line-clamp-1 text-sm font-bold ${idx === 0 ? "text-primary" : ""}`}>{side.store.name}</p>
                  <ol className="mt-2 flex flex-col gap-1.5 text-[13px]">
                    {side.topKeywords.map((k, i) => (
                      <li key={k} className="flex gap-2">
                        <span className="font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                        <span className="truncate">{k}</span>
                      </li>
                    ))}
                    {side.topKeywords.length === 0 && <li className="text-muted-foreground">키워드 정보 없음</li>}
                  </ol>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-11 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href={`/compare/${encodeURIComponent(mine.store.placeId)}`}
          className="inline-flex h-[60px] w-[220px] items-center justify-center rounded-xl border border-input bg-card text-[17px] font-bold text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          다른 가게로 비교
        </Link>
        <Link
          href={`/consult/${encodeURIComponent(mine.store.placeId)}?with=${encodeURIComponent(other.store.placeId)}`}
          className="inline-flex h-[60px] w-[240px] items-center justify-center gap-1 rounded-xl bg-primary text-[17px] font-bold text-primary-foreground transition hover:brightness-110"
        >
          상담 시작하기 <ArrowRight className="size-[18px]" aria-hidden />
        </Link>
      </div>
    </>
  );
}
