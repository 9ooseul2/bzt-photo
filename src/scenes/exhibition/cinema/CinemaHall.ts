import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CylinderGeometry,
  DirectionalLight,
  type BufferGeometry,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  SRGBColorSpace,
  Vector3,
  VideoTexture,
} from 'three'
import { publicAsset } from '../../../config/publicAsset.ts'
import type { AdditionalNavigationObstacle } from '../createNavigationLayout.ts'
import type { PlanPosition } from '../types.ts'
import type { CinemaConfig } from './types.ts'

/** 1인 소파 크기 (낮고 넓은 토고 스타일). 앞쪽이 로컬 -z 방향 */
const SOFA = {
  width: 0.9,
  depth: 0.8,
  /** 앉았을 때 엉덩이가 닿는 높이 */
  seatTop: 0.36,
}
/** 소파 중심에서, 앉기 전에 서는 자리까지의 거리 */
const APPROACH_DISTANCE = 0.85
/** 스탠드·스피커가 차지하는 바닥 넓이 */
const PROP_FOOTPRINT = 0.48

export interface CinemaSeat {
  id: string
  /** 앉았을 때 캐릭터가 놓일 바닥 위치 */
  position: PlanPosition
  /** 소파 앞에 서는 자리 (여기까지 걸어온 뒤 앉는다) */
  approachPoint: PlanPosition
  /** 앉았을 때 엉덩이가 닿는 높이 */
  seatTop: number
  object: Group
}

interface SofaPlacement {
  x: number
  z: number
  /** 스크린 가운데를 바라보도록 돌린 각도 */
  rotationY: number
}

/**
 * 영상관: 벽에 걸린 프로젝터 스크린 + 1인 소파 + 따뜻한 조명.
 * 앉기 전에는 스크린에 정지 이미지만 보여주고 영상 파일은 받지 않는다 (전송량 절약).
 * 소파에 앉으면 그 사람 화면에서만 영상이 0초부터 소리와 함께 재생되고, 일어나면 멈춘다.
 */
export class CinemaHall {
  readonly group = new Group()
  readonly seats: readonly CinemaSeat[]
  readonly screenCenter: Vector3
  private readonly video: HTMLVideoElement
  private readonly texture: VideoTexture
  private readonly poster: ScreenPoster
  private readonly screenMaterial: MeshBasicMaterial
  private isScreening = false

  constructor(config: CinemaConfig) {
    this.group.name = 'cinema-hall'

    // 영상
    this.video = document.createElement('video')
    this.video.src = publicAsset(config.videoUrl)
    this.video.crossOrigin = 'anonymous'
    this.video.loop = true
    this.video.muted = true
    this.video.playsInline = true
    // 포스터가 있으면 앉을 때까지 영상을 전혀 받지 않고, 없으면 첫 장면을 그릴 만큼만 받는다
    this.video.preload = config.posterUrl ? 'none' : 'metadata'
    this.texture = new VideoTexture(this.video)
    this.texture.colorSpace = SRGBColorSpace
    this.poster = new ScreenPoster(config.screenMessage)
    if (config.posterUrl) this.poster.drawImageFrom(publicAsset(config.posterUrl))
    else this.poster.drawFirstFrameOf(this.video)
    this.screenMaterial = new MeshBasicMaterial({ map: this.poster.texture, toneMapped: false })

    this.screenCenter = new Vector3(0, config.screen.centerY, config.screen.z)
    this.createScreen(config)
    this.createWallLamps(config)
    this.createFloorLamps(config)
    this.createSpeakers(config)
    this.seats = this.createSofas(config)
  }

  /** 소파 클릭 판정용 */
  getSeatFromObject(object: Object3D): CinemaSeat | undefined {
    let current: Object3D | null = object
    while (current) {
      const seatId = current.userData.cinemaSeatId as string | undefined
      if (seatId) return this.seats.find((seat) => seat.id === seatId)
      current = current.parent
    }
    return undefined
  }

  /**
   * 소파를 클릭(또는 Space)한 바로 그 순간에 부른다. 걸어가는 동안 영상을 미리 받기 시작하고,
   * 클릭 순간에 한 번 재생해 둬야 휴대폰 브라우저도 나중에 소리 재생을 허락한다.
   */
  prepare(): void {
    if (this.isScreening || !this.video.paused) return
    this.video.muted = true
    void this.video
      .play()
      .then(() => {
        if (!this.isScreening) this.video.pause()
      })
      .catch(() => undefined)
  }

