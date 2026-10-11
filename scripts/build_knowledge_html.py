"""data/knowledge/*.json → docs/knowledge/principles.html (보기용)

원본은 JSON이다. 지식을 고칠 때는 JSON만 수정하고 이 스크립트로 HTML을 다시 만든다.
    python3 scripts/build_knowledge_html.py
"""
import html
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRINCIPLES = ROOT / "data/knowledge/principles.json"
GUARDRAILS = ROOT / "data/knowledge/guardrails.json"
OUT = ROOT / "docs/knowledge/principles.html"

INDUSTRIES = ["음식점", "카페", "공방", "헬스장", "스터디카페"]
IND_CLASS = {"음식점": "i-food", "카페": "i-cafe", "공방": "i-craft", "헬스장": "i-gym", "스터디카페": "i-study"}
STRENGTH_CLASS = {"강함": "s-strong", "중간": "s-mid", "혼재": "s-mixed"}
e = html.escape


def tags(items, cls):
    if not items:
        return '<span class="dim">—</span>'
    return "".join(f'<span class="tag {cls}">{e(x)}</span>' for x in items)


def examples(ex):
    if not ex:
        return '<span class="dim">업종 공통</span>'
    return "".join(
        f'<div class="ex" data-ind="{e(k)}"><span class="ind {IND_CLASS.get(k, "")}">{e(k)}</span>{e(v)}</div>'
        for k, v in ex.items()
    )


def detail(c):
    rows = [("원리와 근거", c.get("description")), ("플레이스 적용", c.get("placeApplication")),
            ("권장 행동", " / ".join(c.get("actions") or [])), ("주의", c.get("caution")),
            ("검색 태그", ", ".join(c.get("signalTypes") or []))]
    body = "".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in rows if v)
    return f'<details><summary>자세히</summary><dl>{body}</dl></details>'


