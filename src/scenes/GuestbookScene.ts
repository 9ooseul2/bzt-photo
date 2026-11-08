import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from 'three'
import { DestinationMarker } from '../characters/DestinationMarker.ts'
import { VisitorCharacter } from '../characters/VisitorCharacter.ts'
import { createFrogVisitorModel, FROG_VISITOR_CONFIG, type FrogVisitorVisual } from '../characters/models/FrogVisitorModel.ts'
import { GridPathfinder } from '../characters/pathfinding/GridPathfinder.ts'
import { VisitorOverheadDisplay } from '../characters/VisitorOverheadDisplay.ts'
import { GuestbookPostits } from '../guestbook/GuestbookPostits.ts'
import { GUESTBOOK_ROOM_CONFIG } from '../guestbook/guestbookRoomConfig.ts'
import type { GuestbookEntry } from '../guestbook/types.ts'
import { EmotionStateStore } from '../user/EmotionState.ts'
import { ThirdPersonCamera } from './cameras/ThirdPersonCamera.ts'
import { CAMERA_INTERACTION_CONFIG } from './cameras/visitorCameraConfig.ts'
import { ExhibitionRoom } from './exhibition/ExhibitionRoom.ts'
import type { FrogCustomization } from '../characters/customization/types.ts'
import { PortalApproach } from './portals/PortalApproach.ts'
import { GUESTBOOK_PORTALS } from './portals/portalConfig.ts'
import { PortalSet, type PortalInstance } from './portals/PortalSet.ts'
import type { PortalAction } from './portals/types.ts'

interface PointerInteraction {
  button: number
  hasDragged: boolean
  lastX: number
  lastY: number
  pointerId: number
  startX: number
  startY: number
}

/** Personal-only guestbook room. It renders common note data, never remote visitor avatars. */
export class GuestbookScene {
  private readonly canvas: HTMLCanvasElement
  private readonly character: VisitorCharacter
  private readonly clock = new Clock()
  private readonly container: HTMLElement
  private readonly destinationMarker = new DestinationMarker()
  private readonly emotionState: EmotionStateStore
  private readonly frogVisual: FrogVisitorVisual
  private interactionEnabled = true
  private readonly overheadDisplay: VisitorOverheadDisplay
  private readonly onEntrySelected: (entry: GuestbookEntry) => void
  private readonly onPortalEnter: (action: PortalAction) => void
  private readonly pathfinder: GridPathfinder
  private readonly pointer = new Vector2()
  private pointerInteraction: PointerInteraction | undefined
  private readonly postits: GuestbookPostits
  private readonly portalApproach: PortalApproach
  private readonly portals: PortalSet
  private readonly raycaster = new Raycaster()
  private readonly renderer: WebGLRenderer
  private readonly room: ExhibitionRoom
  private readonly scene = new Scene()
  private readonly thirdPersonCamera = new ThirdPersonCamera()
  private animationFrameId: number | undefined

