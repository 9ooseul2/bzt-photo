import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Texture,
  TextureLoader,
  Vector3,
} from 'three'
import type { GridPathfinder } from '../../../characters/pathfinding/GridPathfinder.ts'
import { publicAsset } from '../../../config/publicAsset.ts'
import { ExhibitionWall } from '../ExhibitionWall.ts'
import {
  DEFAULT_CENTER_HEIGHT,
  FRAME_BORDER_WIDTH,
  FRAME_THICKNESS,
  SHOW_VIEWING_SPOTS_DEBUG,
  WHITE_MAT_WIDTH,
} from './artworkConfig.ts'
import type { ArtworkConfig, FrameStyle, ViewingSpot } from './types.ts'
import { createViewingSpots } from './viewingSpots.ts'

const DEFAULT_ASPECT_RATIO = 4 / 3
const FORWARD = new Vector3(0, 0, 1)

export interface ArtworkInstance {
  readonly config: ArtworkConfig
  /** Centre of the visible work in world space. */
  readonly center: Vector3
  /** Horizontal direction from its wall toward a viewer. */
  readonly normal: Vector3
  readonly viewingSpots: readonly ViewingSpot[]
}

interface ManagedArtwork extends ArtworkInstance {
  readonly root: Group
  visual: Group
  aspectRatio: number
}

interface ArtworkDimensions {
  height: number
  outerHeight: number
  outerWidth: number
}

/**
 * Renders independent artworks directly into the scene so camera wall
 * occlusion remains based solely on the room's structural meshes.
 */
export class ArtworkGallery {
  readonly group = new Group()
  private disposed = false
  private readonly artworks = new Map<string, ManagedArtwork>()
  private readonly loader = new TextureLoader()
  private readonly surfaces = new Map<string, { height: number; width: number }>()
  private readonly walls = new Map<string, ExhibitionWall>()

  constructor(
    configs: readonly ArtworkConfig[],
    partitionWalls: readonly ExhibitionWall[],
    pathfinder: GridPathfinder,
  ) {
    this.group.name = 'artwork-gallery'

    for (const wall of partitionWalls) {
      this.walls.set(wall.config.id, wall)
      for (const surface of wall.getArtworkSurfaces()) {
        this.surfaces.set(this.surfaceKey(surface.wallId, surface.side), surface)
      }
    }

    for (const config of configs) {
      this.addArtwork(config, pathfinder)
    }
  }

  getArtwork(id: string): ArtworkInstance | undefined {
    return this.artworks.get(id)
  }

  /** Read-only positions are also consumed by room-specific lighting rigs. */
  get instances(): readonly ArtworkInstance[] {
    return [...this.artworks.values()]
  }

  /** Resolves any photo or frame child mesh back to its work configuration. */
  getArtworkFromObject(object: Object3D): ArtworkInstance | undefined {
    let current: Object3D | null = object
    while (current) {
      const artworkId = current.userData.artworkId
      if (typeof artworkId === 'string') return this.artworks.get(artworkId)
      current = current.parent
    }
    return undefined
  }

