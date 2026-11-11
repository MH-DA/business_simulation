// 변환기가 만든 JSON(data/places/<가게번호>.json)을 DB의 snapshots 표에 넣는다.
//
// 사용 (저장소 폴더에서, .env.local 에 DATABASE_URL 이 있어야 한다)
//   node --env-file=.env.local scripts/upload-snapshots.ts data/places/1234567.json
//   node --env-file=.env.local scripts/upload-snapshots.ts data/places/1234567.json data/places/7654321.json
//   node --env-file=.env.local scripts/upload-snapshots.ts --all          # data/places 의 실제 수집 파일 전부
//   node scripts/upload-snapshots.ts --dry-run data/places/1234567.json   # DB에 접속하지 않고 확인만
//
// - 같은 가게를 같은 수집 시각으로 다시 올리면 새 줄이 아니라 그 줄을 덮어쓴다. 여러 번 실행해도 안전하다.
// - source 가 "mock" 인 파일(가짜 샘플)은 올리지 않는다.
import { promises as fs } from "node:fs";
import path from "node:path";
import { closeSql } from "../lib/db/index.ts";
import { parseSnapshotPayload, saveSnapshot } from "../lib/db/snapshots.ts";

const PLACES_DIR = path.join(process.cwd(), "data", "places");

async function allRealFiles(): Promise<string[]> {
  const names = (await fs.readdir(PLACES_DIR)).filter((f) => f.endsWith(".json") && !f.startsWith("sample"));
  return names.map((n) => path.join(PLACES_DIR, n));
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const files = args.filter((a) => !a.startsWith("--"));
  const targets = all ? [...files, ...(await allRealFiles())] : files;
  if (targets.length === 0) {
    console.error("올릴 파일이 없어요. 예: node --env-file=.env.local scripts/upload-snapshots.ts data/places/1234567.json (전부: --all)");
    return 1;
  }

  let failed = 0;
  for (const file of targets) {
    try {
      const place = parseSnapshotPayload(JSON.parse(await fs.readFile(file, "utf-8")));
      if (place.source === "mock") throw new Error('source 가 "mock" 인 가짜 데이터라 올리지 않아요');
      const summary = `${place.store.name} (${place.store.placeId}, ${place.store.industry}) 키워드 ${place.keywordStats.length}개, 리뷰 ${place.reviews.length}개, 수집 ${place.collectedAt}`;
      if (dryRun) {
        console.log(`[확인] ${summary}`);
        continue;
      }
      const saved = await saveSnapshot(place);
      console.log(`[${saved.created ? "새로 저장" : "덮어씀"}] ${summary}`);
    } catch (e) {
      failed += 1;
      console.error(`[실패] ${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(failed ? `${targets.length}개 중 ${failed}개 실패` : `${targets.length}개 완료${dryRun ? " (확인만, 저장 안 함)" : ""}`);
  return failed ? 1 : 0;
}

main()
  .then((code) => closeSql().then(() => process.exit(code)))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    return closeSql().then(() => process.exit(1));
  });
