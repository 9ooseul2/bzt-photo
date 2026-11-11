import {
  AmbientLight,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { createFrogVisitorModel, FROG_PREVIEW_SCALE, type FrogVisitorVisual } from '../characters/models/FrogVisitorModel.ts'
import type { FrogCustomization } from '../characters/customization/types.ts'

/**
 * 미리보기 설정. 숫자만 바꿔서 느낌을 조절할 수 있다.
 * - 둥둥: lift = 떠 있는 높이, bob = 위아래로 흔들리는 폭, speed = 흔들림 속도, sway = 좌우 기울어짐(라디안)
 * - 시점: pitchMin/pitchMax = 아래에서/위에서 볼 수 있는 최대 각도(도), dragSpeed = 드래그 감도
 */
const FLOAT = { lift: 0.22, bob: 0.07, speed: 1.6, sway: 0.035 }
const ORBIT = { distance: 5.15, targetY: 1.0, pitchMin: -50, pitchMax: 70, dragSpeed: 0.012 }

/** 바닥 없이 떠 있는 캐릭터 아래에 보이는 흐릿한 그림자 */
function createSoftShadow(): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(80, 70, 55, 0.35)')
  gradient.addColorStop(1, 'rgba(80, 70, 55, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const material = new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false })
  const shadow = new Mesh(new PlaneGeometry(1.5, 1.5), material)
  shadow.rotation.x = -Math.PI / 2
  return shadow
}

/** Isolated renderer for the dressing screen. It never registers exhibition controls. */
export class FrogPreview {
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 20)
  private readonly clock = new Clock()
  private readonly frog: FrogVisitorVisual
  private isDragging = false
  private lastPointerX = 0
  private lastPointerY = 0
  /** 위아래 시점 각도 (라디안). 0 = 정면, + = 위에서 내려다봄 */
  private pitch = Math.atan2(0.05, ORBIT.distance)
  private elapsed = 0
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  /** 좌우 드래그로 도는 받침 (조명은 그대로라 캐릭터 앞뒤가 고르게 밝음) */
  private readonly turntable = new Group()
  /** 둥둥 떠 있는 움직임 */
  private readonly floater = new Group()
  private readonly shadow = createSoftShadow()
  private readonly host: HTMLElement
  private animationFrameId: number | undefined

  constructor(host: HTMLElement, customization: FrogCustomization) {
    this.host = host
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    host.append(this.renderer.domElement)
    this.frog = createFrogVisitorModel(customization)
    this.floater.add(this.frog.root)
    this.turntable.add(this.floater)
    this.turntable.scale.setScalar(FROG_PREVIEW_SCALE)
    this.scene.background = new Color('#f4efe4')
    this.scene.add(this.turntable, this.shadow, new AmbientLight('#fff8e9', 2.2))
    const key = new DirectionalLight('#fff1d4', 2.5)
    key.position.set(3, 5, 4)
    this.scene.add(key)
    this.updateCamera()
    this.resize()
    this.host.addEventListener('pointerdown', this.onPointerDown)
    this.host.addEventListener('pointermove', this.onPointerMove)
    this.host.addEventListener('pointerup', this.onPointerUp)
    this.host.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('resize', this.resize)
    this.clock.start()
    this.render()
  }

  setCustomization(customization: FrogCustomization): void { this.frog.applyCustomization(customization) }

  dispose(): void {
    if (this.animationFrameId !== undefined) window.cancelAnimationFrame(this.animationFrameId)
    window.removeEventListener('resize', this.resize)
    this.host.removeEventListener('pointerdown', this.onPointerDown)
    this.host.removeEventListener('pointermove', this.onPointerMove)
    this.host.removeEventListener('pointerup', this.onPointerUp)
    this.host.removeEventListener('pointercancel', this.onPointerUp)
    this.frog.dispose()
    this.shadow.geometry.dispose()
    this.shadow.material.map?.dispose()
    this.shadow.material.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /** 카메라를 캐릭터 둘레의 구 위에 놓는다 (위아래 각도만, 좌우는 받침이 돈다) */
  private updateCamera(): void {
    const target = new Vector3(0, ORBIT.targetY, 0)
    this.camera.position.set(0, target.y + Math.sin(this.pitch) * ORBIT.distance, Math.cos(this.pitch) * ORBIT.distance)
    this.camera.lookAt(target)
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.host.setPointerCapture(event.pointerId)
  }
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) return
    this.turntable.rotation.y += (event.clientX - this.lastPointerX) * ORBIT.dragSpeed
    const toRad = Math.PI / 180
    this.pitch = Math.min(ORBIT.pitchMax * toRad, Math.max(ORBIT.pitchMin * toRad,
      this.pitch + (event.clientY - this.lastPointerY) * ORBIT.dragSpeed))
    this.updateCamera()
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
  }
  private readonly onPointerUp = (event: PointerEvent): void => {
    this.isDragging = false
    if (this.host.hasPointerCapture(event.pointerId)) this.host.releasePointerCapture(event.pointerId)
  }
  private readonly resize = (): void => {
    const width = Math.max(this.host.clientWidth, 1)
    const height = Math.max(this.host.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }
  private readonly render = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.05)
    this.elapsed += delta
    // 둥둥: 위아래로 천천히 오르내리며 살짝 좌우로 기울어짐
    const wave = Math.sin(this.elapsed * FLOAT.speed)
    this.floater.position.y = FLOAT.lift + wave * FLOAT.bob
    this.floater.rotation.z = Math.sin(this.elapsed * FLOAT.speed * 0.5) * FLOAT.sway
    // 그림자: 높이 올라갈수록 작고 옅게
    const height = (this.floater.position.y / (FLOAT.lift + FLOAT.bob))
    this.shadow.scale.setScalar(1.05 - 0.2 * height)
    this.shadow.material.opacity = 1.1 - 0.5 * height
    this.frog.updateAnimation(delta, { isWalking: false, movementSpeed: 0 })
    this.renderer.render(this.scene, this.camera)
    this.animationFrameId = window.requestAnimationFrame(this.render)
  }
}
