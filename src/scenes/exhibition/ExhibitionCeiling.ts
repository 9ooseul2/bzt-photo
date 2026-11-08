import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import type { RoomAppearanceConfig } from '../../rooms/types.ts'
import type { ExhibitionRoomConfig } from './types.ts'

/** Solid, interior-facing gallery ceiling; it deliberately remains opaque. */
export class ExhibitionCeiling {
  readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>

  constructor(config: ExhibitionRoomConfig, appearance?: RoomAppearanceConfig) {
    const { ceiling, dimensions } = config
    const geometry = new BoxGeometry(dimensions.width, ceiling.thickness, dimensions.depth)
    const material = new MeshStandardMaterial({
      color: appearance?.ceilingColor ?? ceiling.color,
      // A barely emissive finish keeps a configured white ceiling legible in a deliberately dim room.
      emissive: appearance?.ceilingColor ?? '#000000',
      emissiveIntensity: appearance ? 0.08 : 0,
      roughness: 0.9,
      metalness: 0,
    })

    this.mesh = new Mesh(geometry, material)
    this.mesh.name = ceiling.id
    this.mesh.position.y = ceiling.height + ceiling.thickness / 2
    this.mesh.receiveShadow = true
    this.mesh.userData.ceilingId = ceiling.id
  }
}
