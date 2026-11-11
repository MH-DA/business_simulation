-- 사장님 마케팅 도우미 DB 스키마 (Supabase PostgreSQL)
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run.
-- 여러 번 실행해도 안전하다 (이미 있으면 건너뛴다). 표를 지우고 다시 만들 때는 맨 아래 "초기화"를 본다.
--
-- 접근 원칙
--  - 웹 서버만 DB에 접속한다 (DATABASE_URL, 서버에서만 사용). 브라우저는 DB에 직접 접근하지 않는다.
--  - 모든 표에 RLS(행 단위 보안)를 켜고 정책은 만들지 않는다. 그러면 Supabase Data API(anon, authenticated)는
--    어떤 행도 읽거나 쓸 수 없다. 서버 접속(postgres 역할)은 RLS를 건너뛰므로 영향이 없다.
--  - 그래도 한 번 더 막기 위해 anon, authenticated 역할의 권한을 회수한다.
--
-- 표 6개
--  1. users          회원 (아이디, 비밀번호 해시, 사용자 이름)
--  2. places         가게 (place_id 기준 한 줄)
--  3. user_places    회원 ↔ 가게 연결 (내 가게)
--  4. snapshots      수집 결과 한 장 = 한 줄 (CollectedPlace 전체를 jsonb로 저장)
--  5. jobs           분석 작업 상태
--  6. owner_answers  확인 카드에 대한 사장님 답변

-- 1. 회원 -----------------------------------------------------------------
-- 비밀번호는 평문으로 저장하지 않는다. 서버가 scrypt로 해시한 문자열만 password_hash에 넣는다. (lib/users.ts)
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  login_id      text not null,
  password_hash text not null,
  display_name  text not null,
  created_at    timestamptz not null default now(),
  constraint users_login_id_len check (char_length(login_id) between 3 and 40),
  constraint users_display_name_len check (char_length(display_name) between 1 and 30)
);
-- 아이디는 대소문자를 구분하지 않고 하나만 허용한다 (Abc와 abc는 같은 아이디).
create unique index if not exists users_login_id_key on users (lower(login_id));

-- 2. 가게 -----------------------------------------------------------------
-- 가게의 고정 정보. 바뀌는 값(별점, 리뷰 수 등)은 snapshots에 시점별로 쌓는다.
-- tracked_keyword: 추적 키워드("노원 헬스장"). 한 번 정하면 바꾸지 않는다. (README "경쟁사 분석 흐름")
create table if not exists places (
  place_id        text primary key,
  name            text not null,
  industry        text not null,
  category        text,
  address         text,
  tracked_keyword text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint places_industry_check check (industry in ('음식점', '카페', '공방', '헬스장', '스터디카페'))
);
create index if not exists places_industry_idx on places (industry);

-- 3. 회원 ↔ 가게 -----------------------------------------------------------
-- 한 회원이 여러 가게를, 한 가게를 여러 회원이 연결할 수 있다.
create table if not exists user_places (
  user_id    uuid not null references users (id) on delete cascade,
  place_id   text not null references places (place_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists user_places_place_idx on user_places (place_id);

-- 4. 스냅샷 ---------------------------------------------------------------
-- 수집 결과 한 장. payload에 types/index.ts의 CollectedPlace 전체(가게 정보, 키워드, 리뷰)를 그대로 넣는다.
-- 찾고 거르는 데 쓰는 값(place_id, collected_at, source)만 열로 따로 둔다.
-- schema_version: payload 모양이 바뀌면 올린다. 옛 스냅샷을 읽을 때 구분하는 용도.
-- 같은 가게를 같은 수집 시각으로 다시 올리면 새 줄이 아니라 그 줄을 덮어쓴다 (업로드를 여러 번 해도 안전).
create table if not exists snapshots (
  id             uuid primary key default gen_random_uuid(),
  place_id       text not null references places (place_id) on delete cascade,
  collected_at   timestamptz not null,
  source         text not null,
  schema_version integer not null default 1,
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  constraint snapshots_source_check check (source in ('crawler', 'octoparse', 'manual', 'mock', 'demo')),
  constraint snapshots_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint snapshots_place_time_key unique (place_id, collected_at)
);
-- "가게의 가장 최근 스냅샷"을 빠르게 찾는다.
create index if not exists snapshots_place_time_idx on snapshots (place_id, collected_at desc);

-- 5. 분석 작업 ------------------------------------------------------------
-- types/index.ts의 JobStatus와 같은 값. place_id에 외래키를 걸지 않는다 (아직 수집 전인 가게도 작업이 생긴다).
create table if not exists jobs (
  job_id     uuid primary key default gen_random_uuid(),
  place_id   text not null,
  status     text not null default 'queued',
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_status_check check (status in ('queued', 'collecting', 'analyzing', 'done', 'failed', 'needs_collection'))
);
create index if not exists jobs_place_idx on jobs (place_id, created_at desc);
create index if not exists jobs_status_idx on jobs (status) where status in ('queued', 'collecting', 'analyzing');

-- 6. 사장님 답변 ----------------------------------------------------------
-- 확인 카드(card_id)의 질문과 사장님이 고른 답. 로그인 전 답변도 받을 수 있게 user_id는 비어 있을 수 있다.
create table if not exists owner_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users (id) on delete set null,
  place_id    text not null,
  card_id     text not null,
  question    text not null,
  answer      text not null,
  answered_at timestamptz not null default now()
);
create index if not exists owner_answers_place_idx on owner_answers (place_id, answered_at desc);

-- RLS 켜기 ----------------------------------------------------------------
-- 정책(policy)을 하나도 만들지 않으므로, Data API로는 모든 행이 막힌다.
alter table users          enable row level security;
alter table places         enable row level security;
alter table user_places    enable row level security;
alter table snapshots      enable row level security;
alter table jobs           enable row level security;
alter table owner_answers  enable row level security;

-- Data API 역할의 권한 회수 (Supabase에만 있는 역할이라, 있을 때만 실행한다)
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table users, places, user_places, snapshots, jobs, owner_answers from %I', r);
    end if;
  end loop;
end $$;

-- 확인: 아래를 실행하면 6개 표 모두 rls_enabled = true 여야 한다.
--   select relname as "table", relrowsecurity as rls_enabled
--   from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;

-- 초기화 (표와 데이터를 전부 지운다. 필요할 때만 주석을 풀어서 실행)
-- drop table if exists owner_answers, jobs, snapshots, user_places, places, users cascade;
