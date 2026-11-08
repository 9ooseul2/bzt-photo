import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector3,
} from 'three'
import {
  PORTAL_FRAME_THICKNESS,
  PORTAL_FRAME_WIDTH,
  PORTAL_HEIGHT,
  PORTAL_BASE_OPACITY,
  PORTAL_LABEL_FLOAT_AMPLITUDE,
  PORTAL_LABEL_FLOAT_PERIOD,
  PORTAL_LABEL_HEIGHT,
  PORTAL_PULSE_AMPLITUDE,
  PORTAL_PULSE_PERIOD,
  PORTAL_WIDTH,
} from './portalConfig.ts'
import type { PortalConfig } from './types.ts'

interface PortalVisual {
  group: Group
  label: Mesh<PlaneGeometry, MeshBasicMaterial>
  labelBaseY: number
  portalMaterial: MeshBasicMaterial
}

/** A calm procedural stand-in that can later be replaced by a single GLB door. */
export class PortalDoor {
  readonly group: Group
  private readonly label: Mesh<PlaneGeometry, MeshBasicMaterial>
  private readonly labelBaseY: number
  private readonly portalMaterial: MeshBasicMaterial

  constructor(config: PortalConfig) {
    const visual = createPortalVisual(config)
    this.group = visual.group
    this.label = visual.label
    this.labelBaseY = visual.labelBaseY
    this.portalMaterial = visual.portalMaterial
  }

  update(elapsedSeconds: number): void {
    this.portalMaterial.opacity = PORTAL_BASE_OPACITY + Math.sin((elapsedSeconds / PORTAL_PULSE_PERIOD) * Math.PI * 2) * PORTAL_PULSE_AMPLITUDE
    this.label.position.y = this.labelBaseY + Math.sin((elapsedSeconds / PORTAL_LABEL_FLOAT_PERIOD) * Math.PI * 2) * PORTAL_LABEL_FLOAT_AMPLITUDE
  }

  dispose(): void {
    const geometries = new Set<BufferGeometryLike>()
    const materials = new Set<MeshBasicMaterial | MeshStandardMaterial>()
    const textures = new Set<Texture>()
    this.group.traverse((object) => {
      if (!(object instanceof Mesh)) return
      geometries.add(object.geometry)
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of objectMaterials) {
        const textured = material as MeshBasicMaterial
        if (textured.map) textures.add(textured.map)
        materials.add(material as MeshBasicMaterial | MeshStandardMaterial)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    this.group.clear()
  }
}

type BufferGeometryLike = BoxGeometry | PlaneGeometry | ShapeGeometry | TubeGeometry

/** Keeps every primitive used by the temporary portal exterior in one replaceable function. */
export function createPortalVisual(config: PortalConfig): PortalVisual {
  const group = new Group()
  group.name = `portal:${config.id}`
  group.userData.portalId = config.id

  const straightHeight = PORTAL_HEIGHT - PORTAL_WIDTH / 2
  const frameRadius = PORTAL_WIDTH / 2 - PORTAL_FRAME_WIDTH / 2
  const frameMaterial = new MeshStandardMaterial({ color: '#9a795d', roughness: 0.78, metalness: 0 })
  const pillarGeometry = new BoxGeometry(PORTAL_FRAME_WIDTH, straightHeight, PORTAL_FRAME_THICKNESS)
  const leftPillar = new Mesh(pillarGeometry, frameMaterial)
  const rightPillar = leftPillar.clone()
  leftPillar.position.set(-frameRadius, straightHeight / 2, 0)
  rightPillar.position.set(frameRadius, straightHeight / 2, 0)

  const archPoints = Array.from({ length: 25 }, (_, index) => {
    const angle = (index / 24) * Math.PI
    return new Vector3(Math.cos(angle) * frameRadius, straightHeight + Math.sin(angle) * frameRadius, 0)
  })
  const arch = new Mesh(
    new TubeGeometry(new CatmullRomCurve3(archPoints), 32, PORTAL_FRAME_WIDTH / 2, 10, false),
    frameMaterial,
  )

  for (const framePart of [leftPillar, rightPillar, arch]) {
    framePart.castShadow = false
    framePart.receiveShadow = true
  }

  const portalTexture = createPortalTexture()
  const portalMaterial = new MeshBasicMaterial({
    map: portalTexture,
    transparent: true,
    opacity: PORTAL_BASE_OPACITY,
    depthWrite: false,
  })
  const portalSurface = new Mesh(createArchShapeGeometry(), portalMaterial)
  portalSurface.name = `${config.id}:light`
  portalSurface.position.z = PORTAL_FRAME_THICKNESS / 2 + 0.006
  portalSurface.renderOrder = 1

  const { mesh: label, texture: labelTexture } = createLabel(config.label)
  label.name = `${config.id}:label`
  label.position.set(0, PORTAL_LABEL_HEIGHT, PORTAL_FRAME_THICKNESS / 2 + 0.016)
  label.renderOrder = 2

  const floorLight = new PointLight('#ffe0af', 0.28, 3.1)
  floorLight.position.set(0, 0.45, 0.9)
  floorLight.castShadow = false
  group.add(leftPillar, rightPillar, arch, portalSurface, label, floorLight)
  // Retained through materials, but naming the texture keeps resource ownership clear to future GLB work.
  group.userData.portalTextures = [portalTexture, labelTexture]
  return { group, label, labelBaseY: PORTAL_LABEL_HEIGHT, portalMaterial }
}

function createArchShapeGeometry(): ShapeGeometry {
  const halfWidth = PORTAL_WIDTH / 2
  const straightHeight = PORTAL_HEIGHT - halfWidth
  const shape = new Shape()
  shape.moveTo(-halfWidth, 0)
  shape.lineTo(halfWidth, 0)
  shape.lineTo(halfWidth, straightHeight)
  shape.absarc(0, straightHeight, halfWidth, 0, Math.PI, false)
  shape.lineTo(-halfWidth, 0)
  return new ShapeGeometry(shape, 28)
}

function createPortalTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1400
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(512, 660, 80, 512, 660, 700)
    gradient.addColorStop(0, '#fff9e9')
    gradient.addColorStop(0.48, '#fff3d6')
    gradient.addColorStop(1, '#ead9bc')
    context.fillStyle = gradient
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function createLabel(label: string): { mesh: Mesh<PlaneGeometry, MeshBasicMaterial>; texture: CanvasTexture } {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 260
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.font = '600 86px Inter, Pretendard, "Noto Sans KR", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#47473f'
    context.fillText(label, canvas.width / 2, canvas.height / 2)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const width = Math.max(1.65, Math.min(3.5, label.length * 0.34 + 0.55))
  const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  return { mesh: new Mesh(new PlaneGeometry(width, width * (canvas.height / canvas.width)), material), texture }
}
