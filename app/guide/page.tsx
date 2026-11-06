import Link from "next/link";
import { Panel, SiteHeader } from "@/components/SiteHeader";

// 시작 화면의 "URL 찾는 방법" 모달과 같은 내용을 따로 열 수 있게 둔 페이지
const GUIDE = [
  { title: "네이버에서 우리 가게를 검색해요", body: "가게 이름과 지역을 함께 검색하면 더 쉽게 찾을 수 있어요." },
  { title: "우리 가게의 플레이스 상세 페이지를 열어요", body: "검색 결과에서 주소와 전화번호를 확인하고 우리 가게를 선택해 주세요." },
  { title: "주소창의 URL 또는 공유 링크를 복사해요", body: "시작 화면으로 돌아와 입력창에 붙여 넣으면 준비가 끝나요." },
];

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <Panel className="flex min-h-[720px] flex-col items-center justify-center">
        <h1 className="text-[32px] font-bold">네이버 플레이스 URL 찾는 방법</h1>
        <p className="mt-2 text-muted-foreground">우리 가게의 상세 페이지 주소를 복사해 주세요.</p>
        <ol className="mt-10 flex w-full max-w-[560px] flex-col gap-4">
          {GUIDE.map((g, i) => (
            <li key={g.title} className="flex gap-5 rounded-card border bg-card p-6">
              <span className="text-xl font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-bold">{g.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{g.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <Link
          href="/"
          className="mt-10 inline-flex h-[60px] w-[268px] items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-primary-foreground"
        >
          우리 가게 분석하러 가기
        </Link>
      </Panel>
    </>
  );
}
