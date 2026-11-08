export type PortalAction = 'enter-guestbook' | 'return-to-gallery' | 'open-gift-shop' | 'go-to-room'

/** Data-only portal placement so changing destinations never touches scene code. */
export interface PortalConfig {
  id: string
  wallId: string
  /** Horizontal offset from the wall centre, measured along the wall's local X axis. */
  offsetX: number
  label: string
  action: PortalAction
  /** Required by room-to-room portals and intentionally optional for local actions. */
  targetRoomId?: string
}