  dispose(): void {
    this.disposed = true
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        const textured = material as MeshStandardMaterial
        textured.map?.dispose()
        material.dispose()
      }
    })
    this.group.clear()
    this.artworks.clear()
  }

  private addArtwork(config: ArtworkConfig, pathfinder: GridPathfinder): void {
    const wall = this.walls.get(config.placement.wallId)
    const anchor = wall?.getArtworkAnchor(config.placement.side)
    const surface = this.surfaces.get(this.surfaceKey(config.placement.wallId, config.placement.side))

    if (!wall || !anchor || !surface) {
      console.warn(`Artwork "${config.id}" references an unavailable wall face and was skipped.`)
      return
    }

    anchor.updateWorldMatrix(true, false)
    const anchorPosition = anchor.getWorldPosition(new Vector3())
    const localX = new Vector3(1, 0, 0).transformDirection(anchor.matrixWorld)
    const normal = new Vector3(0, 0, config.placement.side === 'front' ? 1 : -1)
      .transformDirection(anchor.matrixWorld)
    normal.y = 0
    normal.normalize()

    const center = anchorPosition.addScaledVector(localX, config.placement.offsetX)
    center.y = config.placement.centerHeight ?? DEFAULT_CENTER_HEIGHT
    const root = new Group()
    root.name = `artwork:${config.id}`
    root.userData.artworkId = config.id
    root.position.copy(center).addScaledVector(normal, FRAME_THICKNESS / 2)
    root.quaternion.setFromUnitVectors(FORWARD, normal)
    root.castShadow = false
    root.receiveShadow = true

    const placeholder = this.createPlaceholderTexture(config.title)
    const visual = this.createArtworkVisual(config, DEFAULT_ASPECT_RATIO, placeholder)
    root.add(visual)
    this.group.add(root)

    const artwork: ManagedArtwork = {
      config,
      center,
      normal,
      root,
      visual,
      aspectRatio: DEFAULT_ASPECT_RATIO,
      viewingSpots: createViewingSpots(config, center, normal, pathfinder),
    }
    this.artworks.set(config.id, artwork)
    this.validatePlacement(artwork, surface, wall)
    this.addDebugSpots(artwork)

    this.loader.load(
      publicAsset(config.imageUrl),
      (texture) => {
        if (this.disposed) {
          texture.dispose()
          return
        }
        texture.colorSpace = SRGBColorSpace
        const image = texture.image as { height?: number; width?: number }
        const aspectRatio = image.width && image.height ? image.width / image.height : DEFAULT_ASPECT_RATIO
        this.replaceArtworkVisual(artwork, Math.max(aspectRatio, Number.EPSILON), texture)
        this.validatePlacement(artwork, surface, wall)
      },
      undefined,
      () => {
        // The intentionally empty sample image paths remain useful as labelled, calm placeholders.
      },
    )
  }

  private replaceArtworkVisual(artwork: ManagedArtwork, aspectRatio: number, texture: Texture): void {
    this.disposeVisual(artwork.visual)
    const nextVisual = this.createArtworkVisual(artwork.config, aspectRatio, texture)
    artwork.root.remove(artwork.visual)
    artwork.root.add(nextVisual)
    artwork.visual = nextVisual
    artwork.aspectRatio = aspectRatio
  }

  private createArtworkVisual(config: ArtworkConfig, aspectRatio: number, texture: Texture): Group {
    const height = config.width / aspectRatio
    const visual = new Group()
    visual.name = `${config.id}:visual`

    const photoMaterial = new MeshStandardMaterial({
      map: texture,
      roughness: 0.88,
      metalness: 0,
    })
    const photo = new Mesh(new PlaneGeometry(config.width, height), photoMaterial)
    photo.name = `${config.id}:photo`
    photo.position.z = FRAME_THICKNESS / 2 + 0.002
    photo.castShadow = false
    photo.receiveShadow = true
    visual.add(photo, this.createFrame(config.frameStyle, config.width, height))
    return visual
  }

  /** Isolates the temporary primitive-frame implementation for a future GLB swap. */
  private createFrame(style: FrameStyle, photoWidth: number, photoHeight: number): Object3D {
    const frame = new Group()
    frame.name = `artwork-frame:${style}`
    const wood = '#7a563b'

    if (style === 'none') {
      const backing = new Mesh(
        new BoxGeometry(photoWidth, photoHeight, Math.max(0.025, FRAME_THICKNESS * 0.45)),
        new MeshStandardMaterial({ color: '#d5cec0', roughness: 0.93, metalness: 0 }),
      )
      backing.position.z = -FRAME_THICKNESS * 0.1
      backing.castShadow = false
      backing.receiveShadow = true
      frame.add(backing)
      return frame
    }

    if (style === 'white-mat') {
      this.addFrameBars(frame, photoWidth + WHITE_MAT_WIDTH * 2, photoHeight + WHITE_MAT_WIDTH * 2, WHITE_MAT_WIDTH, '#f8f5ed')
      this.addFrameBars(
        frame,
        photoWidth + (WHITE_MAT_WIDTH + FRAME_BORDER_WIDTH) * 2,
        photoHeight + (WHITE_MAT_WIDTH + FRAME_BORDER_WIDTH) * 2,
        FRAME_BORDER_WIDTH,
        '#4e4941',
      )
      return frame
    }

    this.addFrameBars(frame, photoWidth + FRAME_BORDER_WIDTH * 2, photoHeight + FRAME_BORDER_WIDTH * 2, FRAME_BORDER_WIDTH, wood)
    return frame
  }

  private addFrameBars(frame: Group, outerWidth: number, outerHeight: number, borderWidth: number, color: string): void {
    const material = new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 })
    const horizontalGeometry = new BoxGeometry(outerWidth, borderWidth, FRAME_THICKNESS)
    const verticalGeometry = new BoxGeometry(borderWidth, Math.max(0.001, outerHeight - borderWidth * 2), FRAME_THICKNESS)
    const top = new Mesh(horizontalGeometry, material)
    const bottom = top.clone()
    top.position.set(0, (outerHeight - borderWidth) / 2, 0)
    bottom.position.set(0, -(outerHeight - borderWidth) / 2, 0)
    const left = new Mesh(verticalGeometry, material)
    const right = left.clone()
    left.position.set(-(outerWidth - borderWidth) / 2, 0, 0)
    right.position.set((outerWidth - borderWidth) / 2, 0, 0)
    for (const mesh of [top, bottom, left, right]) {
      mesh.castShadow = false
      mesh.receiveShadow = true
    }
    frame.add(top, bottom, left, right)
  }

  private createPlaceholderTexture(title: string): CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 960
    canvas.height = 720
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#aaa69d'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#e6e1d6'
      context.fillRect(42, 42, canvas.width - 84, canvas.height - 84)
      context.fillStyle = '#686862'
      context.font = '600 34px sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      this.drawPlaceholderTitle(context, title, canvas.width / 2, canvas.height / 2)
    }
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }

  private drawPlaceholderTitle(context: CanvasRenderingContext2D, title: string, x: number, y: number): void {
    const words = title.length > 18 ? [title.slice(0, 18), title.slice(18)] : [title]
    words.forEach((word, index) => context.fillText(word, x, y + (index - (words.length - 1) / 2) * 48))
  }

  private validatePlacement(
    artwork: ManagedArtwork,
    surface: { height: number; width: number },
    wall: ExhibitionWall,
  ): void {
    const dimensions = this.getDimensions(artwork.config, artwork.aspectRatio)
    const horizontalOutOfBounds = Math.abs(artwork.config.placement.offsetX) + dimensions.outerWidth / 2 > surface.width / 2
    const usableBottom = (wall.config.height - surface.height) / 2
    const usableTop = usableBottom + surface.height
    const verticalOutOfBounds = artwork.center.y - dimensions.outerHeight / 2 < usableBottom || artwork.center.y + dimensions.outerHeight / 2 > usableTop

    if (horizontalOutOfBounds || verticalOutOfBounds) {
      console.warn(`Artwork "${artwork.config.id}" exceeds the usable surface of its wall.`)
    }

    for (const other of this.artworks.values()) {
      if (other === artwork || other.config.placement.wallId !== artwork.config.placement.wallId || other.config.placement.side !== artwork.config.placement.side) continue
      const otherDimensions = this.getDimensions(other.config, other.aspectRatio)
      const overlapsX = Math.abs(other.config.placement.offsetX - artwork.config.placement.offsetX) < (otherDimensions.outerWidth + dimensions.outerWidth) / 2
      const overlapsY = Math.abs(other.center.y - artwork.center.y) < (otherDimensions.outerHeight + dimensions.outerHeight) / 2
      if (overlapsX && overlapsY) console.warn(`Artwork "${artwork.config.id}" overlaps "${other.config.id}" on the same wall face.`)
    }
  }

  private getDimensions(config: ArtworkConfig, aspectRatio: number): ArtworkDimensions {
    const height = config.width / aspectRatio
    if (config.frameStyle === 'white-mat') {
      const edge = WHITE_MAT_WIDTH + FRAME_BORDER_WIDTH
      return { height, outerWidth: config.width + edge * 2, outerHeight: height + edge * 2 }
    }
    const edge = config.frameStyle === 'thin-wood' ? FRAME_BORDER_WIDTH : 0
    return { height, outerWidth: config.width + edge * 2, outerHeight: height + edge * 2 }
  }

  private addDebugSpots(artwork: ArtworkInstance): void {
    if (!SHOW_VIEWING_SPOTS_DEBUG) return
    const material = new MeshStandardMaterial({ color: '#6d9b5b', roughness: 0.75 })
    for (const spot of artwork.viewingSpots) {
      const marker = new Mesh(new SphereGeometry(0.075, 12, 8), material)
      marker.position.set(spot.position.x, 0.075, spot.position.z)
      this.group.add(marker)
    }
  }

  private disposeVisual(visual: Object3D): void {
    visual.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        const textured = material as MeshStandardMaterial
        textured.map?.dispose()
        material.dispose()
      }
    })
    visual.clear()
  }

  private surfaceKey(wallId: string, side: string): string {
    return `${wallId}:${side}`
  }
}
