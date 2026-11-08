import { CanvasTexture, Sprite, SpriteMaterial } from 'three'
import {
  EMOTION_DISPLAY_DURATION_MS,
  EMOTION_ENTER_DURATION_MS,
  EMOTION_EXIT_DURATION_MS,
  type VisitorEmotionState,
} from '../user/EmotionState.ts'

export interface EmotionLabelConfig {
  height: number
}

/** Sprite display for the transport-neutral VisitorEmotionState. */
export class EmotionLabel {
  readonly sprite: Sprite
  private readonly baseScale = 0.28
  private completedStateKey: string | undefined
  private displayedStateKey: string | undefined
  private readonly material: SpriteMaterial
  private readonly texture: CanvasTexture

  constructor(config: EmotionLabelConfig) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128

    this.texture = new CanvasTexture(canvas)
    this.texture.colorSpace = 'srgb'
    this.material = new SpriteMaterial({
      map: this.texture,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    })
    this.sprite = new Sprite(this.material)
    this.sprite.name = 'visitor-emotion-label'
    this.sprite.position.y = config.height
    this.sprite.scale.setScalar(this.baseScale)
    this.sprite.visible = false
  }

  /** Updates visibility, scale-in, and expiry fade using the shared emotion state. */
  update(state: VisitorEmotionState, now = Date.now()): void {
    if (!state.type || state.expiresAt === null) {
      this.displayedStateKey = undefined
      this.completedStateKey = undefined
      this.sprite.visible = false
      return
    }

    const stateKey = `${state.type}:${state.expiresAt}`
    if (this.displayedStateKey !== stateKey) {
      this.draw(state.type)
      this.displayedStateKey = stateKey
      this.completedStateKey = undefined
      this.sprite.visible = true
    }

    if (this.completedStateKey === stateKey) {
      return
    }

    const shownAt = state.expiresAt - EMOTION_DISPLAY_DURATION_MS
    const enterProgress = Math.min(1, Math.max(0, (now - shownAt) / EMOTION_ENTER_DURATION_MS))
    const easedEnter = 1 - (1 - enterProgress) ** 3
    const exitProgress = Math.min(1, Math.max(0, (now - state.expiresAt) / EMOTION_EXIT_DURATION_MS))

    this.sprite.scale.setScalar(this.baseScale * (0.78 + 0.22 * easedEnter))
    this.material.opacity = 1 - exitProgress

    if (exitProgress === 1) {
      this.sprite.visible = false
      this.completedStateKey = stateKey
    }
  }

  dispose(): void {
    this.texture.dispose()
    this.material.dispose()
  }

  private draw(emotion: string): void {
    const image = this.texture.image
    const context = image.getContext('2d')

    if (!context) {
      throw new Error('Emotion label canvas is unavailable.')
    }

    context.clearRect(0, 0, image.width, image.height)
    context.font = '88px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(emotion, image.width / 2, image.height / 2 + 3)
    this.texture.needsUpdate = true
  }
}
