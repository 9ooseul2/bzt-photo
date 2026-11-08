import { resolveWallConfig } from '../scenes/exhibition/createNavigationLayout.ts'
import type { ExhibitionRoomConfig, ResolvedWallConfig } from '../scenes/exhibition/types.ts'
import { formatOccupancy, type OccupancyProvider } from '../services/occupancy.ts'

export interface MinimapDoor {
  id: string
  kind: 'entrance' | 'portal'
  rotationY: number
  width: number
  x: number
  z: number
}

export interface MinimapUpdate {
  cameraDirection: { x: number; z: number }
  characterHeading: number
  characterPosition: { x: number; z: number }
}

interface MapPoint {
  x: number
  y: number
}

const CONTENT_PADDING = 14
const MAP_BACKGROUND = 'rgba(246, 242, 234, 0.39)'
const MAP_BORDER = 'rgba(255, 250, 240, 0.75)'
const WALL_GLOW = 'rgba(255, 248, 232, 0.95)'
const WALL_GLOW_SHADOW = 'rgba(255, 240, 205, 0.95)'
const WALL_LINE = '#4a443b'
const DOOR_FILL = '#f2c46d'
const DOOR_OUTLINE = '#fff6df'
const DOOR_GLOW = 'rgba(255, 214, 120, 1)'

/** Read-only, room-configured minimap with a cached static wall and door layer. */
export class Minimap {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private cssSize = 0
  private devicePixelRatio = 1
  private readonly doors: readonly MinimapDoor[]
  private readonly host: HTMLElement
  private readonly label: HTMLElement
  private readonly displayName: string
  private readonly occupancyRoomId: string
  private readonly occupancyProvider: OccupancyProvider
  private readonly room: ExhibitionRoomConfig
  private readonly resizeObserver: ResizeObserver
  private readonly staticCanvas = document.createElement('canvas')
  private staticContext: CanvasRenderingContext2D | undefined
  private readonly unsubscribe: () => void
  private readonly stopPointerEvent = (event: Event): void => {
    event.preventDefault()
    event.stopPropagation()
  }
  private readonly walls: readonly ResolvedWallConfig[]

  constructor(
    host: HTMLElement,
    room: ExhibitionRoomConfig,
    occupancyRoomId: string,
    displayName: string,
    doors: readonly MinimapDoor[],
    occupancyProvider: OccupancyProvider,
  ) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Minimap canvas is unavailable.')
    const staticContext = this.staticCanvas.getContext('2d')
    if (!staticContext) throw new Error('Minimap static canvas is unavailable.')

    this.host = host
    this.room = room
    this.occupancyRoomId = occupancyRoomId
    this.displayName = displayName
    this.doors = doors
    this.occupancyProvider = occupancyProvider
    this.canvas = canvas
    this.context = context
    this.staticContext = staticContext
    this.walls = [...room.exteriorWalls, ...room.partitions].map((wall) => resolveWallConfig(wall, room))
    this.label = document.createElement('span')
    this.label.className = 'minimap__label'
    this.updateLabel()
    this.canvas.className = 'minimap__canvas'
    this.canvas.setAttribute('aria-hidden', 'true')
    this.host.replaceChildren(this.canvas, this.label)
    this.host.setAttribute('role', 'img')
    this.host.setAttribute('aria-label', `${displayName} 미니맵, 현재 위치 표시`)
    this.host.hidden = true