  constructor(
    container: HTMLElement,
    nickname: string,
    emotionState: EmotionStateStore,
    customization: FrogCustomization,
    entries: readonly GuestbookEntry[],
    onEntrySelected: (entry: GuestbookEntry) => void,
    onPortalEnter: (action: PortalAction) => void,
  ) {
    this.container = container
    this.emotionState = emotionState
    this.onEntrySelected = onEntrySelected
    this.onPortalEnter = onPortalEnter
    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    container.append(this.renderer.domElement)
    this.canvas = this.renderer.domElement

    this.room = new ExhibitionRoom(GUESTBOOK_ROOM_CONFIG)
    this.frogVisual = createFrogVisitorModel(customization)
    this.character = new VisitorCharacter(this.frogVisual, this.room.navigation.spawnPoint, FROG_VISITOR_CONFIG)
    this.overheadDisplay = new VisitorOverheadDisplay(nickname, {
      nicknameHeight: FROG_VISITOR_CONFIG.nicknameHeight,
      emoteHeight: FROG_VISITOR_CONFIG.emoteHeight,
    })
    this.character.root.add(this.overheadDisplay.group)
    this.pathfinder = new GridPathfinder(this.room.navigation, this.character.collisionRadius)
    this.postits = new GuestbookPostits(entries)
    this.portals = new PortalSet(GUESTBOOK_PORTALS, this.room.exteriorWalls, this.pathfinder)
    this.portalApproach = new PortalApproach(
      this.character,
      this.destinationMarker,
      this.pathfinder,
      (portal) => this.onPortalEnter(portal.config.action),
    )
    this.scene.add(this.room.group, this.character.root, this.destinationMarker.mesh, this.postits.group, this.portals.group)
    this.createLighting()
    this.thirdPersonCamera.update(this.character.getCameraTarget(), this.room.getCameraOccluders(), this.room.getCameraBounds())
    this.registerPointerControls()
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  start(): void {
    this.clock.start()
    this.render()
  }

  addEntry(entry: GuestbookEntry): boolean {
    return this.postits.add(entry)
  }

  /** Draws attention to a just-created note without moving the visitor or changing zoom. */
  revealEntry(entry: GuestbookEntry): void {
    const position = this.postits.getPosition(entry.id)
    if (!position) return
    this.postits.highlight(entry.id)
    this.thirdPersonCamera.guideToward(this.character.getCameraTarget(), position)
  }

  dispose(): void {
    if (this.animationFrameId !== undefined) window.cancelAnimationFrame(this.animationFrameId)
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.character.root.remove(this.overheadDisplay.group)
    this.overheadDisplay.dispose()
    this.frogVisual.dispose()
    this.destinationMarker.dispose()
    this.postits.dispose()
    this.portals.dispose()
    this.renderer.dispose()
    this.canvas.remove()
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled
    this.character.setMovementEnabled(enabled)
    this.canvas.style.cursor = enabled ? 'default' : ''
    if (!enabled) {
      this.postits.setHovered(undefined)
      this.portalApproach.cancel()
    }
  }

  applyCustomization(customization: FrogCustomization): void {
    this.frogVisual.applyCustomization(customization)
  }

  private createLighting(): void {
    this.scene.background = new Color('#b9c1c5')
    this.scene.add(new HemisphereLight('#fffaf0', '#72716c', 1.85))
    const light = new DirectionalLight('#fff4dc', 3.1)
    light.position.set(7, 15, 9)
    light.castShadow = true
    light.shadow.mapSize.set(2048, 2048)
    light.shadow.camera.left = -22
    light.shadow.camera.right = 22
    light.shadow.camera.top = 18
    light.shadow.camera.bottom = -18
    this.scene.add(light)
  }

  private registerPointerControls(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)
    this.canvas.addEventListener('contextmenu', this.preventContextMenu)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.interactionEnabled || (event.button !== 0 && event.button !== 2)) return
    if (event.button === 2) event.preventDefault()
    this.pointerInteraction = {
      button: event.button, hasDragged: false, lastX: event.clientX, lastY: event.clientY,
      pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.interactionEnabled) return
    const interaction = this.pointerInteraction
    if (!interaction || interaction.pointerId !== event.pointerId) {
      this.updatePostitHover(event)
      return
    }
    if (!interaction.hasDragged && Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY) < CAMERA_INTERACTION_CONFIG.dragThreshold) return
    interaction.hasDragged = true
    this.thirdPersonCamera.rotate(event.clientX - interaction.lastX, event.clientY - interaction.lastY)
    interaction.lastX = event.clientX
    interaction.lastY = event.clientY
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    const interaction = this.pointerInteraction
    if (!interaction || interaction.pointerId !== event.pointerId) return
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    this.pointerInteraction = undefined
    if (this.interactionEnabled && interaction.button === 0 && !interaction.hasDragged) this.handleClick(event)
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    this.pointerInteraction = undefined
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (!this.interactionEnabled) return
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * CAMERA_INTERACTION_CONFIG.wheelLineSize : event.deltaY
    this.thirdPersonCamera.zoom(delta)
  }

  private readonly preventContextMenu = (event: MouseEvent): void => event.preventDefault()

  private handleClick(event: PointerEvent): void {
    this.setRayFromEvent(event)
    const postitHit = this.raycaster.intersectObject(this.postits.group, true)[0]
    const entry = postitHit ? this.postits.getEntryFromObject(postitHit.object) : undefined
    if (entry) {
      this.portalApproach.cancel()
      this.onEntrySelected(entry)
      return
    }
    const portal = this.getPortalAtRay()
    if (portal) {
      this.portalApproach.start(portal)
      return
    }
    this.portalApproach.cancel()
    const floorHit = this.raycaster.intersectObject(this.room.floor.mesh)[0]
    if (!floorHit) return
    const destination = { x: floorHit.point.x, z: floorHit.point.z }
    if (!this.pathfinder.isWalkableDestination(destination)) return
    const path = this.pathfinder.findPath(this.character.root.position, destination)
    if (!this.character.setPath(path)) return
    const finalDestination = path.at(-1)
    if (finalDestination) this.destinationMarker.show(finalDestination)
  }

  private updatePostitHover(event: PointerEvent): void {
    this.setRayFromEvent(event)
    const hit = this.raycaster.intersectObject(this.postits.group, true)[0]
    const entry = hit ? this.postits.getEntryFromObject(hit.object) : undefined
    this.postits.setHovered(entry)
    const portal = entry ? undefined : this.getPortalAtRay()
    this.canvas.style.cursor = entry || portal ? 'pointer' : 'default'
  }

  /** A portal remains non-interactive when a room wall is physically in front of it. */
  private getPortalAtRay(): PortalInstance | undefined {
    const portalHit = this.raycaster.intersectObject(this.portals.group, true)[0]
    if (!portalHit) return undefined
    const roomHit = this.raycaster.intersectObject(this.room.group, true)[0]
    if (roomHit && roomHit.distance <= portalHit.distance) return undefined
    return this.portals.getPortalFromObject(portalHit.object)
  }

  private setRayFromEvent(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect()
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.thirdPersonCamera.camera)
  }

  private readonly resize = (): void => {
    const { clientHeight, clientWidth } = this.container
    this.thirdPersonCamera.camera.aspect = Math.max(clientWidth, 1) / Math.max(clientHeight, 1)
    this.thirdPersonCamera.camera.updateProjectionMatrix()
    this.renderer.setSize(Math.max(clientWidth, 1), Math.max(clientHeight, 1), false)
  }

  private readonly render = (): void => {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    const now = Date.now()
    const wasMoving = this.character.isMoving
    this.character.update(deltaSeconds)
    if (wasMoving && !this.character.isMoving) this.destinationMarker.hide()
    this.destinationMarker.update(deltaSeconds)
    this.postits.update(now)
    this.portalApproach.update(deltaSeconds)
    this.portals.update(now / 1_000)
    this.overheadDisplay.updateEmotion(this.emotionState.state, now)
    this.emotionState.clearExpired(now)
    this.thirdPersonCamera.update(this.character.getCameraTarget(), this.room.getCameraOccluders(), this.room.getCameraBounds(), deltaSeconds)
    this.renderer.render(this.scene, this.thirdPersonCamera.camera)
    this.animationFrameId = window.requestAnimationFrame(this.render)
  }
}
