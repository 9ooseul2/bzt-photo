import type { PortalConfig } from './types.ts'

/** Outer opening dimensions keep the portal slightly smaller than the 3.8 m main entrance. */
export const PORTAL_WIDTH = 2.35
export const PORTAL_HEIGHT = 3.15
/** Gives the simple wood arch enough presence without protruding far from its wall. */
export const PORTAL_FRAME_WIDTH = 0.18
export const PORTAL_FRAME_THICKNESS = 0.14
/** Prevents z-fighting while keeping the back of the frame visually close to its wall. */
export const PORTAL_WALL_GAP = 0.028
/** Floating labels sit clear of the arch crown and remain readable over the wall. */
export const PORTAL_LABEL_HEIGHT = 3.58
/** Visitors stop at this comfortable viewing distance before turning toward a portal. */
export const APPROACH_DISTANCE = 1.55
export const PORTAL_ALREADY_NEAR_DISTANCE = 0.62
/** Extra clearance checks handle an unusual door location near an obstacle. */
export const APPROACH_RETRY_INCREMENT = 0.35
export const APPROACH_RETRY_COUNT = 3
/** Slow, narrow changes preserve the gallery's calm lighting language. */
export const PORTAL_PULSE_PERIOD = 5.2
export const PORTAL_BASE_OPACITY = 0.78
export const PORTAL_PULSE_AMPLITUDE = 0.045
export const PORTAL_LABEL_FLOAT_AMPLITUDE = 0.05
export const PORTAL_LABEL_FLOAT_PERIOD = 3.2

export const EXHIBITION_PORTALS: PortalConfig[] = [
  { id: 'to-room-2', wallId: 'wall-exterior-north', offsetX: -12.8, label: '전시실 2', action: 'go-to-room', targetRoomId: 'room-2' },
]

export const GUESTBOOK_PORTALS: PortalConfig[] = [
  // From inside while facing south, positive wall-local X appears on the viewer's left.
  { id: 'to-gallery', wallId: 'guestbook-wall-south', offsetX: 9, label: '전시실로 돌아가기', action: 'return-to-gallery' },
  { id: 'gift-shop', wallId: 'guestbook-wall-south', offsetX: -9, label: 'GIFT SHOP', action: 'open-gift-shop' },
]
