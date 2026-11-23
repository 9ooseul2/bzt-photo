import type { GuestbookEntry } from './types.ts'

export const GUESTBOOK_ROOM_DIMENSIONS = { width: 26, depth: 20, wallHeight: 6.4 }

/**
 * 방명록 벽 배치: 정면·양옆 세 벽에 랜덤으로, 이웃과 살짝 겹치게 붙인다 (입구 벽은 비워 둔다).
 * - 위치는 글 id로 정해져서, 다시 들어와도 같은 글은 같은 자리에 있다.
 * - 나중에 쓴 글이 위에 붙는다 (겹친 곳을 누르면 위 글이 열린다).
 * - 지금 크기로 더 붙일 자리가 없으면(약 350개) 모든 포스트잇을 한 단계 작게 해서 처음부터 다시 붙인다.
 *
 * 숫자만 바꿔서 느낌을 조절할 수 있다:
 * - POSTIT_SIZES: 포스트잇 한 변 길이(m). 앞에서부터 쓰고, 자리가 모자라면 다음 크기로 넘어간다.
 * - OVERLAP_SPACING: 이웃 포스트잇 중심 사이 최소 거리 (포스트잇 크기 대비). 1 = 안 겹침, 0.7 = 최대 30% 겹침
 * - LAYER_OFFSET: 겹쳐 붙을 때 한 겹마다 벽에서 앞으로 나오는 거리(m)
 */
const POSTIT_SIZES = [0.92, 0.8, 0.68] as const
const OVERLAP_SPACING = 0.7
const LAYER_OFFSET = 0.012
const WALL_INSET = 0.18
/** 한 포스트잇의 자리를 찾을 때 시도하는 횟수. 다 실패하면 "자리가 없다"로 본다. */
const PLACEMENT_ATTEMPTS = 200
/** 방에 들어갈 때 불러오는 최신 글 수 (가장 작은 크기로 붙일 수 있는 양보다 넉넉히) */
export const GUESTBOOK_CAPACITY = 700

type WallId = 'north' | 'east' | 'west'

/** 포스트잇이 붙을 수 있는 영역: 벽 가로(u)와 높이(y). 포스트잇 가장자리가 이 안에 들어온다. */
const REGIONS: ReadonlyArray<{ wall: WallId; u0: number; u1: number; y0: number; y1: number }> = [
  { wall: 'north', u0: -12.6, u1: 12.6, y0: 0.55, y1: 6.2 },
  { wall: 'east', u0: -9.6, u1: 9.6, y0: 0.55, y1: 6.2 },
  { wall: 'west', u0: -9.6, u1: 9.6, y0: 0.55, y1: 6.2 },
]

interface Spot { wall: WallId; u: number; y: number; layer: number }

export interface GuestbookWallLayout {
  /** 자리가 정해진 글들 (오래된 글부터) */
  entries: GuestbookEntry[]
  /** 이번 배치의 포스트잇 크기 */
  postitSize: number
}

/** 모든 글의 자리를 정한다. 지금 크기로 다 못 붙이면 한 단계 작은 크기로 다시 시도한다. */
export function layoutGuestbookWall(entries: readonly GuestbookEntry[]): GuestbookWallLayout {
  const sorted = [...entries].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
  for (let step = 0; step < POSTIT_SIZES.length; step += 1) {
    const size = POSTIT_SIZES[step]
    const isLast = step === POSTIT_SIZES.length - 1
    const spots = placeAll(sorted, size, isLast)
    if (spots) {
      return {
        postitSize: size,
        entries: sorted.map((entry, index) => ({
          ...entry,
          placement: { slotId: encodeSlot(spots[index], size), wallId: spots[index].wall },
        })),
      }
    }
  }
  return { postitSize: POSTIT_SIZES[0], entries: sorted } // 도달하지 않음 (마지막 크기는 항상 성공)
}

/** 예전 이름 그대로 쓰는 곳을 위해 */
export function assignGuestbookPlacements(entries: readonly GuestbookEntry[]): GuestbookEntry[] {
  return layoutGuestbookWall(entries).entries
}

