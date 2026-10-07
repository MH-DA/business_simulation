import type { Job } from "@/types";

// 메모리에 보관하는 간단한 작업 목록. 서버를 다시 켜면 사라진다. (7단계 이후 DB로 교체 가능)
const g = globalThis as unknown as { __jobs?: Map<string, Job> };
const jobs = (g.__jobs ??= new Map<string, Job>());

export function createJob(placeId: string, status: Job["status"], error?: string): Job {
  const job: Job = { jobId: crypto.randomUUID(), placeId, status, error, createdAt: new Date().toISOString() };
  jobs.set(job.jobId, job);
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}
