import type { FrogCustomization } from '../characters/customization/types.ts'

export const GUESTBOOK_COLORS = ['butter', 'pink', 'sage', 'lavender'] as const
export type GuestbookColor = (typeof GUESTBOOK_COLORS)[number]

/** 메모 색 값. 카드의 마스킹테이프와 글쓰기 카드의 색 견본에 쓴다. */
export const GUESTBOOK_COLOR_VALUES: Readonly<Record<GuestbookColor, { label: string; value: string }>> = {
  butter: { label: '노랑', value: '#f7df88' },
  pink: { label: '분홍', value: '#eeb4bd' },
  sage: { label: '초록', value: '#b8cda8' },
  lavender: { label: '보라', value: '#c9c0e1' },
}

export interface GuestbookPlacement {
  slotId: string
  wallId: string
}

export interface GuestbookEntry {
  color: GuestbookColor
  createdAt: string
  id: string
  message: string
  nickname: string
  placement?: GuestbookPlacement
  /** 글을 남길 때의 개구리 모습. 예전 글·샘플 글에는 없다 (기본 초록 개구리로 보여 준다). */
  appearance?: FrogCustomization
}
