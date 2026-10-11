// LLM 출력의 표시 줄([[근거: ...]], [[확인: ...]])을 본문에서 떼어낸다.

// 스트리밍 중에 "[[" 로 시작하는 줄은 화면에 내보내지 않는다. 표시 줄이 사장님 화면에 새어 나가지 않게 한다.
// "[동네명] ..." 처럼 "[" 하나로 시작하는 본문 줄은 그대로 보여준다.
export class MarkerFilter {
  private atLineStart = true;
  private pending = ""; // 줄 맨 앞의 "[" 를 다음 글자를 볼 때까지 잠깐 붙들어 둔다
  private holding = false; // "[[" 로 시작한 표시 줄을 버리는 중

  push(chunk: string): string {
    let out = "";
    for (const ch of chunk) {
      if (this.holding) {
        if (ch === "\n") {
          this.holding = false; // 표시 줄의 줄바꿈도 함께 버린다
          this.atLineStart = true;
        }
        continue;
      }
      if (this.pending) {
        this.pending = "";
        if (ch === "[") {
          this.holding = true;
          continue;
        }
        out += "[";
      }
      if (this.atLineStart && ch === "[") {
        this.pending = "[";
        this.atLineStart = false;
        continue;
      }
      this.atLineStart = ch === "\n";
      out += ch;
    }
    return out;
  }
}

export type ParsedOutput = {
  answer: string;
  usedIds: string[];
  confirm?: { question: string; buttons: string[] };
};

const MARKER = /^\s*\[\[\s*(근거|확인)\s*:\s*(.*?)\s*\]\]\s*$/;

export function parseOutput(full: string): ParsedOutput {
  const body: string[] = [];
  const usedIds: string[] = [];
  let confirm: ParsedOutput["confirm"];

  for (const line of full.split("\n")) {
    const m = MARKER.exec(line);
    if (!m) {
      body.push(line);
      continue;
    }
    if (m[1] === "근거") {
      usedIds.push(...m[2].split(/[,\s]+/).filter((s) => /^K-[A-Za-z]+-\d+$/.test(s)));
    } else {
      const [question, ...buttons] = m[2].split("|").map((s) => s.trim()).filter(Boolean);
      if (question) confirm = { question, buttons: buttons.slice(0, 3) };
    }
  }
  return { answer: body.join("\n").trim(), usedIds: [...new Set(usedIds)], confirm };
}
