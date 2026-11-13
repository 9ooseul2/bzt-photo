-- =====================================================================
-- 작성자가 자기 글을 지울 수 있게 하기 (guestbook.sql 실행 후 추가로 실행)
-- 원리: 글을 쓸 때 브라우저마다 정해진 비밀 번호(client_id)를 함께 저장해 두고,
--       지울 때 같은 번호를 보내온 요청만 허락한다. 이 번호는 다른 방문자에게 보이지 않는다.
-- 한계: 다른 기기/브라우저에서 들어오거나 브라우저 기록을 지우면 그 글은 더 이상 지울 수 없다.
-- 여러 번 실행해도 안전하다.
-- =====================================================================

grant delete on public.guestbook_entries to anon, authenticated;

drop policy if exists "guestbook: author can delete" on public.guestbook_entries;
create policy "guestbook: author can delete"
  on public.guestbook_entries for delete to anon, authenticated
  using (
    client_id::text = coalesce(current_setting('request.headers', true)::json ->> 'x-guestbook-client', '')
  );
