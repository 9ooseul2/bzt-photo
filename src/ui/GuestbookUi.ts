import type { GuestbookColor, GuestbookEntry } from '../guestbook/types.ts'

interface GuestbookUiElements {
  galleryButton: HTMLButtonElement
  modalHost: HTMLElement
  returnButton: HTMLButtonElement
  toastHost: HTMLElement
  writeButton: HTMLButtonElement
}

interface GuestbookUiCallbacks {
  onEnter: () => void
  onLeave: () => void
  onModalVisibility: (isVisible: boolean) => void
  onSubmit: (message: string, color: GuestbookColor) => boolean
}

/** DOM-only guestbook controls and modals, intentionally separate from Three.js scenes. */
export class GuestbookUi {
  private readonly callbacks: GuestbookUiCallbacks
  private readonly elements: GuestbookUiElements
  private escapeHandler: ((event: KeyboardEvent) => void) | undefined
  private toastTimeout: number | undefined

  constructor(elements: GuestbookUiElements, callbacks: GuestbookUiCallbacks) {
    this.elements = elements
    this.callbacks = callbacks
    elements.galleryButton.addEventListener('click', callbacks.onEnter)
    elements.returnButton.addEventListener('click', callbacks.onLeave)
    elements.writeButton.addEventListener('click', () => this.showWrite())
  }

  showGalleryControls(): void {
    this.close()
    this.elements.galleryButton.hidden = false
    this.elements.returnButton.hidden = true
    this.elements.writeButton.hidden = true
  }

  showGuestbookControls(): void {
    this.close()
    this.elements.galleryButton.hidden = true
    this.elements.returnButton.hidden = false
    this.elements.writeButton.hidden = false
  }

  showRead(entry: GuestbookEntry): void {
    this.openModal()
    const color = this.getColor(entry.color)
    this.elements.modalHost.innerHTML = `
      <div class="guestbook-modal__backdrop"></div>
      <article class="guestbook-note" role="dialog" aria-modal="true" aria-labelledby="guestbook-read-title" style="--note-color:${color}">
        <button class="guestbook-note__close" type="button" aria-label="방명록 닫기">×</button>
        <p class="guestbook-note__name" id="guestbook-read-title"></p>
        <p class="guestbook-note__message"></p>
        <time class="guestbook-note__date"></time>
      </article>`
    this.elements.modalHost.querySelector<HTMLElement>('.guestbook-note__name')!.textContent = entry.nickname
    this.elements.modalHost.querySelector<HTMLElement>('.guestbook-note__message')!.textContent = entry.message
    const date = new Date(entry.createdAt)
    this.elements.modalHost.querySelector<HTMLTimeElement>('.guestbook-note__date')!.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR')
    this.bindClose()
  }

  showWrite(): void {
    this.openModal()
    this.elements.modalHost.innerHTML = `
      <div class="guestbook-modal__backdrop"></div>
      <form class="guestbook-note guestbook-note--write" role="dialog" aria-modal="true" aria-labelledby="guestbook-write-title">
        <button class="guestbook-note__close" type="button" aria-label="작성 창 닫기">×</button>
        <h2 id="guestbook-write-title">방명록 남기기</h2>
        <p class="guestbook-note__author"></p>
        <label class="guestbook-note__label" for="guestbook-message">메시지</label>
        <textarea id="guestbook-message" maxlength="200" placeholder="전시에 남기고 싶은 마음을 적어주세요."></textarea>
        <p class="guestbook-note__count">0 / 200</p>
        <fieldset class="guestbook-note__colors"><legend>포스트잇 색상</legend>
          <label><input type="radio" name="guestbook-color" value="butter" checked><span class="color-swatch color-swatch--butter"></span></label>
          <label><input type="radio" name="guestbook-color" value="pink"><span class="color-swatch color-swatch--pink"></span></label>
          <label><input type="radio" name="guestbook-color" value="sage"><span class="color-swatch color-swatch--sage"></span></label>
          <label><input type="radio" name="guestbook-color" value="lavender"><span class="color-swatch color-swatch--lavender"></span></label>
        </fieldset>
        <div class="guestbook-note__actions"><button class="guestbook-note__cancel" type="button">취소</button><button class="guestbook-note__submit" type="submit">등록</button></div>
      </form>`
    const author = this.elements.modalHost.querySelector<HTMLElement>('.guestbook-note__author')
    if (author) author.textContent = `작성자 · ${this.nickname}`
    const textarea = this.elements.modalHost.querySelector<HTMLTextAreaElement>('textarea')!
    const count = this.elements.modalHost.querySelector<HTMLElement>('.guestbook-note__count')!
    textarea.addEventListener('input', () => { count.textContent = `${textarea.value.length} / 200` })
    this.elements.modalHost.querySelector<HTMLFormElement>('form')!.addEventListener('submit', (event) => {
      event.preventDefault()
      const message = textarea.value.trim()
      const color = this.elements.modalHost.querySelector<HTMLInputElement>('input[name="guestbook-color"]:checked')?.value
      if (!message || !this.isColor(color)) return
      const button = this.elements.modalHost.querySelector<HTMLButtonElement>('.guestbook-note__submit')!
      button.disabled = true
      if (this.callbacks.onSubmit(message, color)) this.close()
      else button.disabled = false
    })
    this.bindClose()
    window.requestAnimationFrame(() => textarea.focus())
  }

  setNickname(nickname: string): void { this.nickname = nickname }
  private nickname = ''

  toast(message: string): void {
    if (this.toastTimeout !== undefined) window.clearTimeout(this.toastTimeout)
    this.elements.toastHost.textContent = message
    this.elements.toastHost.hidden = false
    this.toastTimeout = window.setTimeout(() => { this.elements.toastHost.hidden = true }, 3200)
  }

  close = (): void => {
    if (this.escapeHandler) window.removeEventListener('keydown', this.escapeHandler)
    this.escapeHandler = undefined
    this.elements.modalHost.hidden = true
    this.elements.modalHost.replaceChildren()
    this.callbacks.onModalVisibility(false)
  }

  private openModal(): void {
    this.elements.modalHost.hidden = false
    this.callbacks.onModalVisibility(true)
    this.escapeHandler = (event) => { if (event.key === 'Escape') this.close() }
    window.addEventListener('keydown', this.escapeHandler)
  }

  private bindClose(): void {
    this.elements.modalHost.querySelector('.guestbook-note__close')?.addEventListener('click', this.close)
    this.elements.modalHost.querySelector('.guestbook-note__cancel')?.addEventListener('click', this.close)
    this.elements.modalHost.querySelector('.guestbook-modal__backdrop')?.addEventListener('click', this.close)
  }

  private isColor(value: string | undefined): value is GuestbookColor {
    return value === 'butter' || value === 'pink' || value === 'sage' || value === 'lavender'
  }

  private getColor(color: GuestbookColor): string {
    return { butter: '#f7df88', pink: '#eeb4bd', sage: '#b8cda8', lavender: '#c9c0e1' }[color]
  }
}
