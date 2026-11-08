export class ViewingGuide {
  private readonly closeButton: HTMLButtonElement
  private readonly confirmButton: HTMLButtonElement
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

    if (!closeButton || !confirmButton) {
      throw new Error('Viewing guide could not be created.')
    }

    this.host = host
    this.helpButton = helpButton
    this.onVisibilityChange = onVisibilityChange
    this.closeButton = closeButton
    this.confirmButton = confirmButton
    this.closeButton.addEventListener('click', this.hide)
    this.confirmButton.addEventListener('click', this.hide)
    this.helpButton.addEventListener('click', this.show)
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
}
