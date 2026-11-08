import type { RoomIntroConfig } from '../scenes/exhibition/roomIntro/types.ts'

/** DOM-only long-form reader for wall introductions. */
export class RoomIntroReader {
  private readonly closeButton: HTMLButtonElement
  private readonly host: HTMLElement
  private readonly onVisibilityChange: (isVisible: boolean) => void
  private readonly paragraphs: HTMLElement
  private previouslyFocused: HTMLElement | undefined
  private readonly roomName: HTMLElement
  private readonly title: HTMLElement

  constructor(host: HTMLElement, onVisibilityChange: (isVisible: boolean) => void) {
    this.host = host
    this.onVisibilityChange = onVisibilityChange
    this.host.innerHTML = `
      <section class="room-intro-reader__dialog" role="dialog" aria-modal="true" aria-labelledby="room-intro-reader-title">
        <button class="room-intro-reader__close" type="button" aria-label="전시실 소개 닫기">×</button>
        <p class="room-intro-reader__eyebrow"></p>
        <h2 id="room-intro-reader-title"></h2>
        <div class="room-intro-reader__body"></div>
      </section>
    `
    const closeButton = host.querySelector<HTMLButtonElement>('.room-intro-reader__close')
    const paragraphs = host.querySelector<HTMLElement>('.room-intro-reader__body')
    const roomName = host.querySelector<HTMLElement>('.room-intro-reader__eyebrow')
    const title = host.querySelector<HTMLElement>('#room-intro-reader-title')
    if (!closeButton || !paragraphs || !roomName || !title) throw new Error('Room introduction reader could not be created.')

    this.closeButton = closeButton
    this.paragraphs = paragraphs
    this.roomName = roomName
    this.title = title
    this.closeButton.addEventListener('click', this.close)
    this.host.addEventListener('click', this.handleBackgroundClick)
  }

  open(intro: RoomIntroConfig): void {
    if (this.host.hidden) {
      this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
      this.host.hidden = false
      this.host.setAttribute('aria-hidden', 'false')
      this.onVisibilityChange(true)
      window.addEventListener('keydown', this.handleKeydown)
    }
    this.roomName.textContent = intro.roomName
    this.title.textContent = intro.title
    this.paragraphs.replaceChildren(...intro.paragraphs.map((text) => {
      const paragraph = document.createElement('p')
      paragraph.textContent = text
      return paragraph
    }))
    window.requestAnimationFrame(() => this.closeButton.focus())
  }

  close = (): void => {
    if (this.host.hidden) return
    window.removeEventListener('keydown', this.handleKeydown)
    this.host.hidden = true
    this.host.setAttribute('aria-hidden', 'true')
    this.onVisibilityChange(false)
    this.previouslyFocused?.focus()
    this.previouslyFocused = undefined
  }

  private readonly handleBackgroundClick = (event: MouseEvent): void => {
    if (event.target === this.host) this.close()
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }
}