export function getSlotTransform(slotId: string): { rotationY: number; size: number; x: number; y: number; z: number } | undefined {
  const [wall, uText, yText, layerText, sizeText] = slotId.split(':')
  const u = Number(uText)
  const y = Number(yText)
  const layer = Number(layerText)
  const size = Number(sizeText)
  if (![u, y, layer, size].every(Number.isFinite)) return undefined
  const inset = WALL_INSET + layer * LAYER_OFFSET
  const { depth, width } = GUESTBOOK_ROOM_DIMENSIONS
  if (wall === 'north') return { x: u, y, z: -depth / 2 + inset, rotationY: 0, size }
  if (wall === 'east') return { x: width / 2 - inset, y, z: u, rotationY: -Math.PI / 2, size }
  if (wall === 'west') return { x: -width / 2 + inset, y, z: u, rotationY: Math.PI / 2, size }
  return undefined
}

const encodeSlot = (spot: Spot, size: number): string => `${spot.wall}:${spot.u.toFixed(3)}:${spot.y.toFixed(3)}:${spot.layer}:${size}`

/**
 * 오래된 글부터 하나씩 랜덤 자리에 붙인다. 이웃과 OVERLAP_SPACING보다 가까우면 다른 자리를 찾는다.
 * 자리를 못 찾으면 null (한 단계 작게 다시). force면 가장 덜 겹치는 자리에라도 붙인다.
 */
function placeAll(entries: readonly GuestbookEntry[], size: number, force: boolean): Spot[] | null {
  const minDistance = size * OVERLAP_SPACING
  const areas = REGIONS.map((region) => (region.u1 - region.u0 - size) * (region.y1 - region.y0 - size))
  const totalArea = areas.reduce((sum, area) => sum + area, 0)
  // 가까운 포스트잇만 빨리 찾도록 벽을 칸으로 나눠 둔다
  const buckets = new Map<string, Spot[]>()
  const bucketKey = (wall: WallId, u: number, y: number) => `${wall}:${Math.floor(u / size)}:${Math.floor(y / size)}`
  const neighbors = (wall: WallId, u: number, y: number): Spot[] => {
    const found: Spot[] = []
    const column = Math.floor(u / size)
    const row = Math.floor(y / size)
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) found.push(...(buckets.get(`${wall}:${column + dc}:${row + dr}`) ?? []))
    }
    return found
  }

  const spots: Spot[] = []
  for (const entry of entries) {
    const random = seededRandom(entry.id)
    let best: { wall: WallId; u: number; y: number; clearance: number } | undefined
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
      // 넓은 벽일수록 자주 고르도록 넓이 비율로 벽을 고른다
      let pick = random() * totalArea
      let index = 0
      while (index < REGIONS.length - 1 && pick >= areas[index]) {
        pick -= areas[index]
        index += 1
      }
      const region = REGIONS[index]
      const u = region.u0 + size / 2 + random() * (region.u1 - region.u0 - size)
      const y = region.y0 + size / 2 + random() * (region.y1 - region.y0 - size)
      const clearance = neighbors(region.wall, u, y)
        .reduce((closest, other) => Math.min(closest, Math.max(Math.abs(other.u - u), Math.abs(other.y - y))), Infinity)
      if (!best || clearance > best.clearance) best = { wall: region.wall, u, y, clearance }
      if (clearance > minDistance) break
    }
    if (!best || (best.clearance <= minDistance && !force)) return null
    // 아래에 겹친 포스트잇보다 한 겹 위에 붙인다
    const layer = neighbors(best.wall, best.u, best.y)
      .filter((other) => Math.abs(other.u - best.u) < size && Math.abs(other.y - best.y) < size)
      .reduce((top, other) => Math.max(top, other.layer + 1), 0)
    const spot: Spot = { wall: best.wall, u: best.u, y: best.y, layer }
    spots.push(spot)
    const key = bucketKey(spot.wall, spot.u, spot.y)
    buckets.set(key, [...(buckets.get(key) ?? []), spot])
  }
  return spots
}

/** 글 id로 정해지는 난수 (같은 id면 늘 같은 순서의 수) */
function seededRandom(seed: string): () => number {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    hash ^= hash >>> 16
    return (hash >>> 0) / 4294967296
  }
}
