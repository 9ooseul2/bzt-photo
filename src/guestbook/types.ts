export const GUESTBOOK_COLORS = ['butter', 'pink', 'sage', 'lavender'] as const
export type GuestbookColor = (typeof GUESTBOOK_COLORS)[number]

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
}
