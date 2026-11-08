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
  Vector3,
  WebGLRenderer,
} from 'three'
import { VisitorCharacter } from '../characters/VisitorCharacter.ts'
import { createFrogVisitorModel, FROG_VISITOR_CONFIG, type FrogVisitorVisual } from '../characters/models/FrogVisitorModel.ts'
import { DestinationMarker } from '../characters/DestinationMarker.ts'
import { GridPathfinder } from '../characters/pathfinding/GridPathfinder.ts'
import { VisitorOverheadDisplay } from '../characters/VisitorOverheadDisplay.ts'
import { EmotionStateStore } from '../user/EmotionState.ts'
import { ThirdPersonCamera } from './cameras/ThirdPersonCamera.ts'
import { CAMERA_INTERACTION_CONFIG, VISITOR_CAMERA_CONFIG } from './cameras/visitorCameraConfig.ts'
import { ExhibitionRoom } from './exhibition/ExhibitionRoom.ts'
import type { FrogCustomization } from '../characters/customization/types.ts'
import { ArtworkGallery, type ArtworkInstance } from './exhibition/artworks/ArtworkGallery.ts'
import { ALREADY_NEAR_DISTANCE, POPUP_DELAY_AFTER_ARRIVAL } from './exhibition/artworks/artworkConfig.ts'
import type { ViewingSpot } from './exhibition/artworks/types.ts'
import { chooseViewingSpot } from './exhibition/artworks/viewingSpots.ts'
import { PortalApproach } from './portals/PortalApproach.ts'
import { PortalSet, type PortalInstance } from './portals/PortalSet.ts'
import type { PortalConfig } from './portals/types.ts'
import { Minimap } from '../ui/Minimap.ts'
import { RoomIntroGallery, type RoomIntroInstance } from './exhibition/roomIntro/RoomIntroGallery.ts'
import type { RoomIntroConfig } from './exhibition/roomIntro/types.ts'
import { getRoomPropNavigationObstacles, RoomProps } from './exhibition/props/RoomProps.ts'
import { TrackLighting } from './exhibition/lighting/TrackLighting.ts'
import type { ExhibitionRoomDefinition, RoomLightingConfig } from '../rooms/types.ts'
import type { OccupancyProvider } from '../services/occupancy.ts'

interface PointerInteraction {
  button: number
  hasDragged: boolean
  lastX: number
  lastY: number
  pointerId: number
  startX: number
  startY: number
}

interface PendingViewing {
  artwork: ArtworkInstance
  spot: ViewingSpot | undefined
  phase: 'walking' | 'turning' | 'waiting'
  elapsed: number
  hasStartedTurning: boolean
}

interface PendingRoomIntro {
  elapsed: number
  hasStartedTurning: boolean
  intro: RoomIntroInstance
  phase: 'walking' | 'turning' | 'waiting'
}

export interface ExhibitionSceneOptions {
  /** Spawn normally, or start just inside a named portal while facing into the room. */
  startAt?: 'spawn' | { portalId: string }
}

/**
 * Owns the gallery, visitor input, and the third-person visitor camera.
 */
export class ExhibitionScene {
  private readonly artworkGallery: ArtworkGallery
  private readonly canvas: HTMLCanvasElement
  private readonly character: VisitorCharacter
  private readonly clock = new Clock()
  private readonly container: HTMLElement
  private readonly destinationMarker: DestinationMarker
  private readonly frogVisual: FrogVisitorVisual
  private readonly emotionState: EmotionStateStore
  private interactionEnabled = true
  private readonly overheadDisplay: VisitorOverheadDisplay
  private hoverAnimationFrameId: number | undefined
  private latestHoverEvent: PointerEvent | undefined
  private readonly minimap: Minimap
  private readonly minimapCameraDirection = new Vector3()
  private readonly onArtworkSelect: (artwork: ArtworkInstance['config']) => void
  private readonly onRoomIntroSelect: (intro: RoomIntroConfig) => void
  private readonly onPortalEnter: (portal: PortalConfig) => void
  private readonly pathfinder: GridPathfinder
  private readonly portalApproach: PortalApproach
  private readonly portals: PortalSet
  private readonly pointer = new Vector2()
  private readonly raycaster = new Raycaster()
  private readonly renderer: WebGLRenderer
  private readonly room: ExhibitionRoom
  private readonly roomIntroGallery: RoomIntroGallery
  private readonly roomProps: RoomProps
  private readonly scene = new Scene()
  private readonly thirdPersonCamera: ThirdPersonCamera
  private readonly trackLighting: TrackLighting | undefined
  private animationFrameId: number | undefined
  private pendingViewing: PendingViewing | undefined
  private pendingRoomIntro: PendingRoomIntro | undefined
  private pointerInteraction: PointerInteraction | undefined

