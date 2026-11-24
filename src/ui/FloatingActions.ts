/**
 * 오른쪽 아래 확장형 플로팅 버튼 (인증샷 · 꾸미기 · 관람 안내).
 *
 * - 항목 버튼(.floating-actions__item)은 App·ViewingGuide 가 지금처럼 hidden 으로 켜고 끈다.
 *   보이는 항목이 하나도 없으면 플로팅 버튼 전체가 숨는다.
 * - 펼쳐도 뒤에 오버레이는 깔지 않는다.
 * - 항목을 고르거나, ×·바깥·Esc 를 누르면 닫힌다.
 *   3D 화면을 눌러 닫을 때는 닫기만 하고 캐릭터는 움직이지 않는다.
 */
export class FloatingActions {
  private readonly host: HTMLElement
  private readonly menu: HTMLElement
  private readonly toggleButton: HTMLButtonElement
  private readonly sceneHost: HTMLElement
  private readonly observer: MutationObserver

  constructor(host: HTMLElement, sceneHost: HTMLElement) {
    const menu = host.querySelector<HTMLElement>('.floating-actions__menu')
    const toggleButton = host.querySelector<HTMLButtonElement>('.floating-actions__toggle')
    if (!menu || !toggleButton) throw new Error('Floating actions could not be created.')

    this.host = host
    this.menu = menu
    this.toggleButton = toggleButton
    this.sceneHost = sceneHost

    this.toggleButton.addEventListener('click', this.toggle)
    // 항목을 누르면 그 기능을 실행한 뒤 메뉴를 닫는다 (항목 자체의 click 은 각자 처리).
    this.menu.addEventListener('click', this.handleMenuClick)
    this.menu.addEventListener('keydown', this.handleMenuKeydown)
    // 버튼 위에서 누르거나 끄는 동작이 3D 화면으로 새지 않게.
    for (const type of ['pointerdown', 'pointermove', 'pointerup'] as const) {
      this.host.addEventListener(type, this.stopSceneEvent)
    }
    this.host.addEventListener('wheel', this.stopSceneEvent, { passive: false })

    this.observer = new MutationObserver(this.syncVisibility)
    for (const item of this.items) {
      this.observer.observe(item, { attributes: true, attributeFilter: ['hidden'] })
    }
    this.syncVisibility()
  }

  close = (restoreFocus = false): void => {
    if (!this.isOpen) return
    this.host.classList.remove('floating-actions--open')
    this.menu.hidden = true
    this.toggleButton.setAttribute('aria-expanded', 'false')
    this.toggleButton.setAttribute('aria-label', '메뉴 열기')
    window.removeEventListener('pointerdown', this.handleOutsidePointer, true)
    window.removeEventListener('keydown', this.handleWindowKeydown)
    if (restoreFocus) this.toggleButton.focus()
  }

  private open(): void {
    if (this.isOpen) return
    this.host.classList.add('floating-actions--open')
    this.menu.hidden = false
    this.toggleButton.setAttribute('aria-expanded', 'true')
    this.toggleButton.setAttribute('aria-label', '메뉴 닫기')
    window.addEventListener('pointerdown', this.handleOutsidePointer, true)
    window.addEventListener('keydown', this.handleWindowKeydown)
  }

  private get isOpen(): boolean {
    return !this.menu.hidden
  }

  private get items(): HTMLButtonElement[] {
    return [...this.menu.querySelectorAll<HTMLButtonElement>('.floating-actions__item')]
  }

  private get visibleItems(): HTMLButtonElement[] {
    return this.items.filter((item) => !item.hidden)
  }

  private readonly syncVisibility = (): void => {
    const hasItems = this.visibleItems.length > 0
    if (!hasItems) this.close()
    this.host.hidden = !hasItems
  }

  private readonly toggle = (): void => {
    if (this.isOpen) {
      this.close()
      return
    }
    this.open()
  }

  private readonly handleMenuClick = (event: MouseEvent): void => {
    const item = (event.target as HTMLElement).closest('.floating-actions__item')
    if (item) this.close()
  }

  private readonly handleOutsidePointer = (event: PointerEvent): void => {
    const target = event.target as Node
    if (this.host.contains(target)) return
    this.close()
    // 3D 화면을 눌러 메뉴만 닫은 경우: 이번 누름으로 캐릭터가 걷거나 화면이 돌지 않게 막는다.
    // (조이스틱도 같은 영역 안에 있지만 canvas 가 아니므로 그대로 쓸 수 있다.)
    if (target instanceof HTMLCanvasElement && this.sceneHost.contains(target)) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  private readonly handleWindowKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    this.close(true)
  }

  private readonly handleMenuKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = this.visibleItems
    if (items.length === 0) return
    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    const direction = event.key === 'ArrowDown' ? 1 : -1
    items[(currentIndex + direction + items.length) % items.length].focus()
  }

  private readonly stopSceneEvent = (event: Event): void => {
    event.stopPropagation()
    if (event.type === 'wheel') event.preventDefault()
  }
}
