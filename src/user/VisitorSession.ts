export interface VisitorState {
  nickname: string
}

/** Local-only visitor state, deliberately ready to be replaced by a realtime identity source. */
export class VisitorSession {
  private state: VisitorState = { nickname: '' }

  get nickname(): string {
    return this.state.nickname
  }

  normalizeNickname(value: string): string {
    return Array.from(value.trim()).slice(0, 12).join('')
  }

  hasValidNickname(value: string): boolean {
    return this.normalizeNickname(value).length > 0
  }

  setNickname(value: string): VisitorState {
    const nickname = this.normalizeNickname(value)

    if (!nickname) {
      throw new Error('A nickname is required to enter the gallery.')
    }

    this.state = { nickname }
    return this.state
  }
}