def build():
    chunks = json.loads(PRINCIPLES.read_text(encoding="utf-8"))
    guards = json.loads(GUARDRAILS.read_text(encoding="utf-8"))
    cats = list(dict.fromkeys(c["category"] for c in chunks))
    cnt = Counter(c["strength"] for c in chunks)

    body = []
    for cat in cats:
        body.append(f'<tr class="cat-row"><th colspan="7">{e(cat)}</th></tr>')
        for c in (x for x in chunks if x["category"] == cat):
            body.append(f'''<tr data-strength="{e(c["strength"])}">
<td class="name"><b>{e(c["principle"])}</b><span class="en">{e(c.get("principleEn", ""))}</span><code>{e(c["id"])}</code></td>
<td><span class="badge {STRENGTH_CLASS[c["strength"]]}">{e(c["strength"])}</span></td>
<td>{tags(c["core"], "t-core")}</td><td>{tags(c["apply"], "t-app")}</td>
<td class="exs">{examples(c.get("examples"))}</td><td>{tags(c["signals"], "t-sig")}</td>
<td class="src">{e(c.get("source") or "—")}{detail(c)}</td></tr>''')

    guard_rows = "".join(f"<li><b>{e(g['id'])} {e(g['rule'])}</b> — {e(g['detail'])}</li>" for g in guards)
    ind_buttons = "".join(f'<button type="button" data-i="{i}" aria-pressed="false">{i}</button>' for i in INDUSTRIES)

    page = f'''<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>마케팅 지식베이스</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
:root{{--ink:#1E2A3A;--muted:#5F6B7A;--paper:#FAFBFC;--card:#FFF;--line:#DDE2E8;--row:#F1F4F7;
--strong:#2E7D5B;--strong-bg:#E4F2EA;--mid:#2F5F9E;--mid-bg:#E3ECF7;--mixed:#A86A12;--mixed-bg:#FBF0DC;--warn:#B23A3A;--warn-bg:#F8E3E3;
--core-bg:#E9EDF2;--app-bg:#E4F2EA;--sig-bg:#FBF0DC;--food:#B5482E;--cafe:#7A5230;--craft:#2E7D5B;--gym:#2F5F9E;--study:#5B4B9A}}
@media (prefers-color-scheme:dark){{:root{{--ink:#E4E9F0;--muted:#9AA6B4;--paper:#141A22;--card:#19212B;--line:#2C3642;--row:#1B232D;
--strong:#6CC49A;--strong-bg:#1C3329;--mid:#86AEE6;--mid-bg:#1D2B40;--mixed:#E3B15C;--mixed-bg:#3A2E17;--warn:#E88080;--warn-bg:#3D2020;
--core-bg:#26303C;--app-bg:#1C3329;--sig-bg:#3A2E17;--food:#F0957C;--cafe:#D4A77F;--craft:#6CC49A;--gym:#86AEE6;--study:#B3A6EC}}}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--paper);color:var(--ink);font-family:"Pretendard",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:14.5px;line-height:1.5;word-break:keep-all}}
main{{max-width:1440px;margin:0 auto;padding:40px 16px 64px}}
h1{{font-size:26px;margin:0 0 6px}} .sub{{color:var(--muted);margin:0 0 20px}}
.bar{{display:flex;flex-wrap:wrap;gap:10px 24px;align-items:center;margin-bottom:14px}}
.grp{{display:flex;gap:6px;flex-wrap:wrap;align-items:center}} .grp>span{{font-size:13px;color:var(--muted);margin-right:2px}}
.grp button{{font:inherit;font-size:13.5px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:4px 12px;border-radius:999px;cursor:pointer}}
.grp button[aria-pressed="true"]{{background:var(--ink);color:var(--paper);border-color:var(--ink)}}
.grp button:focus-visible,summary:focus-visible{{outline:2px solid var(--mid);outline-offset:2px}}
.key{{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted)}} .key span{{display:inline-flex;align-items:center;gap:5px}}
.key i{{width:12px;height:12px;border-radius:3px;display:inline-block}}
.table-wrap{{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--card)}}
table{{width:100%;border-collapse:collapse;min-width:1280px}}
th,td{{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line)}}
thead th{{font-size:12.5px;font-weight:600;color:var(--muted);background:var(--row)}}
.cat-row th{{font-size:14px;background:var(--paper);color:var(--ink);border-top:2px solid var(--ink);padding-top:14px}}
td.name b{{display:block;font-size:15px}} td.name .en{{display:block;font-size:12.5px;color:var(--muted)}}
td.name{{min-width:170px}} td.name code{{display:block;margin-top:2px;font-size:11.5px;color:var(--muted);white-space:nowrap}}
td.src{{font-size:12.5px;color:var(--muted);min-width:200px}} td.exs{{min-width:250px}}
.tag{{display:inline-block;padding:2px 8px;margin:0 4px 4px 0;border-radius:4px;font-size:13px;white-space:nowrap}}
.t-core{{background:var(--core-bg)}} .t-app{{background:var(--app-bg)}} .t-sig{{background:var(--sig-bg)}}
.ex{{font-size:13px;margin-bottom:4px;display:flex;gap:6px;align-items:baseline}}
.ind{{font-size:11.5px;font-weight:700;min-width:52px;flex:none}}
.i-food{{color:var(--food)}} .i-cafe{{color:var(--cafe)}} .i-craft{{color:var(--craft)}} .i-gym{{color:var(--gym)}} .i-study{{color:var(--study)}}
.badge{{display:inline-block;padding:1px 9px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap}}
.s-strong{{color:var(--strong);background:var(--strong-bg)}} .s-mid{{color:var(--mid);background:var(--mid-bg)}} .s-mixed{{color:var(--mixed);background:var(--mixed-bg)}}
.dim{{color:var(--muted);font-size:13px}}
details{{margin-top:6px}} summary{{cursor:pointer;color:var(--mid);font-size:12.5px}}
dl{{margin:6px 0 0;color:var(--ink);font-size:13px}} dt{{font-weight:600;color:var(--muted);margin-top:6px}} dd{{margin:2px 0 0}}
tr[data-hidden],.ex[data-hidden]{{display:none}}
.guard{{margin-top:24px;border:1px solid var(--warn);background:var(--warn-bg);border-radius:8px;padding:14px 18px}}
.guard h2{{font-size:15px;margin:0 0 8px;color:var(--warn)}} .guard ul{{margin:0;padding-left:18px}} .guard li{{margin-bottom:4px}}
footer{{margin-top:28px;font-size:12.5px;color:var(--muted)}}
</style></head><body><main>
<h1>마케팅 지식베이스</h1>
<p class="sub">RAG용 소비자 심리·실무 지식 · 원리 {len(chunks)}개 · 근거 강함 {cnt["강함"]} · 중간 {cnt["중간"]} · 혼재 {cnt["혼재"]} · 가드레일 {len(guards)}개 · {" · ".join(INDUSTRIES)}</p>
<div class="bar">
  <div class="grp" role="group" aria-label="근거 강도"><span>근거</span>
    <button type="button" data-f="all" aria-pressed="true">전체</button>
    <button type="button" data-f="강함" aria-pressed="false">강함</button>
    <button type="button" data-f="중간" aria-pressed="false">중간</button>
    <button type="button" data-f="혼재" aria-pressed="false">혼재</button>
  </div>
  <div class="grp" role="group" aria-label="업종 예시"><span>업종</span>
    <button type="button" data-i="all" aria-pressed="true">전체</button>{ind_buttons}
  </div>
  <div class="key"><span><i style="background:var(--core-bg)"></i>핵심 개념</span><span><i style="background:var(--app-bg)"></i>공통 적용</span><span><i style="background:var(--sig-bg)"></i>진단 신호</span></div>
</div>
<div class="table-wrap"><table>
<thead><tr><th>원리</th><th>근거</th><th>핵심 개념</th><th>공통 적용</th><th>업종별 예시</th><th>진단 신호</th><th>출처 · 자세히</th></tr></thead>
<tbody>{"".join(body)}</tbody></table></div>
<section class="guard"><h2>가드레일 (모든 답변에 항상 적용)</h2><ul>{guard_rows}</ul></section>
<footer>이 페이지는 <code>data/knowledge/principles.json</code>, <code>guardrails.json</code>에서 자동으로 만든 보기용입니다. 지식은 JSON을 고치고 <code>python3 scripts/build_knowledge_html.py</code>로 다시 만드세요. 근거 — 강함: 반복 확인 · 중간: 조건·출처 제한 · 혼재: 재현 엇갈림(단정 금지) · 출처는 원문 확인 필요</footer>
</main>
<script>
function wire(sel,attr,apply){{const bs=document.querySelectorAll(sel);bs.forEach(x=>x.addEventListener('click',()=>{{bs.forEach(y=>y.setAttribute('aria-pressed',y===x?'true':'false'));apply(x.dataset[attr]);}}));}}
wire('[data-f]','f',f=>document.querySelectorAll('tbody tr[data-strength]').forEach(r=>{{if(f==='all'||r.dataset.strength===f)r.removeAttribute('data-hidden');else r.setAttribute('data-hidden','')}}));
wire('[data-i]','i',i=>document.querySelectorAll('.ex').forEach(x=>{{if(i==='all'||x.dataset.ind===i)x.removeAttribute('data-hidden');else x.setAttribute('data-hidden','')}}));
</script></body></html>
'''
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} 생성: 원리 {len(chunks)}개, 가드레일 {len(guards)}개")


if __name__ == "__main__":
    build()
