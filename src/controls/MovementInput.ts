/** Camera-relative walking intent: forward is away from the camera, right is screen-right. */
export interface MovementAxes {
  forward: number
  right: number
  /** 달리기(예: Shift를 누른 채 이동). 켜져 있으면 합친 입력의 길이가 RUN_SPEED_MULTIPLIER까지 늘어난다. */
  run?: boolean
}

/** 달릴 때 걷기 속도의 몇 배로 움직일지. VisitorCharacter도 이 값까지 속도를 허용한다. */
export const RUN_SPEED_MULTIPLIER = 2

const IDLE_AXES: MovementAxes = { forward: 0, right: 0 }

/**
 * Collects direct-walking input from every device in one place.
 * The keyboard and the touch joystick each write here under their own name; the scenes only read the sum.
 */
export class MovementInput {
  private readonly sources = new Map<string, MovementAxes>()

  /** Each input device owns one named slot so releasing one device never cancels another. */
  set(source: string, axes: MovementAxes): void {
    if (axes.forward === 0 && axes.right === 0) {
      this.sources.delete(source)
      return
    }
    this.sources.set(source, axes)
  }

  /** 이 장치(예: 'keyboard')가 지금 이동 입력을 넣고 있는지. */
  has(source: string): boolean {
    return this.sources.has(source)
  }

  clear(): void {
    this.sources.clear()
  }

  /**
   * Combined input, limited to length 1 so diagonals are not faster than straight lines.
   * 달리기 중이면 그 길이에 RUN_SPEED_MULTIPLIER를 곱한다(걷기 1, 달리기 2).
   */
  get axes(): MovementAxes {
    if (this.sources.size === 0) return IDLE_AXES

    let forward = 0
    let right = 0
    let run = false
    for (const axes of this.sources.values()) {
      forward += axes.forward
      right += axes.right
      if (axes.run) run = true
    }

    const length = Math.hypot(forward, right)
    if (length === 0) return IDLE_AXES
    const scale = (length > 1 ? 1 / length : 1) * (run ? RUN_SPEED_MULTIPLIER : 1)
    return { forward: forward * scale, right: right * scale, run }
  }
}