  constructor(
    container: HTMLElement,
    nickname: string,
    emotionState: EmotionStateStore,
    customization: FrogCustomization,
    roomDefinition: ExhibitionRoomDefinition,
    onArtworkSelect: (artwork: ArtworkInstance['config']) => void,
    onRoomIntroSelect: (intro: RoomIntroConfig) => void,
    onPortalEnter: (portal: PortalConfig) => void,
    minimapHost: HTMLElement,
    occupancyProvider: OccupancyProvider,
    options: ExhibitionSceneOptions = {},
  ) {
    this.container = container
    this.emotionState = emotionState
    this.onArtworkSelect = onArtworkSelect
    this.onRoomIntroSelect = onRoomIntroSelect
    this.onPortalEnter = onPortalEnter

    this.renderer = new WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.container.append(this.renderer.domElement)
    this.canvas = this.renderer.domElement

    const roomProps = roomDefinition.props ?? []
    this.room = new ExhibitionRoom(
      roomDefinition.config,
      roomDefinition.appearance,
      getRoomPropNavigationObstacles(roomProps),
    )
    this.frogVisual = createFrogVisitorModel(customization)
    this.character = new VisitorCharacter(
      this.frogVisual,
      this.room.navigation.spawnPoint,
      FROG_VISITOR_CONFIG,
    )
    this.overheadDisplay = new VisitorOverheadDisplay(nickname, {
      nicknameHeight: FROG_VISITOR_CONFIG.nicknameHeight,
      emoteHeight: FROG_VISITOR_CONFIG.emoteHeight,
    })
    this.character.root.add(this.overheadDisplay.group)
    this.pathfinder = new GridPathfinder(this.room.navigation, this.character.collisionRadius)
    this.destinationMarker = new DestinationMarker()
    this.portals = new PortalSet(
      roomDefinition.portals,
      [...this.room.exteriorWalls, ...this.room.partitionWalls],
      this.pathfinder,
    )
    this.minimap = new Minimap(minimapHost, this.room.config, roomDefinition.id, roomDefinition.displayName, [
      {
        id: this.room.config.entrance.id,
        kind: 'entrance',
        rotationY: this.room.config.entrance.rotationY,
        width: this.room.config.entrance.width,
        x: this.room.config.entrance.position.x,
        z: this.room.config.entrance.position.z,
      },
      ...this.portals.getMapPositions().map((portal) => ({ ...portal, kind: 'portal' as const })),
    ], occupancyProvider)
    const initialAzimuth = typeof options.startAt === 'object' ? this.startAtPortal(options.startAt.portalId) : undefined
    this.thirdPersonCamera = new ThirdPersonCamera(
      initialAzimuth === undefined ? VISITOR_CAMERA_CONFIG : { ...VISITOR_CAMERA_CONFIG, initialAzimuth },
    )
    this.portalApproach = new PortalApproach(
      this.character,
      this.destinationMarker,
      this.pathfinder,
      (portal) => this.onPortalEnter(portal.config),
    )
    this.artworkGallery = new ArtworkGallery(roomDefinition.artworks, this.room.partitionWalls, this.pathfinder)
    this.roomIntroGallery = new RoomIntroGallery(
      roomDefinition.intros,
      [...this.room.exteriorWalls, ...this.room.partitionWalls],
      this.room.partitionWalls,
      this.pathfinder,
      roomDefinition.artworks,
      roomDefinition.portals,
      this.renderer.capabilities.getMaxAnisotropy(),
    )
    this.roomProps = new RoomProps(roomProps, [...this.room.exteriorWalls, ...this.room.partitionWalls])
    this.trackLighting = roomDefinition.lighting?.trackLighting
      ? new TrackLighting(this.room.config, this.artworkGallery, this.roomIntroGallery)
      : undefined
    this.scene.add(this.room.group)
    this.scene.add(this.artworkGallery.group)
    this.scene.add(this.roomIntroGallery.group)
    this.scene.add(this.portals.group)
    this.scene.add(this.roomProps.group)
    if (this.trackLighting) this.scene.add(this.trackLighting.group)
    this.scene.add(this.character.root)
    this.scene.add(this.destinationMarker.mesh)
    this.createLighting(roomDefinition.lighting)
    this.thirdPersonCamera.update(
      this.character.getCameraTarget(),
      this.room.getCameraOccluders(),
      this.room.getCameraBounds(),
    )
    this.registerPointerControls()
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  start(): void {
    this.clock.start()
    this.render()
  }

  dispose(): void {
    if (this.animationFrameId !== undefined) {
      window.cancelAnimationFrame(this.animationFrameId)
    }
    if (this.hoverAnimationFrameId !== undefined) {
      window.cancelAnimationFrame(this.hoverAnimationFrameId)
    }

    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    this.canvas.removeEventListener('pointermove', this.onArtworkHover)
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.character.root.remove(this.overheadDisplay.group)
    this.overheadDisplay.dispose()
    this.frogVisual.dispose()
    this.destinationMarker.dispose()
    this.artworkGallery.dispose()
    this.roomIntroGallery.dispose()
    this.roomProps.dispose()
    this.trackLighting?.dispose()
    this.portals.dispose()
    this.minimap.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  /** Pauses only visitor input; the scene keeps rendering beneath modal UI. */
  setInteractionEnabled(enabled: boolean): void {
    if (this.interactionEnabled === enabled) {
      return
    }

    this.interactionEnabled = enabled
    this.character.setMovementEnabled(enabled)

    if (!enabled) {
      this.cancelPendingViewing()
      this.cancelPendingRoomIntro()
      this.portalApproach.cancel()
      this.canvas.style.cursor = 'default'
    }

    if (!enabled && this.pointerInteraction) {
      const { pointerId } = this.pointerInteraction
      if (this.canvas.hasPointerCapture(pointerId)) {
        this.canvas.releasePointerCapture(pointerId)
      }
      this.pointerInteraction = undefined
    }
  }

  /** Stops any in-progress click-to-move choreography before a direct room switch. */
  cancelInteractions(): void {
    this.cancelPendingViewing()
    this.cancelPendingRoomIntro()
    this.portalApproach.cancel()
  }

  /** Allows a future distance-culling system to hide both overhead labels together. */
  setOverheadDisplayVisible(isVisible: boolean): void {
    this.overheadDisplay.setVisible(isVisible)
  }

  /** Gallery UI controls the minimap separately from the canvas interaction state. */
  setMinimapVisible(isVisible: boolean): void {
    this.minimap.setVisible(isVisible)
  }

  applyCustomization(customization: FrogCustomization): void {
    this.frogVisual.applyCustomization(customization)
  }

  /** Returns the camera azimuth after placing the visitor just inside a returning portal. */
  private startAtPortal(portalId: string): number | undefined {
    const approachPoint = this.portals.getApproachPoint(portalId)
    const facingPoint = this.portals.getFacingPoint(portalId)
    if (!approachPoint || !facingPoint) return undefined

    const directionX = approachPoint.x - facingPoint.x
    const directionZ = approachPoint.z - facingPoint.z
    if (Math.hypot(directionX, directionZ) < Number.EPSILON) return undefined
    this.character.root.position.set(approachPoint.x, 0, approachPoint.z)
    this.character.root.rotation.y = Math.atan2(directionX, directionZ)
    // Matches guideToward: camera remains opposite the direction the visitor faces into the room.
    return Math.atan2(-directionX, -directionZ)
  }

  private createLighting(lighting?: RoomLightingConfig): void {
    this.scene.background = new Color(lighting?.background ?? '#b9c1c5')

    const hemisphere = lighting?.hemisphere ?? { sky: '#fffaf0', ground: '#72716c', intensity: 1.85 }
    const ambientLight = new HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity)
    this.scene.add(ambientLight)

    const keyLightConfig = lighting === undefined
      ? { color: '#fff4dc', intensity: 3.1, castShadow: true }
      : lighting.keyLight
    if (keyLightConfig) {
      const keyLight = new DirectionalLight(keyLightConfig.color, keyLightConfig.intensity)
      keyLight.position.set(7, 15, 9)
      keyLight.castShadow = keyLightConfig.castShadow
      if (keyLight.castShadow) {
        keyLight.shadow.mapSize.set(2048, 2048)
        // 매끈한 곡면(캐릭터)에 생기는 물결 무늬 그림자를 막는 보정값
        keyLight.shadow.normalBias = 0.04
        keyLight.shadow.camera.left = -22
        keyLight.shadow.camera.right = 22
        keyLight.shadow.camera.top = 18
        keyLight.shadow.camera.bottom = -18
      }
      this.scene.add(keyLight)
    }
  }

  private registerPointerControls(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerCancel)
    this.canvas.addEventListener('pointermove', this.onArtworkHover)
    this.canvas.addEventListener('contextmenu', this.preventContextMenu)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.interactionEnabled) {
      return
    }

