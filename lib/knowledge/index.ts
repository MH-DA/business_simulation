import { promises as fs } from "node:fs";
import path from "node:path";
import type { Guardrail, KnowledgeChunk } from "../../types/index.ts";

export { searchKnowledge } from "./search.ts";
export type { KnowledgeQuery, SignalTier } from "./search.ts";

export type KnowledgeBase = { chunks: KnowledgeChunk[]; guardrails: Guardrail[] };

const DIR = path.join(process.cwd(), "data", "knowledge");

async function read<T>(file: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(DIR, file), "utf-8")) as T;
}

let cached: Promise<KnowledgeBase> | null = null;

// data/knowledge 의 JSON이 원본이다. 개발 중에는 JSON을 고치면 바로 반영되도록 캐시하지 않는다.
export function loadKnowledge(): Promise<KnowledgeBase> {
  if (process.env.NODE_ENV !== "production") return load();
  cached ??= load();
  return cached;
}

async function load(): Promise<KnowledgeBase> {
  const [chunks, guardrails] = await Promise.all([
    read<KnowledgeChunk[]>("principles.json"),
    read<Guardrail[]>("guardrails.json"),
  ]);
  return { chunks, guardrails };
}
