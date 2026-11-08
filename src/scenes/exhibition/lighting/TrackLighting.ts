import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SpotLight,
  type BufferGeometry,
  type Material,
  type Texture,
  Vector3,
} from 'three'
import type { ExhibitionRoomConfig } from '../types.ts'
import type { ArtworkGallery } from '../artworks/ArtworkGallery.ts'
import type { RoomIntroGallery } from '../roomIntro/RoomIntroGallery.ts'

const TRACK_Y_OFFSET = 0.18
const SPOT_COLOR = '#ffd9a8'
const SPOT_INTENSITY = 65
const SPOT_ANGLE = (24 * Math.PI) / 180

interface LightTarget {
  center: Vector3
  id: string
  normal: Vector3
}

/** Room-two ceiling rails and replaceable primitive spot fixtures. */
export class TrackLighting {
  readonly group = new Group()
  private readonly lights: SpotLight[] = []
  private readonly corridorCenters: readonly number[]

  constructor(
    room: ExhibitionRoomConfig,
    artworkGallery: ArtworkGallery,
    roomIntroGallery: RoomIntroGallery,
  ) {
    this.group.name = 'track-lighting'
    this.corridorCenters = this.getCorridorCenters(room)
    this.createRails(room)

    const targets: LightTarget[] = []
    for (const artwork of artworkGallery.instances) {
      targets.push({ id: artwork.config.id, center: artwork.center, normal: artwork.normal })
    }
    for (const intro of roomIntroGallery.instances) {
      targets.push({ id: intro.config.id, center: intro.center, normal: intro.normal })
    }
    targets.forEach((target, index) => this.addSpot(target, room, index))
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
    for (const light of this.lights) light.shadow.map?.dispose()
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    this.lights.length = 0
    this.group.clear()
  }

  private createRails(room: ExhibitionRoomConfig): void {
    const material = new MeshStandardMaterial({ color: '#202122', roughness: 0.58, metalness: 0.6 })
    const geometry = new BoxGeometry(room.dimensions.width - 1.2, 0.075, 0.09)
    for (const z of this.corridorCenters) {
      const rail = new Mesh(geometry, material)
      rail.name = `track-rail:${z.toFixed(2)}`
      rail.position.set(0, room.ceiling.height - TRACK_Y_OFFSET, z)
      rail.castShadow = false
      rail.receiveShadow = false
      this.group.add(rail)
    }
  }

  private addSpot(target: LightTarget, room: ExhibitionRoomConfig, index: number): void {
    const railZ = this.getNearestCorridor(target.center.z + target.normal.z * 2)
    const fixture = createTrackSpotFixture(target.id)
    fixture.position.set(target.center.x, room.ceiling.height - TRACK_Y_OFFSET - 0.13, railZ)
    this.group.add(fixture)

    const spot = new SpotLight(SPOT_COLOR, SPOT_INTENSITY, 9, SPOT_ANGLE, 0.62, 2)
    spot.name = `track-spot:${target.id}`
    spot.position.copy(fixture.position).add(new Vector3(0, -0.03, 0))
    spot.castShadow = index === 0 || index === 5
    if (spot.castShadow) {
      spot.shadow.mapSize.set(1024, 1024)
      spot.shadow.bias = -0.00012
    }
    const targetObject = new Object3D()
    targetObject.name = `track-target:${target.id}`
    targetObject.position.copy(target.center)
    spot.target = targetObject
    this.lights.push(spot)
    this.group.add(spot, targetObject)
  }

  private getCorridorCenters(room: ExhibitionRoomConfig): number[] {
    const horizontalPartitions = room.partitions
      .filter((wall) => Math.abs(Math.sin(wall.rotationY)) < 0.001)
      .map((wall) => wall.position.z)
      .sort((left, right) => left - right)
    const north = -room.dimensions.depth / 2
    const south = room.dimensions.depth / 2
    if (horizontalPartitions.length < 2) return [0]
    return [
      (north + horizontalPartitions[0]) / 2,
      (horizontalPartitions[0] + horizontalPartitions[1]) / 2,
      (horizontalPartitions[1] + south) / 2,
    ]
  }

  private getNearestCorridor(z: number): number {
    return this.corridorCenters.reduce((closest, candidate) => Math.abs(candidate - z) < Math.abs(closest - z) ? candidate : closest)
  }
}

/** One isolated fixture factory makes replacing the temporary primitive with a GLB straightforward. */
export function createTrackSpotFixture(id: string): Group {
  const root = new Group()
  root.name = `track-fixture:${id}`
  const material = new MeshStandardMaterial({ color: '#202122', roughness: 0.55, metalness: 0.62 })
  const mount = new Mesh(new BoxGeometry(0.17, 0.055, 0.11), material)
  const body = new Mesh(new CylinderGeometry(0.07, 0.09, 0.24, 12), material)
  body.position.y = -0.13
  root.add(mount, body)
  return root
}
