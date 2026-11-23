-- =====================================================================
-- bzt-photo 방명록: 글을 남길 때의 개구리 모습(appearance) 칸
-- Supabase SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
-- (2026-11 운영자가 실행 완료. 저장소에는 기록용으로 남겨 둔다)
--
-- 저장 모양: { "color": "green", "accessories": ["cap", "scarf"] }
-- 예전 글은 appearance가 비어 있고(null), 화면에서는 기본 초록 개구리로 보인다.
--
-- ※ 나중에 몸 색상이나 악세서리 종류가 바뀌면 아래 허용 목록도 함께 고쳐야 한다.
--   기준 목록: src/characters/customization/types.ts 의 FROG_COLORS, AccessoryId
--   (고치지 않으면 새 악세서리를 착용한 사람의 글 저장이 거절된다)
-- =====================================================================

alter table public.guestbook_entries
  add column if not exists appearance jsonb;
alter table public.guestbook_entries
  drop constraint if exists guestbook_entries_appearance_check;
alter table public.guestbook_entries
  add constraint guestbook_entries_appearance_check check (
    appearance is null or (
      jsonb_typeof(appearance) = 'object'
      and octet_length(appearance::text) <= 400
      and appearance ->> 'color' in ('green', 'yellow', 'blue', 'purple')
      and jsonb_typeof(appearance -> 'accessories') = 'array'
      and jsonb_array_length(appearance -> 'accessories') <= 12
      and (appearance -> 'accessories') <@ '["beanie","headset","cap","glasses","sunglasses","bubble_gum","scarf","crossbody_bag","bow_tie","balloon","americano","book"]'::jsonb
    )
  );
grant select (appearance) on public.guestbook_entries to anon, authenticated;
grant insert (appearance) on public.guestbook_entries to anon, authenticated;
