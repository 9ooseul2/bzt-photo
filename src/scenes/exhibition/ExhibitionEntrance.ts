import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { EntranceConfig, RoomDimensions } from './types.ts'

/** The entrance opening/lintel is independent from the exterior wall segments. */
export class ExhibitionEntrance {
  readonly group = new Group()

  constructor(
    config: EntranceConfig,
    dimensions: RoomDimensions,
    wallThickness: number,
    wallMaterial: MeshStandardMaterial,
  ) {
    this.group.name = config.id
    this.group.position.set(config.position.x, 0, config.position.z)
    this.group.rotation.y = config.rotationY
    this.group.userData.entranceId = config.id

    const lintelHeight = Math.max(0, dimensions.wallHeight - config.height)

    if (lintelHeight > 0) {
      const lintel = new Mesh(
        new BoxGeometry(config.width, lintelHeight, wallThickness),
        wallMaterial,
      )
      lintel.name = `${config.id}:lintel`
      lintel.position.y = config.height + lintelHeight / 2
      lintel.castShadow = true
      lintel.receiveShadow = true
      this.group.add(lintel)
    }

    const threshold = new Mesh(
      new BoxGeometry(config.width, 0.035, wallThickness * 1.5),
      new MeshStandardMaterial({ color: '#b9b5ab', roughness: 0.85 }),
    )
    threshold.name = `${config.id}:threshold`
    threshold.position.y = 0.0175
    threshold.receiveShadow = true
    this.group.add(threshold)
  }
}
