import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import type { RoomAppearanceConfig } from '../../rooms/types.ts'
import type { ExhibitionRoomConfig } from './types.ts'

/** Render object for the separately managed room floor. */
export class ExhibitionFloor {
  readonly mesh: Mesh<PlaneGeometry, MeshStandardMaterial>

  constructor(config: ExhibitionRoomConfig, appearance?: RoomAppearanceConfig) {
    const geometry = new PlaneGeometry(config.dimensions.width, config.dimensions.depth)
    const material = new MeshStandardMaterial({
      color: appearance?.floorColor ?? config.floor.color,
      roughness: appearance?.floorRoughness ?? 0.95,
      metalness: 0,
    })

    this.mesh = new Mesh(geometry, material)
    this.mesh.name = config.floor.id
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.receiveShadow = true
    this.mesh.userData.navigationSurface = true
  }
}
