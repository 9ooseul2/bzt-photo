import { PerspectiveCamera, Raycaster, Vector3, type Object3D } from 'three'
import type { CameraBounds } from '../exhibition/types.ts'
import { VISITOR_CAMERA_CONFIG, type ThirdPersonCameraConfig } from './visitorCameraConfig.ts'

/** Orbit-style third-person camera with wall-aware placement. */
export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera
  private azimuth: number
  private appliedDistance: number
  private readonly config: ThirdPersonCameraConfig
  private readonly desiredPosition = new Vector3()
  private readonly cameraRayDirection = new Vector3()
  private readonly lookDirection = new Vector3()
  private readonly lookTarget = new Vector3()
  private pitch: number
  private readonly raycaster = new Raycaster()
  private readonly target = new Vector3()
  private targetAzimuth: number
  private targetDistance: number
  private targetPitch: number
  private zoomDistance: number
  private guidedRotationRemaining = 0

  constructor(config: ThirdPersonCameraConfig = VISITOR_CAMERA_CONFIG) {
    this.config = config
    this.azimuth = config.initialAzimuth
    this.pitch = config.initialPitch
    this.targetAzimuth = config.initialAzimuth
    this.targetPitch = config.initialPitch
    this.targetDistance = config.distance
    this.zoomDistance = config.distance
    this.appliedDistance = config.distance
    this.camera = new PerspectiveCamera(config.fieldOfView, 1, 0.1, 100)
  }

  rotate(deltaX: number, deltaY: number): void {
    this.guidedRotationRemaining = 0
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
  }

  update(
    focusTarget: Vector3,
    occluders: readonly Object3D[],
    cameraBounds?: CameraBounds,
    deltaSeconds = 1 / 60,
  ): void {
    const rotationSpeed = this.guidedRotationRemaining > 0 ? 5.8 : this.config.rotationSmoothing
    const rotationBlend = this.smoothingBlend(rotationSpeed, deltaSeconds)
    this.azimuth += this.shortestAngle(this.azimuth, this.targetAzimuth) * rotationBlend
    this.pitch += (this.targetPitch - this.pitch) * rotationBlend
    this.guidedRotationRemaining = Math.max(0, this.guidedRotationRemaining - deltaSeconds)
    this.zoomDistance +=
      (this.targetDistance - this.zoomDistance) *
      this.smoothingBlend(this.config.zoomSmoothing, deltaSeconds)

    this.target.copy(focusTarget)
    this.target.y += this.config.focusHeightOffset
    const horizontalDistance = this.zoomDistance * Math.cos(this.config.orbitElevation)
    this.desiredPosition.set(
      this.target.x + Math.sin(this.azimuth) * horizontalDistance,
      this.target.y + Math.sin(this.config.orbitElevation) * this.zoomDistance,
      this.target.z + Math.cos(this.azimuth) * horizontalDistance,
    )

    this.cameraRayDirection.subVectors(this.desiredPosition, this.target)
    const desiredDistance = this.cameraRayDirection.length()
    this.cameraRayDirection.normalize()
    this.raycaster.set(this.target, this.cameraRayDirection)
    this.raycaster.far = desiredDistance
    const blockingHit = this.raycaster.intersectObjects([...occluders], true)[0]
    const meshPermittedDistance = blockingHit
      ? Math.max(0, blockingHit.distance - this.config.occlusionPadding)
      : desiredDistance
    const boundsPermittedDistance = cameraBounds
      ? this.getBoundsPermittedDistance(cameraBounds, desiredDistance)
      : desiredDistance
    const permittedDistance = Math.min(meshPermittedDistance, boundsPermittedDistance)
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

  private smoothingBlend(speed: number, deltaSeconds: number): number {
    return 1 - Math.exp(-speed * deltaSeconds)
  }

  private shortestAngle(from: number, to: number): number {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from))
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }

  private getBoundsPermittedDistance(bounds: CameraBounds, maximumDistance: number): number {
    let permittedDistance = maximumDistance

    const constrainAxis = (origin: number, direction: number, minimum: number, maximum: number): void => {
      if (direction > 0) {
        permittedDistance = Math.min(permittedDistance, (maximum - origin) / direction)
      } else if (direction < 0) {
        permittedDistance = Math.min(permittedDistance, (minimum - origin) / direction)
      }
    }

    constrainAxis(this.target.x, this.cameraRayDirection.x, bounds.minX, bounds.maxX)
    constrainAxis(this.target.y, this.cameraRayDirection.y, bounds.minY, bounds.maxY)
    constrainAxis(this.target.z, this.cameraRayDirection.z, bounds.minZ, bounds.maxZ)

    return Math.max(0, permittedDistance)
  }
}
