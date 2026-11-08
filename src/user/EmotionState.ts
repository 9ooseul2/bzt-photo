export const EMOTION_TYPES = ['❤️', '👏', '🥹'] as const

export type EmotionType = (typeof EMOTION_TYPES)[number]

/** Duration values are state semantics so remote visitors can replay them consistently. */
export const EMOTION_DISPLAY_DURATION_MS = 10_000
export const EMOTION_ENTER_DURATION_MS = 200
export const EMOTION_EXIT_DURATION_MS = 300

export interface VisitorEmotionState {
  expiresAt: number | null
  type: EmotionType | null
}

export function isEmotionType(value: string): value is EmotionType {
  return EMOTION_TYPES.some((emotion) => emotion === value)
}

/**
 * Transport-neutral emotion data. A future realtime adapter can call
 * setState() for another visitor without depending on the picker UI.
 */
export class EmotionStateStore {
  private currentState: VisitorEmotionState = { type: null, expiresAt: null }

  get state(): VisitorEmotionState {
    return this.currentState
  }

  select(type: EmotionType, now = Date.now()): VisitorEmotionState {
    this.currentState = {
      type,
      expiresAt: now + EMOTION_DISPLAY_DURATION_MS,
    }
    return this.currentState
  }

  setState(state: VisitorEmotionState): void {
    this.currentState = { ...state }
  }

  clear(): void {
    this.currentState = { type: null, expiresAt: null }
  }

  clearExpired(now = Date.now()): void {
    const { expiresAt } = this.currentState

    if (expiresAt !== null && now >= expiresAt + EMOTION_EXIT_DURATION_MS) {
      this.clear()
    }
  }
}
