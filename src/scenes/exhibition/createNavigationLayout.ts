import type {
  EntranceConfig,
  ExhibitionRoomConfig,
  ResolvedWallConfig,
} from './types.ts'

export interface MovementBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** An oriented obstacle is kept independent of its Three.js mesh. */
export interface WallCollisionVolume {
  id: string
  center: { x: number; z: number }
  length: number
  thickness: number
  rotationY: number
}

/** Non-structural floor objects can participate in pathfinding without becoming walls. */
export type AdditionalNavigationObstacle = WallCollisionVolume

export interface NavigationLayout {
  roomId: string
  /** The floor area permitted by the exterior room boundary. */
  walkableBounds: MovementBounds
  /** Interior walls which a future character controller must avoid. */
  blockingObstacles: readonly WallCollisionVolume[]
  spawnPoint: { x: number; z: number }
  entrance: Pick<EntranceConfig, 'id' | 'position' | 'width' | 'rotationY'>
}

/**
 * Creates input for future click-to-move/pathfinding without coupling it to
 * rendering. Rebuilding an ExhibitionRoom with changed config regenerates it.
 */
export function createNavigationLayout(
  config: ExhibitionRoomConfig,
  additionalObstacles: readonly AdditionalNavigationObstacle[] = [],
): NavigationLayout {
  const boundaryInset = config.wallThickness / 2

  return {
    roomId: config.id,
    walkableBounds: {
      minX: -config.dimensions.width / 2 + boundaryInset,
      maxX: config.dimensions.width / 2 - boundaryInset,
      minZ: -config.dimensions.depth / 2 + boundaryInset,
      maxZ: config.dimensions.depth / 2 - boundaryInset,
    },
    blockingObstacles: [
      ...config.partitions.map((wall) => {
      const resolvedWall = resolveWallConfig(wall, config)

      return {
        id: resolvedWall.id,
        center: resolvedWall.position,
        length: resolvedWall.length,
        thickness: resolvedWall.thickness,
        rotationY: resolvedWall.rotationY,
      }
      }),
      ...additionalObstacles,
    ],
    spawnPoint: config.spawnPoint,
    entrance: {
      id: config.entrance.id,
      position: config.entrance.position,
      width: config.entrance.width,
      rotationY: config.entrance.rotationY,
    },
  }
}

export function resolveWallConfig(
  wall: ExhibitionRoomConfig['partitions'][number],
  room: ExhibitionRoomConfig,
): ResolvedWallConfig {
  return {
    ...wall,
    height: wall.height ?? room.dimensions.wallHeight,
    thickness: wall.thickness ?? room.wallThickness,
  }
}
