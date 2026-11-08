import {
  CanvasTexture,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import type { GridPathfinder } from '../../../characters/pathfinding/GridPathfinder.ts'
import type { ArtworkConfig } from '../artworks/types.ts'
import { ExhibitionWall } from '../ExhibitionWall.ts'
import type { PortalConfig } from '../../portals/types.ts'
import { PORTAL_HEIGHT, PORTAL_LABEL_HEIGHT, PORTAL_WIDTH } from '../../portals/portalConfig.ts'
import type { ArtworkSide } from '../types.ts'
import type { RoomIntroConfig } from './types.ts'

const DEFAULT_CENTER_HEIGHT = 3.3
const DEFAULT_ARTWORK_ASPECT_RATIO = 4 / 3
const INTRO_APPROACH_DISTANCE = 2
const INTRO_SURFACE_GAP = 0.018
const TEXTURE_WIDTH = 2048
const TEXTURE_PADDING = 150

export interface RoomIntroInstance {
  readonly approachPoint: Vector3 | undefined
  readonly center: Vector3
  readonly config: RoomIntroConfig
  readonly normal: Vector3
}

interface ManagedRoomIntro extends RoomIntroInstance {
  height: number
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>
  readonly surfaceKey: string
  readonly wall: ExhibitionWall
}

interface IntroTextLayout {
  height: number
  paragraphLines: readonly (readonly string[])[]
}

/** Renders direct-to-wall text outside structural room groups and camera collision meshes. */
export class RoomIntroGallery {
  readonly group = new Group()
  private disposed = false
  private readonly intros = new Map<string, ManagedRoomIntro>()
  private readonly partitionWallIds: ReadonlySet<string>
  private readonly portals: readonly PortalConfig[]
  private readonly sourceArtworks: readonly ArtworkConfig[]
  private readonly textureAnisotropy: number
  private readonly walls = new Map<string, ExhibitionWall>()
  private readonly warnedMessages = new Set<string>()

  constructor(
    configs: readonly RoomIntroConfig[],
    walls: readonly ExhibitionWall[],
    partitionWalls: readonly ExhibitionWall[],
    pathfinder: GridPathfinder,
    sourceArtworks: readonly ArtworkConfig[],
    portals: readonly PortalConfig[],
    textureAnisotropy: number,
  ) {
    this.group.name = 'room-intro-gallery'
    this.partitionWallIds = new Set(partitionWalls.map((wall) => wall.config.id))
    this.sourceArtworks = sourceArtworks
    this.portals = portals
    this.textureAnisotropy = textureAnisotropy
    for (const wall of walls) this.walls.set(wall.config.id, wall)
    for (const config of configs) this.addIntro(config, pathfinder)
  }

  getIntroFromObject(object: Object3D): RoomIntroInstance | undefined {
    let current: Object3D | null = object
    while (current) {
      const introId = current.userData.roomIntroId
      if (typeof introId === 'string') return this.intros.get(introId)
      current = current.parent
    }
    return undefined
  }

  /** Read-only anchors allow room lighting to include wall introductions. */
  get instances(): readonly RoomIntroInstance[] {
    return [...this.intros.values()]
  }

  dispose(): void {
    this.disposed = true
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.geometry.dispose()
      object.material.map?.dispose()
      object.material.dispose()
    })
    this.group.clear()
    this.intros.clear()
  }

  private addIntro(config: RoomIntroConfig, pathfinder: GridPathfinder): void {
    const wall = this.walls.get(config.placement.wallId)
    if (!wall) {
      this.warn(`Room introduction "${config.id}" references a missing wall and was skipped.`)
      return
    }
    const isPartition = this.partitionWallIds.has(wall.config.id)
    if (isPartition && !config.placement.side) {
      this.warn(`Room introduction "${config.id}" needs a front or back side for partition "${wall.config.id}".`)
      return
    }
    if (Math.abs(config.placement.offsetX) + config.width / 2 > wall.config.length / 2) {
      this.warn(`Room introduction "${config.id}" exceeds the length of wall "${wall.config.id}".`)
      return
    }

    const placement = this.resolvePlacement(config, wall, isPartition)
    const canvas = document.createElement('canvas')
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = this.textureAnisotropy
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.01,
      side: FrontSide,
    })
    const mesh = new Mesh(new PlaneGeometry(config.width, 1), material)
    mesh.name = `${config.id}:text`
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.renderOrder = 1

    const root = new Group()
    root.name = `room-intro:${config.id}`
    root.userData.roomIntroId = config.id
    root.position.copy(placement.center)
    root.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), placement.normal)
    root.add(mesh)

    const intro: ManagedRoomIntro = {
      approachPoint: this.findApproachPoint(placement.center, placement.normal, pathfinder),
      center: placement.center,
      config,
      height: 1,
      mesh,
      normal: placement.normal,
      surfaceKey: placement.surfaceKey,
      wall,
    }
    if (!intro.approachPoint) this.warn(`Room introduction "${config.id}" has no walkable approach point.`)
    this.intros.set(config.id, intro)

    void document.fonts.ready.then(() => {
      if (this.disposed || !this.intros.has(config.id)) return
      this.redrawIntro(intro, canvas, texture)
      this.validatePlacement(intro)
      this.group.add(root)
    })
  }

  private resolvePlacement(
    config: RoomIntroConfig,
    wall: ExhibitionWall,
    isPartition: boolean,
  ): { center: Vector3; normal: Vector3; surfaceKey: string } {
    wall.group.updateWorldMatrix(true, false)
    const wallCenter = wall.group.getWorldPosition(new Vector3())
    const localX = new Vector3(1, 0, 0).transformDirection(wall.group.matrixWorld)
    const front = new Vector3(0, 0, 1).transformDirection(wall.group.matrixWorld)
    const side = config.placement.side
    let normal: Vector3
    let surface: ArtworkSide

    if (isPartition) {
      const partitionSide = side!
      normal = partitionSide === 'front' ? front : front.multiplyScalar(-1)
      surface = partitionSide
    } else if (side) {
      normal = side === 'front' ? front : front.multiplyScalar(-1)
      surface = side
    } else {
      const back = front.clone().multiplyScalar(-1)
      const towardRoom = new Vector3(-wallCenter.x, 0, -wallCenter.z)
      const usesFront = front.dot(towardRoom) >= back.dot(towardRoom)
      normal = usesFront ? front : back
      surface = usesFront ? 'front' : 'back'
    }

    normal.y = 0
    normal.normalize()
    const center = wallCenter.addScaledVector(localX, config.placement.offsetX)
    center.y = config.placement.centerHeight ?? DEFAULT_CENTER_HEIGHT
    center.addScaledVector(normal, wall.config.thickness / 2 + INTRO_SURFACE_GAP)
    return { center, normal, surfaceKey: `${wall.config.id}:${surface}` }
  }

  private redrawIntro(intro: ManagedRoomIntro, canvas: HTMLCanvasElement, texture: CanvasTexture): void {
    const height = this.renderTextCanvas(canvas, intro.config)
    intro.height = height
    intro.mesh.geometry.dispose()
    intro.mesh.geometry = new PlaneGeometry(intro.config.width, height)
    texture.needsUpdate = true
  }

  private renderTextCanvas(canvas: HTMLCanvasElement, config: RoomIntroConfig): number {
    canvas.width = TEXTURE_WIDTH
    canvas.height = 32
    let context = canvas.getContext('2d')
    if (!context) return 1
    let layout = this.layoutText(context, config)
    canvas.height = layout.height
    context = canvas.getContext('2d')
    if (!context) return 1
    layout = this.layoutText(context, config)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.textBaseline = 'alphabetic'
    let y = TEXTURE_PADDING

    context.font = '600 43px Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif'
    context.fillStyle = '#5e7a55'
    context.fillText(config.roomName, TEXTURE_PADDING, y + 43)
    y += 88
    context.font = '600 96px Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif'
    context.fillStyle = '#35362f'
    context.fillText(config.title, TEXTURE_PADDING, y + 96)
    y += 150
    context.font = '400 41px Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif'
    context.fillStyle = '#59574f'

    for (const paragraph of layout.paragraphLines) {
      for (const line of paragraph) {
        context.fillText(line, TEXTURE_PADDING, y + 41)
        y += 62
      }
      y += 36
    }
    return (layout.height / TEXTURE_WIDTH) * config.width
  }

  private layoutText(context: CanvasRenderingContext2D, config: RoomIntroConfig): IntroTextLayout {
    const maxWidth = TEXTURE_WIDTH - TEXTURE_PADDING * 2
    context.font = '400 41px Inter, Pretendard, "Noto Sans KR", system-ui, sans-serif'
    const paragraphLines = config.paragraphs.map((paragraph) => this.wrapText(context, paragraph, maxWidth))
    const bodyHeight = paragraphLines.reduce((total, lines) => total + lines.length * 62 + 36, 0)
    return {
      height: Math.ceil(TEXTURE_PADDING + 88 + 150 + bodyHeight + TEXTURE_PADDING),
      paragraphLines,
    }
  }

  private wrapText(context: CanvasRenderingContext2D, text: string, maximumWidth: number): string[] {
    const lines: string[] = []
    let line = ''
    for (const character of text) {
      const nextLine = `${line}${character}`
      if (line && context.measureText(nextLine).width > maximumWidth) {
        lines.push(line.trimEnd())
        line = character === ' ' ? '' : character
      } else {
        line = nextLine
      }
    }
    if (line) lines.push(line.trimEnd())
    return lines
  }

  private findApproachPoint(center: Vector3, normal: Vector3, pathfinder: GridPathfinder): Vector3 | undefined {
    for (const distance of [INTRO_APPROACH_DISTANCE, INTRO_APPROACH_DISTANCE + 0.35, INTRO_APPROACH_DISTANCE + 0.7, INTRO_APPROACH_DISTANCE + 1.05]) {
      const point = center.clone().addScaledVector(normal, distance)
      if (pathfinder.isWalkableDestination(point)) return point.setY(0)
    }
    return undefined
  }

  private validatePlacement(intro: ManagedRoomIntro): void {
    const { config, wall } = intro
    const exceedsWallHeight = intro.center.y - intro.height / 2 < 0 || intro.center.y + intro.height / 2 > wall.config.height
    if (exceedsWallHeight) this.warn(`Room introduction "${config.id}" exceeds the height of wall "${wall.config.id}".`)

    for (const artwork of this.sourceArtworks) {
      if (artwork.placement.wallId !== wall.config.id || artwork.placement.side !== this.getIntroSide(intro.surfaceKey)) continue
      const artworkHeight = artwork.width / DEFAULT_ARTWORK_ASPECT_RATIO
      const artworkCenterHeight = artwork.placement.centerHeight ?? 2.65
      if (this.rectanglesOverlap(config.placement.offsetX, config.width, intro.center.y, intro.height, artwork.placement.offsetX, artwork.width, artworkCenterHeight, artworkHeight)) {
        this.warn(`Room introduction "${config.id}" overlaps artwork "${artwork.id}" on the same wall face.`)
      }
    }

    for (const portal of this.portals) {
      if (portal.wallId !== wall.config.id) continue
      if (this.getPortalSurfaceKey(wall) !== intro.surfaceKey) continue
      if (this.rectanglesOverlap(config.placement.offsetX, config.width, intro.center.y, intro.height, portal.offsetX, PORTAL_WIDTH, PORTAL_LABEL_HEIGHT / 2, Math.max(PORTAL_HEIGHT, PORTAL_LABEL_HEIGHT))) {
        this.warn(`Room introduction "${config.id}" overlaps portal "${portal.id}" on wall "${wall.config.id}".`)
      }
    }

    for (const other of this.intros.values()) {
      if (other === intro || other.surfaceKey !== intro.surfaceKey) continue
      if (this.rectanglesOverlap(config.placement.offsetX, config.width, intro.center.y, intro.height, other.config.placement.offsetX, other.config.width, other.center.y, other.height)) {
        this.warn(`Room introduction "${config.id}" overlaps "${other.config.id}" on the same wall face.`)
      }
    }
  }

  private rectanglesOverlap(
    firstX: number,
    firstWidth: number,
    firstY: number,
    firstHeight: number,
    secondX: number,
    secondWidth: number,
    secondY: number,
    secondHeight: number,
  ): boolean {
    return Math.abs(firstX - secondX) < (firstWidth + secondWidth) / 2 && Math.abs(firstY - secondY) < (firstHeight + secondHeight) / 2
  }

  private getIntroSide(surfaceKey: string): ArtworkSide | undefined {
    const side = surfaceKey.split(':').at(-1)
    return side === 'front' || side === 'back' ? side : undefined
  }

  /** PortalSet always mounts portals on the same room-facing surface it computes here. */
  private getPortalSurfaceKey(wall: ExhibitionWall): string {
    wall.group.updateWorldMatrix(true, false)
    const wallCenter = wall.group.getWorldPosition(new Vector3())
    const front = new Vector3(0, 0, 1).transformDirection(wall.group.matrixWorld)
    const back = front.clone().multiplyScalar(-1)
    const towardRoom = new Vector3(-wallCenter.x, 0, -wallCenter.z)
    const side: ArtworkSide = front.dot(towardRoom) >= back.dot(towardRoom) ? 'front' : 'back'
    return `${wall.config.id}:${side}`
  }

  private warn(message: string): void {
    if (this.warnedMessages.has(message)) return
    this.warnedMessages.add(message)
    console.warn(message)
  }
}
