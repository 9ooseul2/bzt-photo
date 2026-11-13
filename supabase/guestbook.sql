-- =====================================================================
-- bzt-photo 방명록 표 + 보안 규칙
-- Supabase 화면 왼쪽 메뉴 SQL Editor > New query 에 전체를 붙여넣고 Run.
-- 여러 번 실행해도 안전하다 (이미 있으면 건너뛰거나 다시 만든다).
-- =====================================================================

-- 1. 방명록 표
create table if not exists public.guestbook_entries (
  id         uuid primary key default gen_random_uuid(),
  nickname   text not null check (char_length(btrim(nickname)) between 1 and 12),
  message    text not null check (char_length(btrim(message)) between 1 and 200),
  color      text not null check (color in ('butter', 'pink', 'sage', 'lavender')),
  client_id  uuid not null,            -- 같은 브라우저 구분용 (도배 방지). 방문자에게는 보이지 않음
  created_at timestamptz not null default now()
);

create index if not exists guestbook_entries_created_at_idx on public.guestbook_entries (created_at desc);
create index if not exists guestbook_entries_client_idx on public.guestbook_entries (client_id, created_at desc);

-- 2. 보안(RLS) 켜기: 아래 규칙에 맞는 요청만 통과
alter table public.guestbook_entries enable row level security;

-- 3. 방문자 권한: 읽기와 쓰기만. 고치기/지우기는 권한 자체가 없음
revoke all on public.guestbook_entries from anon, authenticated;
grant select (id, nickname, message, color, created_at) on public.guestbook_entries to anon, authenticated;
grant insert (id, nickname, message, color, client_id) on public.guestbook_entries to anon, authenticated;

drop policy if exists "guestbook: anyone can read" on public.guestbook_entries;
create policy "guestbook: anyone can read"
  on public.guestbook_entries for select to anon, authenticated using (true);

drop policy if exists "guestbook: anyone can write" on public.guestbook_entries;
create policy "guestbook: anyone can write"
  on public.guestbook_entries for insert to anon, authenticated with check (true);

-- 4. 도배 방지: 같은 브라우저는 30초에 1번, 전체는 1분에 30개까지
create or replace function public.guestbook_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.guestbook_entries
    where client_id = new.client_id and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'GUESTBOOK_TOO_FAST';
  end if;

  if (select count(*) from public.guestbook_entries where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'GUESTBOOK_BUSY';
  end if;

  new.nickname := btrim(new.nickname);
  new.message := btrim(new.message);
  new.created_at := now();   -- 작성 시각은 서버 시계로
  return new;
end;
$$;

drop trigger if exists guestbook_before_insert on public.guestbook_entries;
create trigger guestbook_before_insert
  before insert on public.guestbook_entries
  for each row execute function public.guestbook_before_insert();

-- 관리자 메모
-- - 부적절한 글 지우기: Table Editor > guestbook_entries 에서 해당 줄 선택 > Delete
-- - 도배 기준 바꾸기: 위 함수의 '30 seconds', '1 minute', 30 숫자를 고친 뒤 이 파일을 다시 Run
