import type { MovementAxes, MovementInput } from './MovementInput.ts'

/** Physical key positions (event.code), so W·A·S·D work the same with a Korean keyboard layout. */
const KEY_AXES: Readonly<Record<string, MovementAxes>> = {
  KeyW: { forward: 1, right: 0 },
  ArrowUp: { forward: 1, right: 0 },
  KeyS: { forward: -1, right: 0 },
  ArrowDown: { forward: -1, right: 0 },
  KeyA: { forward: 0, right: -1 },
  ArrowLeft: { forward: 0, right: -1 },
  KeyD: { forward: 0, right: 1 },
  ArrowRight: { forward: 0, right: 1 },
}

/** 누르고 있는 동안 달리는 키. 왼쪽·오른쪽 Shift 모두 된다. */
const RUN_KEYS: ReadonlySet<string> = new Set(['ShiftLeft', 'ShiftRight'])

const SOURCE_ID = 'keyboard'

/**
 * Turns W·A·S·D and the arrow keys into walking input. Holding Shift makes the visitor run.
 * Keys are ignored while someone is typing, while a menu has already used the key,
 * and while the scene has paused visitor input behind a modal.
 */
export class KeyboardMovementControls {
  private readonly input: MovementInput
  private readonly isEnabled: () => boolean
  private readonly pressed = new Set<string>()
  private readonly runKeysHeld = new Set<string>()

  constructor(input: MovementInput, isEnabled: () => boolean) {
    this.input = input
    this.isEnabled = isEnabled
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.releaseAll)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.releaseAll)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.releaseAll()
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (RUN_KEYS.has(event.code)) {
      // Shift 자체는 스크롤 등을 일으키지 않으므로 preventDefault 없이 상태만 기억한다.
      if (this.runKeysHeld.has(event.code)) return
      this.runKeysHeld.add(event.code)
      if (this.pressed.size > 0) this.sync()
      return
    }
    if (!(event.code in KEY_AXES)) return
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (isTypingTarget(event.target) || !this.isEnabled()) return

    // Arrow keys would otherwise try to scroll the page or move focus.
    event.preventDefault()
    if (this.pressed.has(event.code)) return
    this.pressed.add(event.code)
    this.sync()
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (RUN_KEYS.has(event.code)) {
      if (this.runKeysHeld.delete(event.code) && this.pressed.size > 0) this.sync()
      return
    }
    if (this.pressed.delete(event.code)) this.sync()
  }

  /** A key released while the window was in the background never sends keyup, so forget everything. */
  private readonly releaseAll = (): void => {
    this.runKeysHeld.clear()
    if (this.pressed.size === 0) return
    this.pressed.clear()
    this.sync()
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll()
  }

  private sync(): void {
    let forward = 0
    let right = 0
    for (const code of this.pressed) {
      forward += KEY_AXES[code].forward
      right += KEY_AXES[code].right
    }
    // Opposite keys cancel out; each axis stays within -1..1 even if W and ArrowUp are both held.
    this.input.set(SOURCE_ID, {
      forward: clampUnit(forward),
      right: clampUnit(right),
      run: this.runKeysHeld.size > 0,
    })
  }
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}
