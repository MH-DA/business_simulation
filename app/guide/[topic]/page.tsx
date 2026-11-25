import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel, SiteHeader } from "@/components/SiteHeader";
import { getGuide, SMARTPLACE_GUIDES } from "@/lib/smartplace-guides";

// 스마트플레이스 설정 가이드: /guide/photo, /guide/reservation, /guide/coupon, /guide/hours, /guide/intro
// 시안: docs/design/guide-04-photo.png 외 4장 (제목 → STEP 01·02 카드 두 장 → 마무리 안내)

export function generateStaticParams() {
  return SMARTPLACE_GUIDES.map((g) => ({ topic: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const guide = getGuide((await params).topic);
  return { title: guide ? guide.title : "설정 가이드" };
}

export default async function SmartplaceGuidePage({ params }: { params: Promise<{ topic: string }> }) {
  const guide = getGuide((await params).topic);
  if (!guide) notFound();

  return (
    <>
      <SiteHeader />
      <Panel>
        <div className="sm:-mx-[46px]">
          <h1 className="text-[28px] font-bold leading-tight sm:text-[40px]">{guide.title}</h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">{guide.subtitle}</p>

          <ol className="mt-10 grid gap-5 sm:mt-14 lg:grid-cols-2">
            {guide.steps.map((s, i) => (
              <li key={s.title} className="rounded-card bg-card p-5">
                <p className="text-base font-bold text-primary">STEP {String(i + 1).padStart(2, "0")}</p>
                <h2 className="mt-1.5 text-2xl font-bold">{s.title}</h2>
                <p className="mt-1 text-base text-muted-foreground">{s.body}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.alt}
                  width={543}
                  height={234}
                  className="mt-3 w-full rounded-tile border"
                />
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-2 lg:grid-cols-2">
            <p className="text-lg font-bold text-primary">{guide.finish}</p>
            <p className="text-sm text-muted-foreground">※ 실제 화면에서 업체 식별 정보는 가렸습니다.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}
