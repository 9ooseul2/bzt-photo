import { Group, Vector3 } from 'three'
import type { CharacterVisual } from './CharacterVisual.ts'
import type { NavigationPoint } from './pathfinding/GridPathfinder.ts'
import { RUN_SPEED_MULTIPLIER } from '../controls/MovementInput.ts'

const ARRIVAL_DISTANCE = 0.035
/** Shared by click-to-move and direct walking so both feel the same. */
const WALK_SPEED = 3.2
/** Direct-walking input below this strength is treated as no input. */
const DIRECT_INPUT_THRESHOLD = 0.01
const FACING_ARRIVAL_ANGLE = (3 * Math.PI) / 180

/** 점프: 얼마나 높이(m) 뛰어오르는지. */
const JUMP_HEIGHT = 0.6
/** 점프 중 아래로 끌어당기는 힘(m/s²). 클수록 빠르고 통통 튀는 느낌이다. */
const JUMP_GRAVITY = 20
const JUMP_VELOCITY = Math.sqrt(2 * JUMP_GRAVITY * JUMP_HEIGHT)
/** 착지 직전에 누른 점프도 놓치지 않도록, 이 시간(초) 동안은 기억했다가 착지하자마자 뛴다. */
const JUMP_BUFFER_SECONDS = 0.15
/** 뛰어오를 때 살짝 길어지고, 착지할 때 살짝 납작해지는 정도. */
const JUMP_STRETCH = 0.1
const LANDING_SQUASH = 0.14
/** 착지 후 납작해진 몸이 원래대로 돌아오는 속도. */
const SQUASH_RECOVERY = 14

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
  /**
   * 점프할 때 위로 올라가는 부분. 이름표·감정 표시도 여기에 붙이면 함께 뛰어오른다.
   * root 는 언제나 바닥에 있으므로 길찾기·충돌·카메라는 점프의 영향을 받지 않는다.
   */
  readonly body = new Group()
  /** 점프·착지 때 몸을 늘이고 누르는 부분 (이름표는 늘어나지 않게 body 와 나눠 둔다). */
  private readonly squash = new Group()
  readonly collisionRadius: number
  private readonly cameraTarget = new Vector3()
  private readonly config: VisitorCharacterConfig
  private readonly direction = new Vector3()
  private readonly directInput = new Vector3()
  private canStandAt: ((point: NavigationPoint) => boolean) | undefined
  private readonly facingTarget = new Vector3()
  private hasFacingTarget = false
  private readonly nextTarget = new Vector3()
  private path: Vector3[] = []
  private movementEnabled = true
  private seated = false
  /** 바닥에서 몸이 떠 있는 높이(m)와 위아래 속도(m/s). */
  private jumpHeight = 0
  private jumpVelocity = 0
  private isAirborne = false
  /** 점프 요청이 남아 있는 시간(초). 0 이면 요청 없음. */
  private jumpBuffer = 0
  /** 1 = 원래 모양. 1 보다 작으면 납작, 크면 길쭉. */
  private squashAmount = 1
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
    this.squash.add(visual.root)
    this.body.add(this.squash)
    this.root.add(this.body)
  }

  get isMoving(): boolean {
    return this.path.length > 0
  }

  /** True while a keyboard or the touch joystick is steering the visitor directly. */
  get isDirectMoving(): boolean {
    return this.directInput.lengthSq() > DIRECT_INPUT_THRESHOLD ** 2
  }

  /** Direct walking asks the room's navigation whether each step is free of walls and props. */
  setCollisionCheck(canStandAt: (point: NavigationPoint) => boolean): void {
    this.canStandAt = canStandAt
  }

  /**
   * World-space walking direction on the floor plane. Length 0..1 scales the walking speed,
   * and up to RUN_SPEED_MULTIPLIER (2) means running (Shift held).
   * (0, 0) stops direct walking and leaves click-to-move in charge again.
   */
  setDirectMovement(x: number, z: number): void {
    this.directInput.set(x, 0, z)
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

  /** 지금 공중에 떠 있는지 (점프 중). */
  get isJumping(): boolean {
    return this.isAirborne
  }

  /**
   * 점프한다. 걷거나 달리는 중에도 되고, 공중에서도 방향을 바꿀 수 있다.
   * 이미 공중이면 착지하자마자 한 번 더 뛴다. 의자에 앉아 있을 때는 무시한다.
   */
  jump(): void {
    if (this.seated || !this.movementEnabled) return
    this.jumpBuffer = JUMP_BUFFER_SECONDS
  }

  /** Pauses an existing route while a blocking interface is visible. */
  setMovementEnabled(enabled: boolean): void {
    this.movementEnabled = enabled
  }

  update(deltaSeconds: number): void {
    // 창이 열려 이동이 멈춰도, 이미 뛰어오른 몸은 바닥까지 내려와야 한다.
    this.updateJump(deltaSeconds)

    if (!this.movementEnabled) {
      this.visual.updateAnimation(deltaSeconds, { isWalking: false, movementSpeed: 0 })
      return
    }

    if (this.isDirectMoving) {
      this.updateDirectMovement(deltaSeconds)
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

    const movement = Math.min(distance, WALK_SPEED * deltaSeconds)
    this.root.position.addScaledVector(this.direction, movement)
    this.visual.updateAnimation(deltaSeconds, {
      isWalking: movement > 0,
      movementSpeed: movement / Math.max(deltaSeconds, Number.EPSILON),
    })
  }

  /**
   * 의자에 앉힌다: 위치와 방향을 바로 정하고 앉은 자세로 바꾼다.
   * heightOffset = 캐릭터 발 기준점을 바닥에서 얼마나 올릴지 (의자 높이에 맞춤)
   */
  sitAt(point: { x: number; z: number }, facing: { x: number; z: number }, heightOffset: number): void {
    this.clearPath()
    this.resetJump()
    this.seated = true
    this.root.position.set(point.x, heightOffset, point.z)
    this.root.rotation.y = Math.atan2(facing.x - point.x, facing.z - point.z)
    this.visual.setSeated?.(true)
  }

  /** 의자에서 일어나 바닥의 한 지점에 선다. */
  standAt(point: { x: number; z: number }): void {
    this.seated = false
    this.visual.setSeated?.(false)
    this.root.position.set(point.x, 0, point.z)
  }

  getCameraTarget(target = this.cameraTarget): Vector3 {
    return target.copy(this.root.position).add(new Vector3(0, this.config.cameraTargetHeight, 0))
  }

  private updateDirectMovement(deltaSeconds: number): void {
    // Steering by hand replaces any route or turn that a click had started.
    this.path = []
    this.hasFacingTarget = false

    const strength = Math.min(this.directInput.length(), RUN_SPEED_MULTIPLIER)
    this.direction.copy(this.directInput).normalize()
    const targetRotation = Math.atan2(this.direction.x, this.direction.z)
    const turnBlend = 1 - Math.exp(-12 * deltaSeconds)
    this.root.rotation.y += this.shortestAngle(this.root.rotation.y, targetRotation) * turnBlend

    const step = WALK_SPEED * strength * deltaSeconds
    const position = this.root.position
    const nextX = position.x + this.direction.x * step
    const nextZ = position.z + this.direction.z * step
    const startX = position.x
    const startZ = position.z

    // Try the full step, then each axis alone, so the visitor slides along a wall instead of sticking to it.
    if (this.canMoveTo(nextX, nextZ)) {
      position.x = nextX
      position.z = nextZ
    } else if (this.direction.x !== 0 && this.canMoveTo(nextX, startZ)) {
      position.x = nextX
    } else if (this.direction.z !== 0 && this.canMoveTo(startX, nextZ)) {
      position.z = nextZ
    }

    const moved = Math.hypot(position.x - startX, position.z - startZ)
    this.visual.updateAnimation(deltaSeconds, {
      isWalking: moved > 0,
      movementSpeed: moved / Math.max(deltaSeconds, Number.EPSILON),
    })
  }

  private updateJump(deltaSeconds: number): void {
    if (!this.movementEnabled) this.jumpBuffer = 0
    if (this.jumpBuffer > 0) {
      if (!this.isAirborne) {
        this.isAirborne = true
        this.jumpVelocity = JUMP_VELOCITY
        this.jumpBuffer = 0
      } else {
        this.jumpBuffer = Math.max(0, this.jumpBuffer - deltaSeconds)
      }
    }

    if (this.isAirborne) {
      this.jumpVelocity -= JUMP_GRAVITY * deltaSeconds
      this.jumpHeight += this.jumpVelocity * deltaSeconds
      if (this.jumpHeight <= 0) {
        this.jumpHeight = 0
        this.jumpVelocity = 0
        this.isAirborne = false
        this.squashAmount = 1 - LANDING_SQUASH
      } else {
        // 올라갈 때는 살짝 길쭉하게, 꼭대기에서는 원래대로.
        this.squashAmount = 1 + JUMP_STRETCH * Math.max(0, Math.min(1, this.jumpVelocity / JUMP_VELOCITY))
      }
    } else if (this.squashAmount !== 1) {
      this.squashAmount += (1 - this.squashAmount) * (1 - Math.exp(-SQUASH_RECOVERY * deltaSeconds))
      if (Math.abs(this.squashAmount - 1) < 0.002) this.squashAmount = 1
    }

    this.body.position.y = this.jumpHeight
    // 부피가 비슷하게 보이도록, 위아래로 늘면 옆으로는 조금 줄인다. 발끝을 기준으로 늘고 줄어든다.
    const sideways = 1 / Math.sqrt(this.squashAmount)
    this.squash.scale.set(sideways, this.squashAmount, sideways)
  }

  private resetJump(): void {
    this.jumpBuffer = 0
    this.jumpHeight = 0
    this.jumpVelocity = 0
    this.isAirborne = false
    this.squashAmount = 1
    this.body.position.y = 0
    this.squash.scale.set(1, 1, 1)
  }

  private canMoveTo(x: number, z: number): boolean {
    return this.canStandAt?.({ x, z }) ?? true
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
