/** 방에 들어왔을 때 화면 위쪽에 잠깐 떴다가 서서히 사라지는 안내 문구 */
export class RoomNotice {
  private readonly element: HTMLParagraphElement
  private readonly hideTimer: number
  private removeTimer: number | undefined

  constructor(container: HTMLElement, message: string, visibleMs = 4500) {
    this.element = document.createElement('p')
    this.element.className = 'room-notice'
    this.element.setAttribute('role', 'status')
    this.element.textContent = message
    container.append(this.element)
    this.hideTimer = window.setTimeout(() => {
      this.element.classList.add('room-notice--hiding')
      this.removeTimer = window.setTimeout(() => this.element.remove(), 500)
    }, visibleMs)
  }

  dispose(): void {
    window.clearTimeout(this.hideTimer)
    if (this.removeTimer !== undefined) window.clearTimeout(this.removeTimer)
    this.element.remove()
  }
}
