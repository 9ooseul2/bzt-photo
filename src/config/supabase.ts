/**
 * Supabase(방명록 서버) 연결 정보.
 * 둘 다 "공개해도 되는 값"이라 코드에 그대로 둔다 (브라우저에서 누구나 볼 수 있는 값).
 * 보안은 키가 아니라 Supabase의 RLS 규칙(supabase/guestbook.sql)이 지킨다.
 * Secret / service_role 키는 절대 여기에 넣지 않는다.
 */
export const SUPABASE_URL = 'https://vpivqsbhlbfdbiozuhna.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_X9N8sF8omo6Buzzvq-i3xw_WL-XZg2I'