  /** 앉았을 때: 스크린을 영상으로 바꾸고 0초부터 소리와 함께 재생 */
  startScreening(): void {
    this.isScreening = true
    this.screenMaterial.map = this.texture
    this.screenMaterial.needsUpdate = true
    this.video.currentTime = 0
    this.video.muted = false
    void this.video.play().catch(() => {
      // 브라우저가 소리 재생을 막으면 소리 없이라도 재생한다
      this.video.muted = true
      void this.video.play().catch(() => undefined)
    })
  }

  /** 일어났을 때: 영상을 멈추고 정지 이미지로 돌아간다 */
  stopScreening(): void {
    this.isScreening = false
    this.video.pause()
    this.screenMaterial.map = this.poster.texture
    this.screenMaterial.needsUpdate = true
  }

  dispose(): void {
    this.isScreening = false
    this.poster.dispose()
    this.video.pause()
    this.video.removeAttribute('src')
    this.video.load()
    this.texture.dispose()
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry as BufferGeometry)
      materials.add(object.material as Material)
    })
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    this.group.clear()
  }

  /** 벽걸이 프로젝터 스크린: 영상(앉기 전에는 정지 이미지) + 밝은 천 테두리 + 위쪽 검정 롤 케이스 */
  private createScreen(config: CinemaConfig): void {
    const { width, centerY, z, borderColor } = config.screen
    const height = (width * 9) / 16

    // 영상은 빛을 받지 않고 스스로 밝게 보이도록 MeshBasicMaterial
    const screen = new Mesh(new PlaneGeometry(width, height), this.screenMaterial)
    screen.name = 'cinema-screen'
    screen.position.set(0, centerY, z)

    const border = new Mesh(new PlaneGeometry(width + 0.24, height + 0.34), new MeshStandardMaterial({ color: borderColor, roughness: 0.9 }))
    border.position.set(0, centerY - 0.04, z - 0.01)

    const roller = new Mesh(new BoxGeometry(width + 0.5, 0.14, 0.14), new MeshStandardMaterial({ color: '#1d1a18', roughness: 0.5 }))
    roller.position.set(0, centerY + height / 2 + 0.2, z + 0.02)

    // 스크린에서 객석 쪽으로 은은하게 비치는 빛
    const glow = new DirectionalLight('#ffe8d2', 1.1)
    glow.position.set(0, centerY, z)
    glow.target.position.set(0, 0, z + 12)
    this.group.add(screen, border, roller, glow, glow.target)
  }

  /** 양옆 벽의 작은 벽등: 빛나는 갓 + 위아래 나무 캡 + 따뜻한 빛 */
  private createWallLamps(config: CinemaConfig): void {
    const { wallX, z: lampZ, height, intensity } = config.wallLamps
    const shadeMaterial = new MeshBasicMaterial({ color: config.lampColor, toneMapped: false })
    const capMaterial = new MeshStandardMaterial({ color: '#3a2b22', roughness: 0.6 })
    const shadeGeometry = new BoxGeometry(0.1, 0.34, 0.26)
    const capGeometry = new BoxGeometry(0.12, 0.04, 0.3)
    for (const side of [-1, 1]) {
      for (const z of lampZ) {
        const x = side * wallX - side * 0.06
        const shade = new Mesh(shadeGeometry, shadeMaterial)
        shade.position.set(x, height, z)
        const capTop = new Mesh(capGeometry, capMaterial)
        capTop.position.set(x, height + 0.19, z)
        const capBottom = new Mesh(capGeometry, capMaterial)
        capBottom.position.set(x, height - 0.19, z)
        const light = new PointLight(config.lampColor, intensity, 5.5, 2)
        light.position.set(side * wallX - side * 0.45, height, z)
        this.group.add(shade, capTop, capBottom, light)
      }
    }
  }

  /** 키 큰 스탠드 조명 */
  private createFloorLamps(config: CinemaConfig): void {
    const brass = new MeshStandardMaterial({ color: '#8a6a3c', roughness: 0.4, metalness: 0.5 })
    const shadeMaterial = new MeshBasicMaterial({ color: config.lampColor, toneMapped: false })
    for (const position of config.floorLamps) {
      const lamp = new Group()
      lamp.position.set(position.x, 0, position.z)
      addMesh(lamp, new CylinderGeometry(0.16, 0.18, 0.03, 20), brass, 0, 0.015, 0)
      addMesh(lamp, new CylinderGeometry(0.015, 0.015, 1.5, 8), brass, 0, 0.78, 0)
      addMesh(lamp, new CylinderGeometry(0.15, 0.24, 0.3, 24, 1, true), shadeMaterial, 0, 1.6, 0)
      const light = new PointLight(config.lampColor, 3.2, 5.5, 2)
      light.position.set(0, 1.5, 0)
      lamp.add(light)
      this.group.add(lamp)
    }
  }

  /** 삼각대 스피커 */
  private createSpeakers(config: CinemaConfig): void {
    const black = new MeshStandardMaterial({ color: '#1d1a18', roughness: 0.5 })
    const legGeometry = new CylinderGeometry(0.012, 0.012, 1.1, 6)
    for (const position of config.speakers) {
      const speaker = new Group()
      speaker.position.set(position.x, 0, position.z)
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI * 2
        const leg = addMesh(speaker, legGeometry, black, Math.cos(angle) * 0.18, 0.52, Math.sin(angle) * 0.18)
        leg.rotation.set(Math.sin(angle) * 0.32, 0, -Math.cos(angle) * 0.32)
      }
      addMesh(speaker, new CylinderGeometry(0.02, 0.02, 0.5, 8), black, 0, 1.2, 0)
      addMesh(speaker, new BoxGeometry(0.36, 0.58, 0.3), black, 0, 1.68, 0)
      this.group.add(speaker)
    }
  }

  /** 1인 소파 (토고 스타일): 둥글고 낮은 방석 + 뒤로 기댄 통통한 등받이 + 옆 주름 */
  private createSofas(config: CinemaConfig): CinemaSeat[] {
    const fabric = new MeshStandardMaterial({ color: config.sofaColor, roughness: 1 })
    const W = SOFA.width
    // 모든 소파가 같은 모양이라 형태(geometry)를 한 번만 만들어 함께 쓴다
    const shapes = {
      seat: puffGeometry(W, 0.34),
      seatFront: puffGeometry(W - 0.06, 0.3),
      back: puffGeometry(W - 0.04, 0.62),
      backFold1: puffGeometry(W - 0.14, 0.13),
      backFold2: puffGeometry(W - 0.2, 0.12),
      flare: new CapsuleGeometry(0.1, 0.42, 6, 14),
    }

    return getSofaPlacements(config).map((placement, index) => {
      const id = `seat-${index + 1}`
      const sofa = new Group()
      sofa.name = id
      sofa.position.set(placement.x, 0, placement.z)
      sofa.rotation.y = placement.rotationY

      // 방석: 넓고 낮은 덩어리 + 앞쪽 볼록한 주름
      addPuff(sofa, shapes.seat, fabric, 0.34, 0.74, 0, 0.17, 0.02)
      addPuff(sofa, shapes.seatFront, fabric, 0.3, 0.26, 0, 0.17, -0.27)
      // 등받이: 통통한 판을 뒤로 기울이고, 앞면에 가로 주름 두 줄
      const back = new Group()
      back.position.set(0, 0.34, 0.3)
      back.rotation.x = -0.32
      sofa.add(back)
      addPuff(back, shapes.back, fabric, 0.62, 0.3, 0, 0.3, 0)
      addPuff(back, shapes.backFold1, fabric, 0.13, 0.1, 0, 0.2, -0.13)
      addPuff(back, shapes.backFold2, fabric, 0.12, 0.09, 0, 0.42, -0.12)
      // 옆쪽: 방석 위로 살짝 말려 올라온 주름
      for (const side of [-1, 1]) {
        const flare = addMesh(sofa, shapes.flare, fabric, side * (W / 2 - 0.08), 0.36, 0.02)
        flare.rotation.x = Math.PI / 2 - 0.35
      }

      sofa.traverse((part) => {
        part.userData.cinemaSeatId = id
      })
      this.group.add(sofa)

      // 소파 앞(스크린 쪽) 방향
      const forwardX = -Math.sin(placement.rotationY)
      const forwardZ = -Math.cos(placement.rotationY)
      return {
        id,
        position: { x: placement.x - forwardX * 0.04, z: placement.z - forwardZ * 0.04 },
        approachPoint: { x: placement.x + forwardX * APPROACH_DISTANCE, z: placement.z + forwardZ * APPROACH_DISTANCE },
        seatTop: SOFA.seatTop,
        object: sofa,
      }
    })
  }
}

