// LLM 출력의 표시 줄([[근거: ...]], [[확인: ...]])을 본문에서 떼어낸다.

// 스트리밍 중에 "[" 로 시작하는 줄은 화면에 내보내지 않고 붙들어 둔다. 표시 줄이 사장님 화면에 새어 나가지 않게 한다.
export class MarkerFilter {
  private atLineStart = true;
  private holding = false;

  push(chunk: string): string {
    let out = "";
    for (const ch of chunk) {
      if (this.atLineStart) {
        this.holding = ch === "[";
        this.atLineStart = false;
      }
      if (ch === "\n") {
        this.atLineStart = true;
        if (this.holding) {
          this.holding = false;
          continue; // 표시 줄의 줄바꿈도 함께 버린다
        }
      }
      if (!this.holding) out += ch;
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
