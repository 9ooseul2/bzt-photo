import { type BufferGeometry, Group, type Material, Mesh, type Texture } from 'three'
import type { AdditionalNavigationObstacle } from '../createNavigationLayout.ts'
import { ExhibitionWall } from '../ExhibitionWall.ts'
import { createRoomProp } from './createProp.ts'
import type { RoomPropConfig } from './types.ts'

/** Non-structural room decoration rendered independently from wall/camera collision groups. */
export class RoomProps {
  readonly group = new Group()

  constructor(configs: readonly RoomPropConfig[], walls: readonly ExhibitionWall[]) {
    this.group.name = 'room-props'
    const wallsById = new Map(walls.map((wall) => [wall.config.id, wall]))
    for (const config of configs) {
      const prop = createRoomProp(config, wallsById)
      if (prop) this.group.add(prop)
    }
  }

  dispose(): void {
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    const textures = new Set<Texture>()
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry)
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of objectMaterials) {
        const textured = material as Material & { map?: Texture }
        if (textured.map) textures.add(textured.map)
        materials.add(material)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    this.group.clear()
  }
}

/** Converts only floor-standing props to A* obstacle volumes, with clearance. */
export function getRoomPropNavigationObstacles(configs: readonly RoomPropConfig[]): AdditionalNavigationObstacle[] {
  return configs.flatMap((config): AdditionalNavigationObstacle[] => {
    if (config.kind === 'bookshelf-black') {
      return [{
        id: `${config.id}:collision`, center: config.position,
        length: (config.width ?? 0.9) + 0.18, thickness: (config.depth ?? 0.35) + 0.22, rotationY: config.rotationY ?? 0,
      }]
    }
    if (config.kind === 'bookshelf-white') {
      return [{
        id: `${config.id}:collision`, center: config.position,
        length: (config.width ?? 0.8) + 0.18, thickness: (config.depth ?? 0.32) + 0.22, rotationY: config.rotationY ?? 0,
      }]
    }
    if (config.kind === 'floor-lamp') {
      return [{ id: `${config.id}:collision`, center: config.position, length: 0.72, thickness: 0.72, rotationY: config.rotationY ?? 0 }]
    }
    return []
  })
}
