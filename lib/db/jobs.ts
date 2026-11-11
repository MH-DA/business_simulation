import type { Job, JobStatus } from "../../types/index.ts";
import { getSql } from "./index.ts";

// jobs 표 읽기·쓰기. 분석 요청 한 건의 상태를 적어 둔다. (db/schema.sql)
// 서버 메모리가 아니라 DB에 적으므로, 배포 환경에서 요청마다 다른 서버가 받아도 같은 상태를 본다.

type JobRow = { job_id: string; place_id: string; status: JobStatus; error: string | null; created_at: Date };

function toJob(row: JobRow): Job {
  return {
    jobId: row.job_id,
    placeId: row.place_id,
    status: row.status,
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at.toISOString(),
  };
}

export async function insertJob(placeId: string, status: JobStatus, error?: string): Promise<Job> {
  const sql = getSql();
  const rows = await sql<JobRow[]>`
    insert into jobs (place_id, status, error)
    values (${placeId}, ${status}, ${error ?? null})
    returning job_id, place_id, status, error, created_at
  `;
  return toJob(rows[0]);
}

// jobId 모양이 uuid가 아니면 DB 오류가 나므로, 먼저 걸러서 "없음"으로 처리한다.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function selectJob(jobId: string): Promise<Job | undefined> {
  if (!UUID.test(jobId)) return undefined;
  const sql = getSql();
  const rows = await sql<JobRow[]>`
    select job_id, place_id, status, error, created_at from jobs where job_id = ${jobId}
  `;
  return rows[0] ? toJob(rows[0]) : undefined;
}

// 수집·분석이 진행되면 상태를 바꾼다. (자동 수집 단계에서 사용)
export async function updateJobStatus(jobId: string, status: JobStatus, error?: string): Promise<Job | undefined> {
  if (!UUID.test(jobId)) return undefined;
  const sql = getSql();
  const rows = await sql<JobRow[]>`
    update jobs set status = ${status}, error = ${error ?? null}, updated_at = now()
    where job_id = ${jobId}
    returning job_id, place_id, status, error, created_at
  `;
  return rows[0] ? toJob(rows[0]) : undefined;
}
