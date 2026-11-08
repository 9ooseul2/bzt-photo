import { Group } from 'three'
import type { VisitorEmotionState } from '../user/EmotionState.ts'
import { EmotionLabel } from './EmotionLabel.ts'
import { NicknameLabel } from './NicknameLabel.ts'

export interface VisitorOverheadDisplayConfig {
  emoteHeight: number
  nicknameHeight: number
}

/**
 * Reusable overhead layer for a visitor. The whole group can later be hidden
 * by distance rules without changing nickname or emotion rendering.
 */
export class VisitorOverheadDisplay {
  readonly group = new Group()
  private readonly emotionLabel: EmotionLabel
  private readonly nicknameLabel: NicknameLabel

  constructor(nickname: string, config: VisitorOverheadDisplayConfig) {
    this.group.name = 'visitor-overhead-display'
    this.nicknameLabel = new NicknameLabel(nickname, { height: config.nicknameHeight })
    this.emotionLabel = new EmotionLabel({ height: config.emoteHeight })
    this.group.add(this.nicknameLabel.sprite, this.emotionLabel.sprite)
  }

  updateEmotion(state: VisitorEmotionState, now: number): void {
    this.emotionLabel.update(state, now)
  }

  setVisible(isVisible: boolean): void {
    this.group.visible = isVisible
  }

  dispose(): void {
    this.nicknameLabel.dispose()
    this.emotionLabel.dispose()
  }
}
