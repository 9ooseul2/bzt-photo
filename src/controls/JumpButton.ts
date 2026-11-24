/**
 * 터치 기기용 점프 버튼. 화면 오른쪽 아래, + 버튼 위에 보인다.
 *
 * - 보이는지 여부는 조이스틱처럼 CSS 의 (pointer: coarse) 로 정한다. PC 에서는 Space 키로 점프한다.
 * - 3D 캔버스와 형제 요소라서, 버튼을 누른 손가락은 둘러보기·탭 이동으로 전달되지 않는다.
 *   조이스틱을 잡은 채 다른 손가락으로 누르면 달리면서 점프할 수 있다.
 */
export class JumpButton {
  private readonly button: HTMLButtonElement
  private readonly onPress: () => void

  constructor(host: HTMLElement, onPress: () => void) {
    this.onPress = onPress
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'jump-button'
    this.button.setAttribute('aria-label', '점프')
    this.button.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11.5 12 5.5l6 6" /></svg>'
    host.append(this.button)

    // 손가락을 대는 순간 뛴다 (click 은 손을 뗄 때라 늦게 느껴진다).
    this.button.addEventListener('pointerdown', this.handlePointerDown)
    this.button.addEventListener('pointerup', this.handlePointerEnd)
    this.button.addEventListener('pointercancel', this.handlePointerEnd)
    this.button.addEventListener('pointerleave', this.handlePointerEnd)
    this.button.addEventListener('contextmenu', preventDefault)
  }

  /** 작품 보기·방명록 등 창이 열리면 숨긴다. */
  setEnabled(enabled: boolean): void {
    this.button.hidden = !enabled
    if (!enabled) this.button.classList.remove('jump-button--pressed')
  }

  dispose(): void {
    this.button.removeEventListener('pointerdown', this.handlePointerDown)
    this.button.removeEventListener('pointerup', this.handlePointerEnd)
    this.button.removeEventListener('pointercancel', this.handlePointerEnd)
    this.button.removeEventListener('pointerleave', this.handlePointerEnd)
    this.button.removeEventListener('contextmenu', preventDefault)
    this.button.remove()
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    // 길게 눌러도 확대·텍스트 선택·포커스가 생기지 않게 한다.
    event.preventDefault()
    this.button.classList.add('jump-button--pressed')
    this.onPress()
  }

  private readonly handlePointerEnd = (): void => {
    this.button.classList.remove('jump-button--pressed')
  }
}

function preventDefault(event: Event): void {
  event.preventDefault()
}
