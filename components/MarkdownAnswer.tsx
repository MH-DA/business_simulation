"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

// LLM 답변(마크다운)을 화면용으로 바꾼다. HTML 태그는 그대로 글자로 보여준다(react-markdown 기본값, 스크립트 삽입 방지).
// 줄바꿈 한 번도 화면에서 줄바꿈으로 보여준다(remark-breaks). LLM이 문단 사이에 빈 줄을 빼먹는 경우가 많다.
// 제목(#)은 답변 카드 안에서 너무 커지지 않게 본문보다 조금 큰 굵은 글씨로 맞춘다.
const components: Components = {
  h1: ({ children }) => <p className="mt-5 mb-2 text-lg font-bold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mt-5 mb-2 text-lg font-bold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mt-4 mb-1.5 text-base font-bold first:mt-0">{children}</p>,
  h4: ({ children }) => <p className="mt-4 mb-1.5 font-bold first:mt-0">{children}</p>,
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-tile border-l-4 border-primary bg-secondary px-4 py-2">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">{children}</code>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border bg-secondary px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border px-3 py-2">{children}</td>,
};

export function MarkdownAnswer({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