    if (event.button !== 0 && event.button !== 2) {
      return
    }

    if (event.button === 2) {
      event.preventDefault()
    }

    this.pointerInteraction = {
      button: event.button,
      hasDragged: false,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.interactionEnabled) {
      return
    }

    const interaction = this.pointerInteraction

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }

    const travelledDistance = Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY)

    if (!interaction.hasDragged && travelledDistance < CAMERA_INTERACTION_CONFIG.dragThreshold) {
      return
    }

    interaction.hasDragged = true
    this.thirdPersonCamera.rotate(event.clientX - interaction.lastX, event.clientY - interaction.lastY)
    interaction.lastX = event.clientX
    interaction.lastY = event.clientY
  }

  /** Artwork and portal hover run independently because camera dragging deliberately returns early above. */
  private readonly onArtworkHover = (event: PointerEvent): void => {
    if (!this.interactionEnabled || this.pointerInteraction?.hasDragged) {
      this.canvas.style.cursor = 'default'
      return
    }

    this.latestHoverEvent = event
    if (this.hoverAnimationFrameId !== undefined) return
    this.hoverAnimationFrameId = window.requestAnimationFrame(() => {
      this.hoverAnimationFrameId = undefined
      const latestEvent = this.latestHoverEvent
      if (!latestEvent || !this.interactionEnabled || this.pointerInteraction?.hasDragged) {
        this.canvas.style.cursor = 'default'
        return
      }
      this.setRayFromEvent(latestEvent)
      this.canvas.style.cursor = this.getInteractiveTargetAtRay() ? 'pointer' : 'default'
    })
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.finishPointerInteraction(event, true)
  }

  private readonly onPointerCancel = (event: PointerEvent): void => {
    this.finishPointerInteraction(event, false)
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()

    if (!this.interactionEnabled) {
      return
    }

    const wheelDelta =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? event.deltaY * CAMERA_INTERACTION_CONFIG.wheelLineSize
        : event.deltaY

    this.thirdPersonCamera.zoom(wheelDelta)
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  private finishPointerInteraction(event: PointerEvent, acceptClick: boolean): void {
    if (!this.interactionEnabled) {
      return
    }

    const interaction = this.pointerInteraction

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return
    }

    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId)
    }

    this.pointerInteraction = undefined

    if (acceptClick && interaction.button === 0 && !interaction.hasDragged) {
      this.handleSceneClick(event)
    }
  }

  private handleSceneClick(event: PointerEvent): void {
    this.setRayFromEvent(event)
    const target = this.getInteractiveTargetAtRay()
    if (target?.artwork) {
      if (this.pendingViewing?.artwork.config.id !== target.artwork.config.id) {
        this.startArtworkViewing(target.artwork)
      }
      return
    }
    if (target?.portal) {
      if (this.portalApproach.activePortalId !== target.portal.config.id) {
        this.cancelPendingViewing()
        this.cancelPendingRoomIntro()
        this.portalApproach.start(target.portal)
      }
      return
    }
    if (target?.roomIntro) {
      if (this.pendingRoomIntro?.intro.config.id !== target.roomIntro.config.id) {
        this.startRoomIntro(target.roomIntro)
      }
      return
    }

    this.cancelPendingViewing()
    this.cancelPendingRoomIntro()
    this.portalApproach.cancel()
    this.setMovementDestination()
  }

  private setMovementDestination(): void {
    const closestHit = this.raycaster.intersectObject(this.room.group, true)[0]

    // A wall in front of the floor blocks the click target, as it does visually.
    if (!closestHit || closestHit.object !== this.room.floor.mesh) {
      return
    }

    const destination = {
      x: closestHit.point.x,
      z: closestHit.point.z,
    }

    if (!this.pathfinder.isWalkableDestination(destination)) {
      return
    }

    const path = this.pathfinder.findPath(this.character.root.position, destination)

    if (!this.character.setPath(path)) {
      return
    }

    const finalDestination = path.at(-1)

    if (finalDestination) {
      this.destinationMarker.show(finalDestination)
    }
  }

  private startArtworkViewing(artwork: ArtworkInstance): void {
    this.portalApproach.cancel()
    this.cancelPendingRoomIntro()
    this.cancelPendingViewing()
    const spot = chooseViewingSpot(artwork.viewingSpots, this.character.root.position)
    this.pendingViewing = { artwork, spot, phase: 'turning', elapsed: 0, hasStartedTurning: false }

    if (!spot) {
      this.character.clearPath()
      this.destinationMarker.hide()
      return
    }

    const isAlreadyNear = Math.hypot(
      this.character.root.position.x - spot.position.x,
      this.character.root.position.z - spot.position.z,
    ) <= ALREADY_NEAR_DISTANCE
    const path = isAlreadyNear ? [] : this.pathfinder.findPath(this.character.root.position, spot.position)

    if (isAlreadyNear || !this.character.setPath(path)) {
      this.character.clearPath()
      this.destinationMarker.hide()
      return
    }

    this.pendingViewing.phase = 'walking'
    this.destinationMarker.show(spot.position)
  }

  private cancelPendingViewing(): void {
    if (!this.pendingViewing) return
    this.pendingViewing = undefined
    this.character.clearPath()
    this.destinationMarker.hide()
  }

  private startRoomIntro(intro: RoomIntroInstance): void {
    this.portalApproach.cancel()
    this.cancelPendingViewing()
    this.cancelPendingRoomIntro()
    this.pendingRoomIntro = { intro, phase: 'turning', elapsed: 0, hasStartedTurning: false }
    const approachPoint = intro.approachPoint
    if (!approachPoint) {
      this.character.clearPath()
      this.destinationMarker.hide()
      return
    }

    const isAlreadyNear = Math.hypot(
      this.character.root.position.x - approachPoint.x,
      this.character.root.position.z - approachPoint.z,
    ) <= ALREADY_NEAR_DISTANCE
    const path = isAlreadyNear ? [] : this.pathfinder.findPath(this.character.root.position, approachPoint)
    if (isAlreadyNear || !this.character.setPath(path)) {
      this.character.clearPath()
      this.destinationMarker.hide()
      return
    }

    this.pendingRoomIntro.phase = 'walking'
    this.destinationMarker.show(approachPoint)
  }

  private cancelPendingRoomIntro(): void {
    if (!this.pendingRoomIntro) return
    this.pendingRoomIntro = undefined
    this.character.clearPath()
    this.destinationMarker.hide()
  }

  private setRayFromEvent(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.thirdPersonCamera.camera)
  }

  /** Interactive foreground content is valid only when rendered in front of structural room geometry. */
  private getInteractiveTargetAtRay(): { artwork?: ArtworkInstance; portal?: PortalInstance; roomIntro?: RoomIntroInstance } | undefined {
    const artworkHit = this.raycaster.intersectObject(this.artworkGallery.group, true)[0]
    const portalHit = this.raycaster.intersectObject(this.portals.group, true)[0]
    const roomIntroHit = this.raycaster.intersectObject(this.roomIntroGallery.group, true)[0]
    const roomHit = this.raycaster.intersectObject(this.room.group, true)[0]
    const isInFrontOfRoom = (distance: number): boolean => !roomHit || distance < roomHit.distance
    const targets: Array<{ distance: number; target: { artwork?: ArtworkInstance; portal?: PortalInstance; roomIntro?: RoomIntroInstance } }> = []
    const artwork = artworkHit && isInFrontOfRoom(artworkHit.distance) ? this.artworkGallery.getArtworkFromObject(artworkHit.object) : undefined
    const portal = portalHit && isInFrontOfRoom(portalHit.distance) ? this.portals.getPortalFromObject(portalHit.object) : undefined
    const roomIntro = roomIntroHit && isInFrontOfRoom(roomIntroHit.distance) ? this.roomIntroGallery.getIntroFromObject(roomIntroHit.object) : undefined
    if (artwork && artworkHit) targets.push({ distance: artworkHit.distance, target: { artwork } })
    if (portal && portalHit) targets.push({ distance: portalHit.distance, target: { portal } })
    if (roomIntro && roomIntroHit) targets.push({ distance: roomIntroHit.distance, target: { roomIntro } })
    targets.sort((left, right) => left.distance - right.distance)
    return targets[0]?.target
  }

  private readonly resize = (): void => {
    const { clientHeight, clientWidth } = this.container
    const width = Math.max(clientWidth, 1)
    const height = Math.max(clientHeight, 1)

    this.thirdPersonCamera.camera.aspect = width / height
    this.thirdPersonCamera.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private readonly render = (): void => {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05)
    const now = Date.now()
    const wasMoving = this.character.isMoving
    this.character.update(deltaSeconds)
    if (wasMoving && !this.character.isMoving) {
      this.destinationMarker.hide()
    }
    this.destinationMarker.update(deltaSeconds)
    this.updatePendingViewing(deltaSeconds)
    this.updatePendingRoomIntro(deltaSeconds)
    this.portalApproach.update(deltaSeconds)
    this.portals.update(now / 1_000)
    this.overheadDisplay.updateEmotion(this.emotionState.state, now)
    this.emotionState.clearExpired(now)
    this.thirdPersonCamera.update(
      this.character.getCameraTarget(),
      this.room.getCameraOccluders(),
      this.room.getCameraBounds(),
      deltaSeconds,
    )
    this.thirdPersonCamera.camera.getWorldDirection(this.minimapCameraDirection)
    this.minimap.update({
      cameraDirection: this.minimapCameraDirection,
      characterHeading: this.character.root.rotation.y,
      characterPosition: this.character.root.position,
    })
    this.renderer.render(this.scene, this.thirdPersonCamera.camera)
    this.animationFrameId = window.requestAnimationFrame(this.render)
  }

  private updatePendingViewing(deltaSeconds: number): void {
    const pending = this.pendingViewing
    if (!pending) return

    if (pending.phase === 'walking') {
      if (!this.character.isMoving) {
        pending.phase = 'turning'
        pending.elapsed = 0
        pending.hasStartedTurning = false
      }
      return
    }

    if (pending.phase === 'turning') {
      if (!pending.hasStartedTurning) {
        this.character.faceToward(pending.artwork.center)
        this.thirdPersonCamera.guideToward(this.character.getCameraTarget(), pending.artwork.center)
        pending.hasStartedTurning = true
      }
      pending.elapsed += deltaSeconds
      if (this.character.isFacingTarget || pending.elapsed >= 0.8) {
        pending.phase = 'waiting'
        pending.elapsed = 0
      }
      return
    }

    pending.elapsed += deltaSeconds
    if (pending.elapsed >= POPUP_DELAY_AFTER_ARRIVAL) {
      const artwork = pending.artwork.config
      this.pendingViewing = undefined
      this.onArtworkSelect(artwork)
    }
  }

  private updatePendingRoomIntro(deltaSeconds: number): void {
    const pending = this.pendingRoomIntro
    if (!pending) return
    if (pending.phase === 'walking') {
      if (!this.character.isMoving) {
        pending.phase = 'turning'
        pending.elapsed = 0
        pending.hasStartedTurning = false
      }
      return
    }
    if (pending.phase === 'turning') {
      if (!pending.hasStartedTurning) {
        this.character.faceToward(pending.intro.center)
        this.thirdPersonCamera.guideToward(this.character.getCameraTarget(), pending.intro.center)
        pending.hasStartedTurning = true
      }
      pending.elapsed += deltaSeconds
      if (this.character.isFacingTarget || pending.elapsed >= 0.8) {
        pending.phase = 'waiting'
        pending.elapsed = 0
      }
      return
    }
    pending.elapsed += deltaSeconds
    if (pending.elapsed >= 0.35) {
      const intro = pending.intro.config
      this.pendingRoomIntro = undefined
      this.onRoomIntroSelect(intro)
    }
  }
}
