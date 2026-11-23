/**
 * 방명록 카드 손글씨 글꼴 (온글잎 박다현체). @font-face는 style.css 맨 위에 있다.
 * 파일이 2MB 정도라 사이트 첫 로딩에는 넣지 않고, 방명록 방에 들어갈 때 미리 받아 둔다.
 * 라이선스상 글꼴 파일(public/fonts/Ownglyph_PDH-Rg.ttf)은 원본 그대로 쓴다: public/fonts/Ownglyph_PDH-LICENSE.txt
 */
export const GUESTBOOK_FONT_FAMILY = 'OwnglyphPDH'

let preloading: Promise<unknown> | undefined

/** 방명록 방에 들어가는 순간 부른다. 여러 번 불러도 한 번만 받는다. 실패해도 기본 글꼴로 보일 뿐이다. */
export function preloadGuestbookFont(): void {
  if (preloading || typeof document === 'undefined' || !document.fonts) return
  preloading = document.fonts.load(`1em ${GUESTBOOK_FONT_FAMILY}`, '방명록').catch(() => {
    preloading = undefined
  })
}