/**
 * 앉기 전 스크린 그림: 정지 이미지(포스터 또는 영상 첫 장면)를 어둡게 깔고
 * 가운데에 재생 버튼과 안내 문구를 그린다. 이미지가 오기 전에는 어두운 바탕에 문구만 보인다.
 */
class ScreenPoster {
  readonly texture: CanvasTexture
  private readonly canvas = document.createElement('canvas')
  private readonly message: string
  private image: CanvasImageSource | undefined
  private disposed = false
  private readonly cleanups: Array<() => void> = []

  constructor(message: string) {
    this.message = message
    this.canvas.width = 1280
    this.canvas.height = 720
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.redraw()
    // 사이트 글꼴이 늦게 도착하면 문구를 다시 그린다
    void document.fonts?.ready.then(() => this.redraw())
  }

  drawImageFrom(url: string): void {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      this.image = image
      this.redraw()
    }
    image.src = url
  }

  /** 영상의 맨 앞 장면으로 이동시켜 그 한 장면만 받아서 그린다 */
  drawFirstFrameOf(video: HTMLVideoElement): void {
    const onMetadata = () => {
      video.currentTime = 0.01
    }
    const onSeeked = () => {
      if (this.image) return
      this.image = video
      this.redraw()
      // 이후 영상이 재생돼도 정지 이미지가 바뀌지 않도록, 지금 그린 그림으로 고정한다
      const snapshot = document.createElement('canvas')
      snapshot.width = this.canvas.width
      snapshot.height = this.canvas.height
      snapshot.getContext('2d')?.drawImage(video, 0, 0, snapshot.width, snapshot.height)
      this.image = snapshot
    }
    video.addEventListener('loadedmetadata', onMetadata, { once: true })
    video.addEventListener('seeked', onSeeked, { once: true })
    this.cleanups.push(() => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('seeked', onSeeked)
    })
  }

  dispose(): void {
    this.disposed = true
    this.cleanups.forEach((cleanup) => cleanup())
    this.texture.dispose()
  }

  private redraw(): void {
    if (this.disposed) return
    const context = this.canvas.getContext('2d')
    if (!context) return
    const { width, height } = this.canvas
    context.fillStyle = '#14100d'
    context.fillRect(0, 0, width, height)
    if (this.image) {
      context.drawImage(this.image, 0, 0, width, height)
      context.fillStyle = 'rgba(10, 8, 6, 0.6)'
      context.fillRect(0, 0, width, height)
    }
    // 재생 버튼
    context.fillStyle = 'rgba(255, 255, 255, 0.92)'
    context.beginPath()
    context.arc(width / 2, 320, 62, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#1a1410'
    context.beginPath()
    context.moveTo(width / 2 - 20, 290)
    context.lineTo(width / 2 - 20, 350)
    context.lineTo(width / 2 + 32, 320)
    context.closePath()
    context.fill()
    // 안내 문구 (사이트와 같은 글꼴)
    const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif'
    context.fillStyle = '#ffffff'
    context.font = `600 44px ${fontFamily}`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(this.message, width / 2, 450)
    this.texture.needsUpdate = true
  }
}

