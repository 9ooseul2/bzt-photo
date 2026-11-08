export type ArtworkSide = 'front' | 'back'

export interface PlanPosition {
  x: number
  z: number
}

export interface RoomDimensions {
  /** Full exterior size, measured in world units. */
  width: number
  depth: number
  /** Default height for walls that do not override it. */
  wallHeight: number
}

export interface FloorConfig {
  id: string
  color: string
}

/** A solid roof slab that closes the gallery at the top of its exterior walls. */
export interface CeilingConfig {
  id: string
  /** Height of the ceiling's interior-facing underside. */
  height: number
  thickness: number
  color: string
}

/** Camera positions must remain within this interior volume. */
export interface CameraBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
}

/**
 * Walls are always modelled along their local X axis.
 * `rotationY` rotates that length around the room's vertical axis.
 */
export interface WallConfig {
  id: string
  position: PlanPosition
  length: number
  rotationY: number
  height?: number
  thickness?: number
  artworkSides?: readonly ArtworkSide[]
}

/** The opening and lintel are separate from the exterior-wall segments. */
export interface EntranceConfig {
  id: string
  position: PlanPosition
  width: number
  height: number
  rotationY: number
}

export interface ExhibitionRoomConfig {
  id: string
  /** Optional visitor-facing label used by room-aware UI such as the minimap. */
  displayName?: string
  dimensions: RoomDimensions
  wallThickness: number
  floor: FloorConfig
  ceiling: CeilingConfig
  /** Initial visitor position, kept in the same coordinate system as the plan. */
  spawnPoint: PlanPosition
  exteriorWalls: readonly WallConfig[]
  partitions: readonly WallConfig[]
  entrance: EntranceConfig
}

export interface ResolvedWallConfig extends Omit<WallConfig, 'height' | 'thickness'> {
  height: number
  thickness: number
}

export interface ArtworkSurface {
  id: string
  wallId: string
  side: ArtworkSide
  width: number
  height: number
}
