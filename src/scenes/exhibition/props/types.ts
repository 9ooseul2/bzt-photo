import type { PlanPosition } from '../types.ts'

interface PositionedPropConfig {
  id: string
  position: PlanPosition
  rotationY?: number
}

export interface BookshelfBlackPropConfig extends PositionedPropConfig {
  kind: 'bookshelf-black'
  width?: number
  height?: number
  depth?: number
}

export interface BookshelfWhitePropConfig extends PositionedPropConfig {
  kind: 'bookshelf-white'
  width?: number
  height?: number
  depth?: number
}

export interface FloorLampPropConfig extends PositionedPropConfig {
  kind: 'floor-lamp'
  height?: number
}

export interface WallNotesPropConfig {
  id: string
  kind: 'wall-notes'
  wallId: string
  /** Measured along the referenced wall's local X axis. */
  offsetX: number
  centerHeight?: number
  width?: number
  height?: number
}

/** Data-only prop definitions; render implementations stay isolated by kind. */
export type RoomPropConfig =
  | BookshelfBlackPropConfig
  | BookshelfWhitePropConfig
  | FloorLampPropConfig
  | WallNotesPropConfig