/** 소파, 스탠드, 스피커를 길찾기 장애물로 (소파 앞과 줄 사이·통로로 걸어다니게) */
export function getCinemaNavigationObstacles(config: CinemaConfig): AdditionalNavigationObstacle[] {
  const sofas = getSofaPlacements(config).map((placement, index) => ({
    id: `cinema-sofa-${index + 1}`,
    center: { x: placement.x, z: placement.z },
    length: SOFA.width,
    thickness: SOFA.depth,
    rotationY: placement.rotationY,
  }))
  const props = [...config.floorLamps, ...config.speakers].map((position, index) => ({
    id: `cinema-prop-${index + 1}`,
    center: { x: position.x, z: position.z },
    length: PROP_FOOTPRINT,
    thickness: PROP_FOOTPRINT,
    rotationY: 0,
  }))
  return [...sofas, ...props]
}

/** 줄마다 가운데 통로 양쪽으로 소파를 놓는다. 줄 양끝은 스크린 쪽으로 살짝 휘고, 모두 스크린 가운데를 바라본다. */
function getSofaPlacements(config: CinemaConfig): SofaPlacement[] {
  const { rowZ, offsets, curve } = config.seating
  const placements: SofaPlacement[] = []
  for (const rowCenterZ of rowZ) {
    for (const side of [-1, 1]) {
      for (const offset of offsets) {
        const x = side * offset
        const z = rowCenterZ - curve * x * x
        // 의자 앞쪽(로컬 -z)이 스크린 가운데를 향하는 각도
        const rotationY = Math.atan2(x, z - config.screen.z)
        placements.push({ x, z, rotationY })
      }
    }
  }
  return placements
}

/** x축으로 누운 둥근 쿠션 모양. 실제 크기는 addPuff에서 깊이 방향으로 늘린다. */
function puffGeometry(length: number, height: number): CapsuleGeometry {
  return new CapsuleGeometry(height / 2, Math.max(0.01, length - height), 8, 20)
}

function addPuff(parent: Group, geometry: CapsuleGeometry, material: Material, height: number, depth: number, x: number, y: number, z: number): Mesh {
  const mesh = addMesh(parent, geometry, material, x, y, z)
  mesh.rotation.z = Math.PI / 2
  mesh.scale.set(1, 1, depth / height)
  return mesh
}

function addMesh(parent: Object3D, geometry: BufferGeometry, material: Material, x: number, y: number, z: number): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}
