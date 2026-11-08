import { Group, Vector3 } from 'three'
import type { CharacterVisual } from './CharacterVisual.ts'
import type { NavigationPoint } from './pathfinding/GridPathfinder.ts'

const ARRIVAL_DISTANCE = 0.035
const FACING_ARRIVAL_ANGLE = (3 * Math.PI) / 180

export interface VisitorCharacterConfig {
  /** Kept alongside a model so navigation can be tuned without touching movement. */
  collisionRadius: number
  /** The third-person camera focus point, measured from the character root. */
  cameraTargetHeight: number
}

export const DEFAULT_VISITOR_CHARACTER_CONFIG: VisitorCharacterConfig = {
  collisionRadius: 0.42,
  cameraTargetHeight: 1.25,
}

/** Movement logic is separate from the temporary visual model. */
export class VisitorCharacter {
  readonly root = new Group()
  readonly collisionRadius: number
  private readonly cameraTarget = new Vector3()
  private readonly config: VisitorCharacterConfig
  private readonly direction = new Vector3()
  private readonly facingTarget = new Vector3()
  private hasFacingTarget = false
  private readonly nextTarget = new Vector3()
  private path: Vector3[] = []
  private movementEnabled = true
  private readonly visual: CharacterVisual

  constructor(
    visual: CharacterVisual,
    spawnPoint: NavigationPoint,
    config: VisitorCharacterConfig = DEFAULT_VISITOR_CHARACTER_CONFIG,
  ) {
    this.visual = visual
    this.config = config
    this.collisionRadius = config.collisionRadius
    this.root.name = 'visitor-character'
    this.root.position.set(spawnPoint.x, 0, spawnPoint.z)
    this.root.rotation.y = Math.PI
    this.root.add(visual.root)
  }

  get isMoving(): boolean {
    return this.path.length > 0
  }

  /** True once a requested stationary turn is within a visually imperceptible 3°. */
  get isFacingTarget(): boolean {
    if (!this.hasFacingTarget) return true
    const directionX = this.facingTarget.x - this.root.position.x
    const directionZ = this.facingTarget.z - this.root.position.z
    if (Math.hypot(directionX, directionZ) < Number.EPSILON) return true
    const targetRotation = Math.atan2(directionX, directionZ)
    return Math.abs(this.shortestAngle(this.root.rotation.y, targetRotation)) < FACING_ARRIVAL_ANGLE
  }

  setPath(points: readonly NavigationPoint[]): boolean {
    this.hasFacingTarget = false
    const nextPath = points
      .map((point) => new Vector3(point.x, 0, point.z))
      .filter((point) => point.distanceToSquared(this.root.position) > ARRIVAL_DISTANCE ** 2)

    if (nextPath.length === 0) {
      return false
    }

    this.path = nextPath
    return true
  }

  /** Stops a superseded route without changing any movement tuning. */
  clearPath(): void {
    this.path = []
    this.hasFacingTarget = false
  }

  /** Turns a stationary visitor toward a world-space floor position. */
  faceToward(point: { x: number; z: number }): void {
    this.facingTarget.set(point.x, 0, point.z)
    this.hasFacingTarget = true
  }

  /** Pauses an existing route while a blocking interface is visible. */
  setMovementEnabled(enabled: boolean): void {
    this.movementEnabled = enabled
  }

  update(deltaSeconds: number): void {
    if (!this.movementEnabled) {
      this.visual.updateAnimation(deltaSeconds, { isWalking: false, movementSpeed: 0 })
      return
    }

    while (this.path.length > 0 && this.root.position.distanceTo(this.path[0]) < ARRIVAL_DISTANCE) {
      this.path.shift()
    }

    const waypoint = this.path[0]

    if (!waypoint) {
      this.updateStationaryFacing(deltaSeconds)
      this.visual.updateAnimation(deltaSeconds, { isWalking: false, movementSpeed: 0 })
      return
    }

    this.nextTarget.copy(waypoint)
    this.direction.subVectors(this.nextTarget, this.root.position)
    this.direction.y = 0
    const distance = this.direction.length()

    if (distance === 0) {
      this.path.shift()
      this.visual.updateAnimation(deltaSeconds, { isWalking: false, movementSpeed: 0 })
      return
    }

    this.direction.divideScalar(distance)
    const targetRotation = Math.atan2(this.direction.x, this.direction.z)
    const turnBlend = 1 - Math.exp(-10 * deltaSeconds)
    this.root.rotation.y += this.shortestAngle(this.root.rotation.y, targetRotation) * turnBlend

    const speed = 3.2
    const movement = Math.min(distance, speed * deltaSeconds)
    this.root.position.addScaledVector(this.direction, movement)
    this.visual.updateAnimation(deltaSeconds, {
      isWalking: movement > 0,
      movementSpeed: movement / Math.max(deltaSeconds, Number.EPSILON),
    })
  }

  getCameraTarget(target = this.cameraTarget): Vector3 {
    return target.copy(this.root.position).add(new Vector3(0, this.config.cameraTargetHeight, 0))
  }

  private shortestAngle(from: number, to: number): number {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from))
  }

  private updateStationaryFacing(deltaSeconds: number): void {
    if (!this.hasFacingTarget || this.isFacingTarget) return
    const directionX = this.facingTarget.x - this.root.position.x
    const directionZ = this.facingTarget.z - this.root.position.z
    const targetRotation = Math.atan2(directionX, directionZ)
    const turnBlend = 1 - Math.exp(-10 * deltaSeconds)
    this.root.rotation.y += this.shortestAngle(this.root.rotation.y, targetRotation) * turnBlend
  }
}
