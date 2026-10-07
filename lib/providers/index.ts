import type { PlaceDataProvider } from "./types";
import { MockProvider } from "./mock";

export type { PlaceDataProvider } from "./types";
export { MockProvider } from "./mock";

// 6단계(실제 데이터 연결)에서 CrawlerProvider를 추가하고,
// 실패하거나 오래 걸리면 MockProvider로 넘어가는 폴백 체인으로 바꾼다.
export function getProvider(): PlaceDataProvider {
  return new MockProvider();
}
