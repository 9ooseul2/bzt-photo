import { GIFT_SHOP_URL } from '../config/externalLinks.ts'

/** Lightweight interstitial for the external shop, kept independent from the guestbook UI. */
export class GiftShopCard {
  private readonly closeButton: HTMLButtonElement
  private readonly host: HTMLElement
  private readonly openButton: HTMLButtonElement
  private readonly onVisibilityChange: (isVisible: boolean) => void
  private previouslyFocused: HTMLElement | undefined

  constructor(host: HTMLElement, onVisibilityChange: (isVisible: boolean) => void) {
    this.host = host
    this.onVisibilityChange = onVisibilityChange
    this.host.innerHTML = `
      <section class="gift-shop-card__dialog" role="dialog" aria-modal="true" aria-labelledby="gift-shop-card-title">
        <h2 id="gift-shop-card-title">GIFT SHOP</h2>
        <p class="gift-shop-card__message"></p>
        <div class="gift-shop-card__actions">
          <button class="gift-shop-card__open" type="button">새 탭에서 열기</button>
          <button class="gift-shop-card__close" type="button">닫기</button>
        </div>
      </section>
    `
    const closeButton = host.querySelector<HTMLButtonElement>('.gift-shop-card__close')
    const openButton = host.querySelector<HTMLButtonElement>('.gift-shop-card__open')
    const message = host.querySelector<HTMLElement>('.gift-shop-card__message')
    if (!closeButton || !openButton || !message) throw new Error('Gift shop card could not be created.')

    const isAvailable = GIFT_SHOP_URL.trim().length > 0
    message.textContent = isAvailable ? 'GIFT SHOP으로 이동합니다.' : '준비 중입니다'
    openButton.disabled = !isAvailable
    this.closeButton = closeButton
    this.openButton = openButton
    this.closeButton.addEventListener('click', this.close)
    this.openButton.addEventListener('click', this.openGiftShop)
    this.host.addEventListener('click', this.handleBackgroundClick)
  }

  open = (): void => {
    if (!this.host.hidden) return
    this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    this.host.hidden = false
    this.host.setAttribute('aria-hidden', 'false')
    this.onVisibilityChange(true)
    window.addEventListener('keydown', this.handleKeydown)
    window.requestAnimationFrame(() => (this.openButton.disabled ? this.closeButton : this.openButton).focus())
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

  private readonly openGiftShop = (): void => {
    if (!GIFT_SHOP_URL.trim()) return
    window.open(GIFT_SHOP_URL, '_blank', 'noopener,noreferrer')
    this.close()
  }

  private readonly handleBackgroundClick = (event: MouseEvent): void => {
    if (event.target === this.host) this.close()
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }
}
