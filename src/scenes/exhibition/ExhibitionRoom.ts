import { Group, MeshStandardMaterial, type Object3D } from 'three'
import type { RoomAppearanceConfig } from '../../rooms/types.ts'
import { createNavigationLayout, type AdditionalNavigationObstacle, type NavigationLayout } from './createNavigationLayout.ts'
import { ExhibitionCeiling } from './ExhibitionCeiling.ts'
import { ExhibitionEntrance } from './ExhibitionEntrance.ts'
import { ExhibitionFloor } from './ExhibitionFloor.ts'
import { ExhibitionWall } from './ExhibitionWall.ts'
import type { ArtworkSurface, CameraBounds, ExhibitionRoomConfig } from './types.ts'

/**
 * Composes independently managed floor, exterior walls, partitions, and entry.
 * Replace the config and make a new room to reconstruct both meshes and the
 * navigation input for a changed gallery plan.
 */
export class ExhibitionRoom {
  readonly group = new Group()
  readonly config: ExhibitionRoomConfig
  readonly ceiling: ExhibitionCeiling
  readonly floor: ExhibitionFloor
  readonly exteriorWalls: readonly ExhibitionWall[]
  readonly partitionWalls: readonly ExhibitionWall[]
  readonly entrance: ExhibitionEntrance
  readonly navigation: NavigationLayout

  constructor(
    config: ExhibitionRoomConfig,
    appearance?: RoomAppearanceConfig,
    additionalNavigationObstacles: readonly AdditionalNavigationObstacle[] = [],
  ) {
    this.config = config
    this.validateConfig()

    this.group.name = config.id
    const wallMaterial = new MeshStandardMaterial({
      color: appearance?.wallColor ?? '#f3eee2',
      roughness: 0.82,
      metalness: 0,
    })

    this.floor = new ExhibitionFloor(config, appearance)
    this.ceiling = new ExhibitionCeiling(config, appearance)
    this.exteriorWalls = config.exteriorWalls.map(
      (wall) => new ExhibitionWall(wall, config, wallMaterial),
    )
    this.partitionWalls = config.partitions.map(
      (wall) => new ExhibitionWall(wall, config, wallMaterial),
    )
    this.entrance = new ExhibitionEntrance(
      config.entrance,
      config.dimensions,
      config.wallThickness,
      wallMaterial,
    )
    this.navigation = createNavigationLayout(config, additionalNavigationObstacles)

    this.group.add(
      this.floor.mesh,
      this.ceiling.mesh,
      ...this.exteriorWalls.map((wall) => wall.group),
      ...this.partitionWalls.map((wall) => wall.group),
      this.entrance.group,
    )
  }

  /** Available partition faces for a future artwork placement service. */
  getPartitionArtworkSurfaces(): readonly ArtworkSurface[] {
    return this.partitionWalls.flatMap((wall) => wall.getArtworkSurfaces())
  }

  /** Solid geometry to test between a visitor and a third-person camera. */
  getCameraOccluders(): readonly Object3D[] {
    return [
      this.ceiling.mesh,
      ...[...this.exteriorWalls, ...this.partitionWalls].map((wall) => wall.group),
    ]
  }

  /** Interior limits used in addition to mesh raycasts for doorway and ceiling safety. */
  getCameraBounds(): CameraBounds {
    const { walkableBounds } = this.navigation
    const collisionClearance = this.config.wallThickness

    return {
      minX: walkableBounds.minX + collisionClearance,
      maxX: walkableBounds.maxX - collisionClearance,
      minY: collisionClearance,
      maxY: this.config.ceiling.height - collisionClearance,
      minZ: walkableBounds.minZ + collisionClearance,
      maxZ: walkableBounds.maxZ - collisionClearance,
    }
  }

  private validateConfig(): void {
    const { depth, wallHeight, width } = this.config.dimensions

    if (width <= 0 || depth <= 0 || wallHeight <= 0 || this.config.wallThickness <= 0) {
      throw new Error('Exhibition room dimensions and wall thickness must be positive.')
    }

    if (this.config.entrance.height > wallHeight) {
      throw new Error('Entrance height cannot exceed room wall height.')
    }

    if (this.config.ceiling.height <= 0 || this.config.ceiling.thickness <= 0) {
      throw new Error('Ceiling height and thickness must be positive.')
    }

    const wallIds = [
      ...this.config.exteriorWalls.map((wall) => wall.id),
      ...this.config.partitions.map((wall) => wall.id),
    ]

    if (new Set(wallIds).size !== wallIds.length) {
      throw new Error('Every exhibition wall must have a unique ID.')
    }
  }
}
