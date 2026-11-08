import { AmbientLight, Clock, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { createFrogVisitorModel, type FrogVisitorVisual } from '../characters/models/FrogVisitorModel.ts'
import type { FrogCustomization } from '../characters/customization/types.ts'

/** Isolated renderer for the dressing screen. It never registers exhibition controls. */
export class FrogPreview {
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 20)
  private readonly clock = new Clock()
  private readonly frog: FrogVisitorVisual
  private isDragging = false
  private lastPointerX = 0
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly turntable = new Group()
  private readonly host: HTMLElement
  private animationFrameId: number | undefined

  constructor(host: HTMLElement, customization: FrogCustomization) {
    this.host = host
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    host.append(this.renderer.domElement)
    this.frog = createFrogVisitorModel(customization)
    this.turntable.add(this.frog.root)
    this.scene.background = new Color('#f4efe4')
    this.scene.add(this.turntable, new AmbientLight('#fff8e9', 2.2))
    const key = new DirectionalLight('#fff1d4', 2.5)
    key.position.set(3, 5, 4)
    this.scene.add(key)
    const floor = new Mesh(new PlaneGeometry(6, 6), new MeshStandardMaterial({ color: '#e5ddcf', roughness: 0.92 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.002
    this.scene.add(floor)
    this.camera.position.set(0, 1.05, 5.15)
    this.camera.lookAt(0, 0.94, 0)
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
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.isDragging = true
    this.lastPointerX = event.clientX
    this.host.setPointerCapture(event.pointerId)
  }
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isDragging) return
    this.turntable.rotation.y += (event.clientX - this.lastPointerX) * 0.012
    this.lastPointerX = event.clientX
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
    this.frog.updateAnimation(delta, { isWalking: false, movementSpeed: 0 })
    this.renderer.render(this.scene, this.camera)
    this.animationFrameId = window.requestAnimationFrame(this.render)
  }
}
