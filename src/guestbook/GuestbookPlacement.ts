import type { GuestbookEntry, GuestbookPlacement } from './types.ts'
import { GUESTBOOK_PORTALS, PORTAL_FRAME_WIDTH, PORTAL_WIDTH } from '../scenes/portals/portalConfig.ts'

export const GUESTBOOK_ROOM_DIMENSIONS = { width: 26, depth: 20, wallHeight: 6.4 }
export const GUESTBOOK_POSTIT_SIZE = 0.92

interface WallSlots {
  columns: number
  id: string
  rows: number
}

const WALLS: readonly WallSlots[] = [
  { id: 'north', columns: 14, rows: 5 },
  { id: 'east', columns: 11, rows: 5 },
  { id: 'south', columns: 4, rows: 5 },
  { id: 'west', columns: 11, rows: 5 },
]

// These retain visual breathing room around 0.92 m notes while filling each available wall evenly.
const HORIZONTAL_SPACING = 1.5
const VERTICAL_SPACING = 1.18
const FIRST_ROW_HEIGHT = 1
const SOUTH_PORTAL_MARGIN = 0.08
const warnedPortalSlots = new Set<string>()

export const GUESTBOOK_CAPACITY = WALLS.reduce((total, wall) => total + wall.columns * wall.rows, 0)

export function getGuestbookSlotIds(): readonly string[] {
  return WALLS.flatMap((wall) =>
    Array.from({ length: wall.columns * wall.rows }, (_, index) => `${wall.id}-${index}`),
  )
}

export function assignGuestbookPlacements(entries: readonly GuestbookEntry[]): GuestbookEntry[] {
  const slots = getGuestbookSlotIds()
  const occupied = new Set<string>()

  return [...entries]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    .map((entry) => {
      const storedSlot = entry.placement?.slotId
      const slotId = storedSlot && slots.includes(storedSlot) && !occupied.has(storedSlot)
        ? storedSlot
        : slots.find((slot) => !occupied.has(slot))
      if (!slotId) return entry
      occupied.add(slotId)
      return { ...entry, placement: { slotId, wallId: slotId.split('-')[0] } }
    })
}

export function getFirstAvailablePlacement(entries: readonly GuestbookEntry[]): GuestbookPlacement | undefined {
  const occupied = new Set(entries.map((entry) => entry.placement?.slotId).filter(Boolean))
  const slotId = getGuestbookSlotIds().find((slot) => !occupied.has(slot))
  return slotId ? { slotId, wallId: slotId.split('-')[0] } : undefined
}

export function getSlotTransform(slotId: string): { rotationY: number; x: number; y: number; z: number } | undefined {
  const [wallId, indexText] = slotId.split('-')
  const wall = WALLS.find((item) => item.id === wallId)
  const index = Number(indexText)
  if (!wall || !Number.isInteger(index) || index < 0 || index >= wall.columns * wall.rows) return undefined

  const column = index % wall.columns
  const row = Math.floor(index / wall.columns)
  const horizontal = (column - (wall.columns - 1) / 2) * HORIZONTAL_SPACING
  const y = FIRST_ROW_HEIGHT + row * VERTICAL_SPACING
  const inset = 0.18
  const { depth, width } = GUESTBOOK_ROOM_DIMENSIONS

  if (wallId === 'north') return { x: horizontal, y, z: -depth / 2 + inset, rotationY: 0 }
  if (wallId === 'south') {
    warnIfSouthSlotOverlapsPortal(slotId, horizontal)
    return { x: horizontal, y, z: depth / 2 - inset, rotationY: Math.PI }
  }
  if (wallId === 'east') return { x: width / 2 - inset, y, z: horizontal, rotationY: -Math.PI / 2 }
  return { x: -width / 2 + inset, y, z: horizontal, rotationY: Math.PI / 2 }
}

/** South-wall notes remain centred between the two portal frames even if portal data is later retuned. */
function warnIfSouthSlotOverlapsPortal(slotId: string, x: number): void {
  const postitHalfWidth = GUESTBOOK_POSTIT_SIZE / 2
  const portalHalfWidth = PORTAL_WIDTH / 2 + PORTAL_FRAME_WIDTH / 2 + SOUTH_PORTAL_MARGIN
  const overlappingPortal = GUESTBOOK_PORTALS.find((portal) => Math.abs(x - portal.offsetX) < postitHalfWidth + portalHalfWidth)
  if (overlappingPortal && !warnedPortalSlots.has(slotId)) {
    warnedPortalSlots.add(slotId)
    console.warn(`Guestbook slot "${slotId}" overlaps portal "${overlappingPortal.id}".`)
  }
}
