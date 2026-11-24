import { PerspectiveCamera, Raycaster, Vector3, type Object3D } from 'three'
import type { CameraBounds } from '../exhibition/types.ts'
import { VISITOR_CAMERA_CONFIG, type ThirdPersonCameraConfig } from './visitorCameraConfig.ts'

const WORLD_UP = new Vector3(0, 1, 0)

/**
 * Orbit-style third-person camera with wall-aware placement.
 *
 * - 벽 충돌: 카메라를 가는 선 하나가 아니라 "굵은 막대"(가운데 + 상하좌우 4줄)로 검사해서,
 *   벽 모서리를 스치거나 비스듬한 벽에 붙을 때도 렌즈가 벽 안으로 들어가지 않게 한다.
 * - 자동 회전: 벽 때문에 카메라가 캐릭터에 너무 붙으면, 가장 가까운 트인 방향으로
 *   카메라가 천천히 돌아간다. 마우스로 직접 돌리면 잠시 동안은 끼어들지 않는다.
 */
export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera
  private azimuth: number
  private appliedDistance: number
  private readonly config: ThirdPersonCameraConfig
  private readonly cameraRayDirection = new Vector3()
  private readonly lookDirection = new Vector3()
  private readonly lookTarget = new Vector3()
  private pitch: number
  private readonly raycaster = new Raycaster()
  private readonly probeDirection = new Vector3()
  private readonly probeOrigin = new Vector3()
  private readonly probeRight = new Vector3()
  private readonly probeUp = new Vector3()
  private readonly target = new Vector3()
  private targetAzimuth: number
  private targetDistance: number
  private targetPitch: number
  private zoomDistance: number
  private guidedRotationRemaining = 0
  /** Seconds left before auto-swing may move the camera after a manual drag. */
  private manualRotationHold = 0
  /** Seconds until the open-direction search runs again (it is throttled). */
  private autoSwingSearchCooldown = 0
  /** Remaining angle (radians, signed) the auto-swing still wants to turn. */
  private autoSwingRemaining = 0
  private lastAutoSwingSign = 0

  constructor(config: ThirdPersonCameraConfig = VISITOR_CAMERA_CONFIG) {
    this.config = config
    this.azimuth = config.initialAzimuth
    this.pitch = config.initialPitch
    this.targetAzimuth = config.initialAzimuth
    this.targetPitch = config.initialPitch
    this.targetDistance = config.distance
    this.zoomDistance = config.distance
    this.appliedDistance = config.distance
    this.camera = new PerspectiveCamera(config.fieldOfView, 1, config.nearClip, 100)
  }

  rotate(deltaX: number, deltaY: number): void {
    this.guidedRotationRemaining = 0
    this.manualRotationHold = this.config.autoSwingDelayAfterManual
    this.autoSwingRemaining = 0
    this.targetAzimuth -= deltaX * this.config.rotationSensitivity
    this.targetPitch = Math.min(
      this.config.maximumPitch,
      Math.max(
        this.config.minimumPitch,
        this.targetPitch - deltaY * this.config.verticalRotationSensitivity,
      ),
    )
  }

  zoom(wheelDelta: number): void {
    this.targetDistance = this.clamp(
      this.targetDistance + wheelDelta * this.config.wheelZoomSensitivity,
      this.config.minimumZoomDistance,
      this.config.maximumZoomDistance,
    )
  }

  /** Briefly orients the existing orbit toward a world-space point without changing zoom. */
  guideToward(focusTarget: Vector3, worldPoint: Vector3, durationSeconds = 0.8): void {
    const directionX = worldPoint.x - focusTarget.x
    const directionZ = worldPoint.z - focusTarget.z
    if (Math.hypot(directionX, directionZ) < Number.EPSILON) return

    // Place the camera on the opposite side of the visitor, so the note is in view beyond it.
    this.targetAzimuth = Math.atan2(-directionX, -directionZ)
    this.guidedRotationRemaining = durationSeconds
    this.autoSwingRemaining = 0
  }

  update(
    focusTarget: Vector3,
    occluders: readonly Object3D[],
    cameraBounds?: CameraBounds,
    deltaSeconds = 1 / 60,
  ): void {
    const occluderList = occluders as Object3D[]

    this.target.copy(focusTarget)
    this.target.y += this.config.focusHeightOffset

    this.updateAutoSwing(occluderList, cameraBounds, deltaSeconds)

    const rotationSpeed = this.guidedRotationRemaining > 0 ? 5.8 : this.config.rotationSmoothing
    const rotationBlend = this.smoothingBlend(rotationSpeed, deltaSeconds)
    this.azimuth += this.shortestAngle(this.azimuth, this.targetAzimuth) * rotationBlend
    this.pitch += (this.targetPitch - this.pitch) * rotationBlend
    this.guidedRotationRemaining = Math.max(0, this.guidedRotationRemaining - deltaSeconds)
    this.zoomDistance +=
      (this.targetDistance - this.zoomDistance) *
      this.smoothingBlend(this.config.zoomSmoothing, deltaSeconds)

    const desiredDistance = this.zoomDistance
    this.setOrbitDirection(this.azimuth, this.cameraRayDirection)
    const permittedDistance = this.measurePermittedDistance(
      this.cameraRayDirection,
      desiredDistance,
      occluderList,
      cameraBounds,
    )
    const targetCameraDistance = Math.min(desiredDistance, permittedDistance)
    const isOccluded = permittedDistance < desiredDistance
    const collisionSmoothing =
      targetCameraDistance < this.config.minimumCollisionDistance
        ? this.config.cameraDistanceSmoothing * 2
        : this.config.cameraDistanceSmoothing
    const distanceBlend = this.smoothingBlend(collisionSmoothing, deltaSeconds)

    this.appliedDistance += (targetCameraDistance - this.appliedDistance) * distanceBlend

    // Never ease through a wall when an obstacle suddenly enters the camera ray.
    if (isOccluded && this.appliedDistance > targetCameraDistance) {
      this.appliedDistance = targetCameraDistance
    }

    this.camera.position.copy(this.target).addScaledVector(this.cameraRayDirection, this.appliedDistance)
    this.lookDirection.set(
      Math.sin(this.azimuth + Math.PI) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.azimuth + Math.PI) * Math.cos(this.pitch),
    )
    this.lookTarget.copy(this.camera.position).add(this.lookDirection)
    this.camera.lookAt(this.lookTarget)
  }

  /**
   * When walls squeeze the camera toward the visitor, turn the orbit toward the
   * closest open direction instead of making the visitor fix it with the mouse.
   */
  private updateAutoSwing(
    occluders: Object3D[],
    cameraBounds: CameraBounds | undefined,
    deltaSeconds: number,
  ): void {
    this.manualRotationHold = Math.max(0, this.manualRotationHold - deltaSeconds)
    this.autoSwingSearchCooldown = Math.max(0, this.autoSwingSearchCooldown - deltaSeconds)

    const { autoSwing } = this.config
    if (!autoSwing.enabled || this.manualRotationHold > 0 || this.guidedRotationRemaining > 0) {
      this.autoSwingRemaining = 0
      return
    }

    if (this.autoSwingSearchCooldown <= 0) {
      this.autoSwingSearchCooldown = autoSwing.searchInterval
      this.autoSwingRemaining = this.findOpenSwing(occluders, cameraBounds)
      if (this.autoSwingRemaining !== 0) this.lastAutoSwingSign = Math.sign(this.autoSwingRemaining)
    }

    if (this.autoSwingRemaining === 0) return

    // Constant, gentle angular speed so the turn reads as the camera "sliding" off the wall.
    const step = Math.sign(this.autoSwingRemaining) *
      Math.min(Math.abs(this.autoSwingRemaining), autoSwing.speed * deltaSeconds)
    this.targetAzimuth += step
    this.autoSwingRemaining -= step
    if (Math.abs(this.autoSwingRemaining) < 1e-4) this.autoSwingRemaining = 0
  }

  /** Signed angle to the nearest orbit direction with enough room; 0 when no turn is needed or helps. */
  private findOpenSwing(occluders: Object3D[], cameraBounds: CameraBounds | undefined): number {
    const { autoSwing } = this.config
    const desiredDistance = this.targetDistance
    const baseAzimuth = this.targetAzimuth

    this.setOrbitDirection(baseAzimuth, this.probeDirection)
    const currentRoom = this.measurePermittedDistance(this.probeDirection, desiredDistance, occluders, cameraBounds)
    if (currentRoom >= desiredDistance * autoSwing.triggerRatio) return 0

    const enoughRoom = desiredDistance * autoSwing.satisfiedRatio
    let bestAngle = 0
    let bestRoom = currentRoom
    const steps = Math.max(1, Math.round(autoSwing.maximumAngle / autoSwing.searchStep))

    for (let index = 1; index <= steps; index += 1) {
      const magnitude = index * autoSwing.searchStep
      // Try the side we were already turning toward first, so the camera never flip-flops.
      const preferred = this.lastAutoSwingSign || 1
      for (const sign of [preferred, -preferred]) {
        const angle = sign * magnitude
        this.setOrbitDirection(baseAzimuth + angle, this.probeDirection)
        const room = this.measurePermittedDistance(this.probeDirection, desiredDistance, occluders, cameraBounds)
        if (room >= enoughRoom) return angle
        if (room > bestRoom + autoSwing.minimumGain) {
          bestRoom = room
          bestAngle = angle
        }
      }
    }

    // In a tight corner nothing is fully open: settle for the roomiest direction found.
    return bestAngle
  }

  /** Unit vector from the focus point toward the camera for a given orbit azimuth. */
  private setOrbitDirection(azimuth: number, out: Vector3): Vector3 {
    const elevation = this.config.orbitElevation
    return out.set(
      Math.sin(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.cos(azimuth) * Math.cos(elevation),
    )
  }

  /**
   * How far the camera can travel from the focus point along `direction`.
   * Casts a bundle of parallel rays (centre + up/down/left/right) so the lens
   * keeps a margin from walls it would otherwise graze past.
   */
  private measurePermittedDistance(
    direction: Vector3,
    maximumDistance: number,
    occluders: Object3D[],
    cameraBounds: CameraBounds | undefined,
  ): number {
    let permitted = maximumDistance
    const radius = this.config.collisionRadius

    this.probeRight.crossVectors(direction, WORLD_UP)
    if (this.probeRight.lengthSq() < 1e-6) this.probeRight.set(1, 0, 0)
    this.probeRight.normalize()
    this.probeUp.crossVectors(this.probeRight, direction).normalize()

    const offsets: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
    ]

    this.raycaster.far = maximumDistance
    for (const [right, up] of offsets) {
      this.probeOrigin
        .copy(this.target)
        .addScaledVector(this.probeRight, right)
        .addScaledVector(this.probeUp, up)
      this.raycaster.set(this.probeOrigin, direction)
      const hit = this.raycaster.intersectObjects(occluders, true)[0]
      if (hit) permitted = Math.min(permitted, Math.max(0, hit.distance - this.config.occlusionPadding))
    }

    if (cameraBounds) {
      permitted = Math.min(permitted, this.getBoundsPermittedDistance(cameraBounds, direction, maximumDistance))
    }

    return permitted
  }

  private smoothingBlend(speed: number, deltaSeconds: number): number {
    return 1 - Math.exp(-speed * deltaSeconds)
  }

  private shortestAngle(from: number, to: number): number {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from))
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }

  private getBoundsPermittedDistance(bounds: CameraBounds, direction: Vector3, maximumDistance: number): number {
    let permittedDistance = maximumDistance

    const constrainAxis = (origin: number, axisDirection: number, minimum: number, maximum: number): void => {
      if (axisDirection > 0) {
        permittedDistance = Math.min(permittedDistance, (maximum - origin) / axisDirection)
      } else if (axisDirection < 0) {
        permittedDistance = Math.min(permittedDistance, (minimum - origin) / axisDirection)
      }
    }

    constrainAxis(this.target.x, direction.x, bounds.minX, bounds.maxX)
    constrainAxis(this.target.y, direction.y, bounds.minY, bounds.maxY)
    constrainAxis(this.target.z, direction.z, bounds.minZ, bounds.maxZ)

    return Math.max(0, permittedDistance)
  }
}
