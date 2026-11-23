// '오늘 그만 보기'를 누르면 그날 23:59:59까지 자동 팝업을 띄우지 않는다.
// 새로고침·재진입에도 유지되도록 localStorage에 만료 시각(ms)을 저장한다.
const DISMISS_STORAGE_KEY = 'bzt-viewing-guide-dismissed-until'

function readDismissedUntil(): number {
  try {
    const value = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function saveDismissedUntilEndOfToday(): void {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(endOfToday.getTime()))
  } catch {
    // 저장소를 쓸 수 없는 환경(일부 인앱 브라우저 등)에서는 이번 창에서만 닫힌다.
  }
}

export class ViewingGuide {
  private readonly closeButton: HTMLButtonElement
  private readonly confirmButton: HTMLButtonElement
  private readonly dismissTodayButton: HTMLButtonElement
  private readonly helpButton: HTMLButtonElement
  private readonly host: HTMLElement
  private readonly onVisibilityChange: (isVisible: boolean) => void

  constructor(
    host: HTMLElement,
    helpButton: HTMLButtonElement,
    onVisibilityChange: (isVisible: boolean) => void,
  ) {
    const closeButton = host.querySelector<HTMLButtonElement>('.guide-dialog__close')
    const confirmButton = host.querySelector<HTMLButtonElement>('.guide-dialog__confirm')
    const dismissTodayButton = host.querySelector<HTMLButtonElement>('.guide-dialog__dismiss-today')

    if (!closeButton || !confirmButton || !dismissTodayButton) {
      throw new Error('Viewing guide could not be created.')
    }

    this.host = host
    this.helpButton = helpButton
    this.onVisibilityChange = onVisibilityChange
    this.closeButton = closeButton
    this.confirmButton = confirmButton
    this.dismissTodayButton = dismissTodayButton
    this.closeButton.addEventListener('click', this.hide)
    this.confirmButton.addEventListener('click', this.hide)
    this.dismissTodayButton.addEventListener('click', this.dismissForToday)
    this.helpButton.addEventListener('click', this.show)
  }

  /** 전시실 입장 시 자동 표시. '오늘 그만 보기' 기간이면 '?' 버튼만 보여준다. */
  showAutomatically = (): void => {
    if (Date.now() <= readDismissedUntil()) {
      this.helpButton.hidden = false
      return
    }
    this.show()
  }

  show = (): void => {
    this.host.hidden = false
    this.host.setAttribute('aria-hidden', 'false')
    this.helpButton.hidden = true
    this.onVisibilityChange(true)
    window.requestAnimationFrame(() => this.confirmButton.focus())
  }

  hide = (): void => {
    this.host.hidden = true
    this.host.setAttribute('aria-hidden', 'true')
    this.helpButton.hidden = false
    this.onVisibilityChange(false)
  }

  private dismissForToday = (): void => {
    saveDismissedUntilEndOfToday()
    this.hide()
  }
}
