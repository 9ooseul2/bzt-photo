/**
 * 키보드로 다니는 관람객용 안내: 소파 앞에 서면 소파 위에 "Space 앉기",
 * 앉아 있을 때는 화면 아래쪽에 "Space 일어나기"를 띄운다.
 */
export class SeatKeyHint {
  private readonly element: HTMLDivElement
  private readonly label: HTMLSpanElement

  constructor(container: HTMLElement) {
    this.element = document.createElement('div')
    this.element.className = 'seat-key-hint'
    this.element.hidden = true
    const key = document.createElement('kbd')
    key.textContent = 'Space'
    this.label = document.createElement('span')
    this.element.append(key, this.label)
    container.append(this.element)
  }

  /** 소파 위 (화면 좌표, px) */
  showAt(x: number, y: number, text: string): void {
    this.element.classList.remove('seat-key-hint--docked')
    this.element.style.left = `${x}px`
    this.element.style.top = `${y}px`
    this.show(text)
  }

  /** 화면 아래쪽 가운데 */
  showDocked(text: string): void {
    this.element.classList.add('seat-key-hint--docked')
    this.element.style.left = ''
    this.element.style.top = ''
    this.show(text)
  }

  hide(): void {
    this.element.hidden = true
  }

  dispose(): void {
    this.element.remove()
  }

  private show(text: string): void {
    if (this.label.textContent !== text) this.label.textContent = text
    this.element.hidden = false
  }
}
