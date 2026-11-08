import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { resolveWallConfig } from './createNavigationLayout.ts'
import type {
  ArtworkSide,
  ArtworkSurface,
  ExhibitionRoomConfig,
  ResolvedWallConfig,
  WallConfig,
} from './types.ts'

const ARTWORK_MARGIN = 0.7
const ARTWORK_OFFSET = 0.025

/**
 * A freestanding exterior or partition wall. Artwork anchors are intentionally
 * empty Object3D nodes so future art can be attached without altering walls.
 */
export class ExhibitionWall {
  readonly group = new Group()
  readonly config: ResolvedWallConfig
  private readonly artworkSurfaces: ArtworkSurface[] = []
  private readonly artworkAnchors = new Map<ArtworkSide, Object3D>()

  constructor(
    wall: WallConfig,
    room: ExhibitionRoomConfig,
    material: MeshStandardMaterial,
  ) {
    this.config = resolveWallConfig(wall, room)

    this.group.name = this.config.id
    this.group.position.set(this.config.position.x, this.config.height / 2, this.config.position.z)
    this.group.rotation.y = this.config.rotationY
    this.group.userData.wallId = this.config.id

    const mesh = new Mesh(
      new BoxGeometry(this.config.length, this.config.height, this.config.thickness),
      material,
    )
    mesh.name = `${this.config.id}:body`
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)

    for (const side of this.config.artworkSides ?? []) {
      this.addArtworkSurface(side)
    }
  }

  getArtworkSurfaces(): readonly ArtworkSurface[] {
    return this.artworkSurfaces
  }

  /** Attach a future framed work or image plane to the requested wall face. */
  getArtworkAnchor(side: ArtworkSide): Object3D | undefined {
    return this.artworkAnchors.get(side)
  }

  private addArtworkSurface(side: ArtworkSide): void {
    const anchor = new Object3D()
    const direction = side === 'front' ? 1 : -1
    const surfaceId = `${this.config.id}:artwork-${side}`

    anchor.name = surfaceId
    anchor.position.set(0, 0, direction * (this.config.thickness / 2 + ARTWORK_OFFSET))
    anchor.userData.artworkSurface = { wallId: this.config.id, side }
    this.group.add(anchor)
    this.artworkAnchors.set(side, anchor)

    this.artworkSurfaces.push({
      id: surfaceId,
      wallId: this.config.id,
      side,
      width: Math.max(0, this.config.length - ARTWORK_MARGIN * 2),
      height: Math.max(0, this.config.height - ARTWORK_MARGIN * 2),
    })
  }
}