    for (const eventName of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'wheel']) {
      this.host.addEventListener(eventName, this.stopPointerEvent, { passive: false })
    }
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.host)
    this.unsubscribe = this.occupancyProvider.subscribe(this.updateLabel)
  }

  setVisible(isVisible: boolean): void {
    this.host.hidden = !isVisible
    if (isVisible) this.resize()
  }

  update({ cameraDirection, characterHeading, characterPosition }: MinimapUpdate): void {
    if (this.host.hidden) return
    if (this.cssSize === 0) return

    const horizontalLength = Math.hypot(cameraDirection.x, cameraDirection.z)
    if (horizontalLength < Number.EPSILON) return
    const cameraAngle = Math.atan2(cameraDirection.z, cameraDirection.x)
    // Canvas +Y maps to world +Z. This rotates the camera's forward vector to screen up.
    const mapRotation = -Math.PI / 2 - cameraAngle
    const context = this.context
    const center = this.cssSize / 2

    context.clearRect(0, 0, this.cssSize, this.cssSize)
    context.save()
    this.clipCircle(context, center)
    context.fillStyle = MAP_BACKGROUND
    context.fillRect(0, 0, this.cssSize, this.cssSize)
    context.translate(center, center)
    context.rotate(mapRotation)
    context.translate(-center, -center)
    context.drawImage(this.staticCanvas, 0, 0, this.cssSize, this.cssSize)
    context.restore()

    this.drawNorthMarker(context, center, mapRotation)
    this.drawVisitor(context, center, mapRotation, characterPosition, characterHeading)
    context.beginPath()
    context.arc(center, center, center - 0.75, 0, Math.PI * 2)
    context.strokeStyle = MAP_BORDER
    context.lineWidth = 1
    context.stroke()
  }

  dispose(): void {
    this.unsubscribe()
    this.resizeObserver.disconnect()
    for (const eventName of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click', 'contextmenu', 'wheel']) {
      this.host.removeEventListener(eventName, this.stopPointerEvent)
    }
    this.host.hidden = true
    this.host.replaceChildren()
    this.canvas.width = 0
    this.canvas.height = 0
    this.staticCanvas.width = 0
    this.staticCanvas.height = 0
  }

  private resize(): void {
    const size = Math.round(Math.min(this.host.clientWidth, this.host.clientHeight - this.label.offsetHeight))
    if (size <= 0) return
    const ratio = window.devicePixelRatio || 1
    if (size === this.cssSize && ratio === this.devicePixelRatio) return

    this.cssSize = size
    this.devicePixelRatio = ratio
    for (const canvas of [this.canvas, this.staticCanvas]) {
      canvas.width = Math.round(size * ratio)
      canvas.height = Math.round(size * ratio)
    }
    this.canvas.style.width = `${size}px`
    this.canvas.style.height = `${size}px`
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.staticContext!.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.drawStaticLayer()
  }

  private readonly updateLabel = (): void => {
    const count = this.occupancyProvider.getCount(this.occupancyRoomId)
    this.label.textContent = count === null ? this.displayName : `${this.displayName} · ${formatOccupancy(count)}`
  }

  private drawStaticLayer(): void {
    const context = this.staticContext
    if (!context || this.cssSize === 0) return
    const center = this.cssSize / 2
    context.clearRect(0, 0, this.cssSize, this.cssSize)
    // Keep the static canvas edge clear so rotated glow is not cropped before the main canvas clips it.
    for (const wall of this.walls) this.drawWall(context, wall, center)
    for (const door of this.doors) this.drawDoor(context, door, center)
  }

  private drawWall(context: CanvasRenderingContext2D, wall: ResolvedWallConfig, center: number): void {
    const position = this.toBasePoint(wall.position.x, wall.position.z, center)
    const baseLineWidth = Math.max(1.3, wall.thickness * this.scale) * 1.25
    context.save()
    context.translate(position.x, position.y)
    // World Y rotation maps to the opposite Canvas angle because Canvas Y points downward.
    context.rotate(-wall.rotationY)
    context.lineCap = 'round'
    context.lineWidth = baseLineWidth * 2.4
    context.strokeStyle = WALL_GLOW
    context.shadowColor = WALL_GLOW_SHADOW
    context.shadowBlur = this.shadowBlur(7)
    context.beginPath()
    context.moveTo((-wall.length / 2) * this.scale, 0)
    context.lineTo((wall.length / 2) * this.scale, 0)
    context.stroke()
    this.clearShadow(context)

    context.lineWidth = baseLineWidth
    context.strokeStyle = WALL_LINE
    context.beginPath()
    context.moveTo((-wall.length / 2) * this.scale, 0)
    context.lineTo((wall.length / 2) * this.scale, 0)
    context.stroke()
    context.restore()
  }

  private drawDoor(context: CanvasRenderingContext2D, door: MinimapDoor, center: number): void {
    const position = this.toBasePoint(door.x, door.z, center)
    context.save()
    context.translate(position.x, position.y)
    context.rotate(-door.rotationY)

    if (door.kind === 'entrance') {
      const halfWidth = (door.width * this.scale) / 2
      context.clearRect(-halfWidth - 9, -10, halfWidth * 2 + 18, 20)
      context.fillStyle = DOOR_FILL
      context.strokeStyle = DOOR_OUTLINE
      context.lineWidth = 1
      context.shadowColor = DOOR_GLOW
      context.shadowBlur = this.shadowBlur(11)
      for (const x of [-halfWidth, halfWidth]) {
        context.fillRect(x - 0.85, -3.4, 1.7, 6.8)
        context.strokeRect(x - 0.85, -3.4, 1.7, 6.8)
      }
      this.clearShadow(context)
    } else {
      context.strokeStyle = DOOR_OUTLINE
      context.lineWidth = 1.35
      context.fillStyle = DOOR_FILL
      context.shadowColor = DOOR_GLOW
      context.shadowBlur = this.shadowBlur(11)
      context.beginPath()
      context.arc(0, 0, 4.1, Math.PI, 0)
      context.lineTo(4.1, 4.2)
      context.lineTo(-4.1, 4.2)
      context.closePath()
      context.fill()
      context.stroke()
      this.clearShadow(context)
    }
    context.restore()
  }

  private drawNorthMarker(context: CanvasRenderingContext2D, center: number, rotation: number): void {
    const north = this.rotatePoint({ x: 0, y: -1 }, rotation)
    const radius = center - 8
    context.save()
    context.font = '600 9px Inter, Pretendard, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.strokeStyle = 'rgba(255, 250, 240, 0.95)'
    context.lineWidth = 1.3
    context.shadowColor = 'rgba(255, 250, 240, 0.95)'
    context.shadowBlur = this.shadowBlur(3)
    context.strokeText('N', center + north.x * radius, center + north.y * radius)
    this.clearShadow(context)
    context.fillStyle = '#3e3a33'
    context.fillText('N', center + north.x * radius, center + north.y * radius)
    context.restore()
  }

  private drawVisitor(
    context: CanvasRenderingContext2D,
    center: number,
    mapRotation: number,
    position: { x: number; z: number },
    heading: number,
  ): void {
    const point = this.rotatePoint(this.toBasePoint(position.x, position.z, center), mapRotation, center)
    const headingVector = this.rotatePoint({ x: Math.sin(heading), y: Math.cos(heading) }, mapRotation)
    const directionAngle = Math.atan2(headingVector.y, headingVector.x)

    context.save()
    context.translate(point.x, point.y)
    context.fillStyle = 'rgba(255, 255, 240, 0.55)'
    context.beginPath()
    context.arc(0, 0, 13, 0, Math.PI * 2)
    context.fill()
    context.rotate(directionAngle + Math.PI / 2)
    context.fillStyle = '#5e7a55'
    context.strokeStyle = '#fffdf5'
    context.lineWidth = 1.5
    context.lineJoin = 'round'
    context.shadowColor = 'rgba(255, 255, 240, 1)'
    context.shadowBlur = this.shadowBlur(9)
    context.beginPath()
    context.moveTo(0, -7)
    context.lineTo(4.8, 5.2)
    context.lineTo(0, 3.25)
    context.lineTo(-4.8, 5.2)
    context.closePath()
    context.fill()
    context.stroke()
    this.clearShadow(context)
    context.fillStyle = '#e9f0e3'
    context.beginPath()
    context.arc(0, 1.8, 1.5, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }

  private get scale(): number {
    const roomRadius = Math.hypot(this.room.dimensions.width, this.room.dimensions.depth) / 2 + 0.65
    return (this.cssSize / 2 - CONTENT_PADDING) / roomRadius
  }

  private shadowBlur(cssPixels: number): number {
    return cssPixels * this.devicePixelRatio
  }

  private clearShadow(context: CanvasRenderingContext2D): void {
    context.shadowBlur = 0
    context.shadowColor = 'transparent'
    context.shadowOffsetX = 0
    context.shadowOffsetY = 0
  }

  private toBasePoint(x: number, z: number, center: number): MapPoint {
    return { x: center + x * this.scale, y: center + z * this.scale }
  }

  private rotatePoint(point: MapPoint, angle: number, center = 0): MapPoint {
    const x = point.x - center
    const y = point.y - center
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    return { x: center + x * cosine - y * sine, y: center + x * sine + y * cosine }
  }

  private clipCircle(context: CanvasRenderingContext2D, center: number): void {
    context.beginPath()
    context.arc(center, center, center - 1, 0, Math.PI * 2)
    context.clip()
  }
}
