/** Camera-relative walking intent: forward is away from the camera, right is screen-right. */
export interface MovementAxes {
  forward: number
  right: number
}

const IDLE_AXES: MovementAxes = { forward: 0, right: 0 }

/**
 * Collects direct-walking input from every device in one place.
 * The keyboard writes here today; a touch joystick can write here later without touching the scenes.
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

  clear(): void {
    this.sources.clear()
  }

  /** Combined input, limited to length 1 so diagonals are not faster than straight lines. */
  get axes(): MovementAxes {
    if (this.sources.size === 0) return IDLE_AXES

    let forward = 0
    let right = 0
    for (const axes of this.sources.values()) {
      forward += axes.forward
      right += axes.right
    }

    const length = Math.hypot(forward, right)
    if (length === 0) return IDLE_AXES
    const scale = length > 1 ? 1 / length : 1
    return { forward: forward * scale, right: right * scale }
  }
}
