import type { GridPathfinder } from '../../../characters/pathfinding/GridPathfinder.ts'
import {
  MIN_SPOT_SPACING,
  VIEWING_ARC_ANGLE,
  VIEWING_DISTANCE,
  VIEWING_SPOT_COUNT,
} from './artworkConfig.ts'
import type { ArtworkConfig, ViewingSpot } from './types.ts'

interface HorizontalVector {
  x: number
  z: number
}

/** Creates only walkable positions on the viewing side of an artwork. */
export function createViewingSpots(
  artwork: ArtworkConfig,
  center: HorizontalVector,
  normal: HorizontalVector,
  pathfinder: GridPathfinder,
): ViewingSpot[] {
  const distance = Math.max(VIEWING_DISTANCE, artwork.width * 0.92)
  const count = VIEWING_SPOT_COUNT
  const spots: ViewingSpot[] = []

  for (let index = 0; index < count; index += 1) {
    const progress = index / (count - 1)
    const angle = (progress - 0.5) * VIEWING_ARC_ANGLE
    const direction = rotate(normal, angle)
    const position = { x: center.x + direction.x * distance, z: center.z + direction.z * distance }

    if (!pathfinder.isWalkableDestination(position)) {
      continue
    }

    const previous = spots.at(-1)
    if (previous && Math.hypot(previous.position.x - position.x, previous.position.z - position.z) < MIN_SPOT_SPACING) {
      continue
    }

    spots.push({ id: `${artwork.id}:spot-${index + 1}`, artworkId: artwork.id, position })
  }

  if (spots.length > 0) {
    return spots
  }

  for (const fallbackDistance of [VIEWING_DISTANCE, VIEWING_DISTANCE + 0.45, VIEWING_DISTANCE - 0.45, VIEWING_DISTANCE + 0.9]) {
    if (fallbackDistance <= 0) continue
    const position = { x: center.x + normal.x * fallbackDistance, z: center.z + normal.z * fallbackDistance }
    if (pathfinder.isWalkableDestination(position)) {
      return [{ id: `${artwork.id}:spot-fallback`, artworkId: artwork.id, position }]
    }
  }

  console.warn(`No walkable viewing spot could be made for artwork "${artwork.id}".`)
  return []
}

/** Picks the closest unreserved spot so the arrival direction reads naturally. */
export function chooseViewingSpot(
  spots: readonly ViewingSpot[],
  visitorPosition: HorizontalVector,
  occupiedSpotIds?: ReadonlySet<string>,
): ViewingSpot | undefined {
  let chosen: ViewingSpot | undefined
  let closestDistance = Number.POSITIVE_INFINITY

  for (const spot of spots) {
    if (occupiedSpotIds?.has(spot.id)) continue
    const distance = Math.hypot(spot.position.x - visitorPosition.x, spot.position.z - visitorPosition.z)
    if (distance < closestDistance) {
      chosen = spot
      closestDistance = distance
    }
  }

  return chosen
}

function rotate(vector: HorizontalVector, angle: number): HorizontalVector {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return { x: vector.x * cosine - vector.z * sine, z: vector.x * sine + vector.z * cosine }
}
