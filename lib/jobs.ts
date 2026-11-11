import type { Job } from "@/types";
import { insertJob, selectJob, updateJobStatus } from "@/lib/db/jobs";
import { isMockMode } from "@/lib/places";

// 분석 작업 상태 보관.
//  - 실제 데이터 모드(USE_MOCK_DATA=false): DB의 jobs 표에 적는다. (배포 환경에서 서버가 여러 대여도 같은 상태를 본다)
//  - Mock 모드: DB 없이도 개발할 수 있게 서버 메모리에 둔다. 서버를 다시 켜면 사라진다.
const g = globalThis as unknown as { __jobs?: Map<string, Job> };
const memory = (g.__jobs ??= new Map<string, Job>());

export async function createJob(placeId: string, status: Job["status"], error?: string): Promise<Job> {
  if (!isMockMode()) return insertJob(placeId, status, error);
  const job: Job = { jobId: crypto.randomUUID(), placeId, status, error, createdAt: new Date().toISOString() };
  memory.set(job.jobId, job);
  return job;
}

export async function getJob(jobId: string): Promise<Job | undefined> {
  if (!isMockMode()) return selectJob(jobId);
  return memory.get(jobId);
}

export async function setJobStatus(jobId: string, status: Job["status"], error?: string): Promise<Job | undefined> {
  if (!isMockMode()) return updateJobStatus(jobId, status, error);
  const job = memory.get(jobId);
  if (!job) return undefined;
  const next = { ...job, status, error };
  memory.set(jobId, next);
  return next;
}
