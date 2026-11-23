import { DEFAULT_FROG_CUSTOMIZATION, type FrogCustomization } from '../characters/customization/types.ts'
import { GUESTBOOK_COLOR_VALUES, GUESTBOOK_COLORS, type GuestbookColor, type GuestbookEntry } from '../guestbook/types.ts'
import { FrogPreview } from './FrogPreview.ts'

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
  onSubmit: (message: string, color: GuestbookColor) => Promise<boolean>
  /** 지금 내 개구리 모습 (글쓰기 카드의 폴라로이드에 보여 준다) */
  getAppearance: () => FrogCustomization
}

const MESSAGE_LIMIT = 200
/** 글쓰기 카드는 고정된 작은 기울기 */
const WRITE_CARD_TILT = 0.8
const WRITE_PHOTO_TILT = -1.5

/**
 * 방명록 카드 (읽기·쓰기). 흰 메모 카드 위에 메모 색 마스킹테이프, 손글씨 닉네임과 메시지,
 * 그리고 그 글을 쓸 때의 개구리가 담긴 폴라로이드. Three.js 장면과는 따로 DOM으로 그린다.
 */
export class GuestbookUi {
  private readonly callbacks: GuestbookUiCallbacks
  private readonly elements: GuestbookUiElements
  private escapeHandler: ((event: KeyboardEvent) => void) | undefined
  private toastTimeout: number | undefined
  /** 폴라로이드 속 3D 개구리. 한 번에 하나만 그린다. */
  private preview: FrogPreview | undefined
  /** 카드를 열기 전에 포커스가 있던 곳 (닫으면 돌아간다) */
  private returnFocus: HTMLElement | undefined

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

  /**
   * 글 읽기 카드. onDelete를 넘기면(내가 쓴 글) 삭제 버튼이 보인다.
   * 실수로 지우지 않도록 한 번 누르면 "정말 지울까요?"로 바뀌고, 한 번 더 눌러야 지워진다.
   */
  showRead(entry: GuestbookEntry, onDelete?: () => Promise<boolean>): void {
    this.openModal()
    this.elements.modalHost.innerHTML = `
      <div class="guestbook-modal__backdrop"></div>
      <article class="guestbook-card" role="dialog" aria-modal="true" aria-labelledby="guestbook-card-name">
        <span class="guestbook-card__tape" aria-hidden="true"></span>
        <button class="guestbook-card__close" type="button" aria-label="방명록 닫기">×</button>
        <header class="guestbook-card__head">
          <span class="guestbook-card__label" aria-hidden="true">NAME</span>
          <h2 class="guestbook-card__name" id="guestbook-card-name"></h2>
          <time class="guestbook-card__date"></time>
        </header>
        <p class="guestbook-card__message"></p>
        <figure class="guestbook-card__photo" role="img"><div class="guestbook-card__frog"></div></figure>
        ${onDelete ? '<button class="guestbook-card__delete" type="button">내 글 삭제</button>' : ''}
      </article>`
    const card = this.query<HTMLElement>('.guestbook-card')
    this.styleCard(card, entry.color, tiltFromId(entry.id, 'card', 2), tiltFromId(entry.id, 'photo', 3))
    this.query<HTMLElement>('.guestbook-card__name').textContent = entry.nickname
    this.query<HTMLElement>('.guestbook-card__message').textContent = entry.message
    const date = new Date(entry.createdAt)
    const time = this.query<HTMLTimeElement>('.guestbook-card__date')
    if (!Number.isNaN(date.getTime())) {
      time.dateTime = date.toISOString()
      time.textContent = formatDate(date)
    }
    this.showFrog(entry.nickname, entry.appearance ?? DEFAULT_FROG_CUSTOMIZATION)

    const deleteButton = this.elements.modalHost.querySelector<HTMLButtonElement>('.guestbook-card__delete')
    if (deleteButton && onDelete) {
      let armed = false
      deleteButton.addEventListener('click', () => {
        if (!armed) {
          armed = true
          deleteButton.textContent = '정말 지울까요? 한 번 더 누르면 삭제돼요'
          deleteButton.classList.add('is-armed')
          return
        }
        deleteButton.disabled = true
        deleteButton.textContent = '지우는 중...'
        void onDelete().then((ok) => {
          if (ok) {
            this.close()
            return
          }
          deleteButton.disabled = false
          armed = false
          deleteButton.classList.remove('is-armed')
          deleteButton.textContent = '내 글 삭제'
        })
      })
    }
    this.bindClose()
    window.requestAnimationFrame(() => this.elements.modalHost.querySelector<HTMLElement>('.guestbook-card__close')?.focus())
  }

  /** 글쓰기 카드. 폴라로이드에는 지금 내 개구리가 보이고, 메모 색을 고르면 테이프 색이 바로 바뀐다. */
  showWrite(): void {
    this.openModal()
    const swatches = GUESTBOOK_COLORS.map((color, index) => `
          <label class="guestbook-card__swatch" title="${GUESTBOOK_COLOR_VALUES[color].label}">
            <input type="radio" name="guestbook-color" value="${color}" ${index === 0 ? 'checked' : ''} aria-label="${GUESTBOOK_COLOR_VALUES[color].label}">
            <span style="--tape:${GUESTBOOK_COLOR_VALUES[color].value}"></span>
          </label>`).join('')
    this.elements.modalHost.innerHTML = `
      <div class="guestbook-modal__backdrop"></div>
      <form class="guestbook-card guestbook-card--write" role="dialog" aria-modal="true" aria-labelledby="guestbook-write-title">
        <span class="guestbook-card__tape" aria-hidden="true"></span>
        <button class="guestbook-card__close" type="button" aria-label="작성 창 닫기">×</button>
        <h2 class="guestbook-card__sr-only" id="guestbook-write-title">방명록 남기기</h2>
        <header class="guestbook-card__head">
          <span class="guestbook-card__label" aria-hidden="true">NAME</span>
          <p class="guestbook-card__name"></p>
          <time class="guestbook-card__date"></time>
        </header>
        <label class="guestbook-card__sr-only" for="guestbook-message">메시지</label>
        <textarea class="guestbook-card__message guestbook-card__input" id="guestbook-message" maxlength="${MESSAGE_LIMIT}" placeholder="남기고 싶은 말을 적어 주세요"></textarea>
        <p class="guestbook-card__count" aria-live="polite">0 / ${MESSAGE_LIMIT}</p>
        <figure class="guestbook-card__photo" role="img"><div class="guestbook-card__frog"></div></figure>
        <fieldset class="guestbook-card__colors"><legend>메모 색</legend>${swatches}</fieldset>
        <div class="guestbook-card__actions"><button class="guestbook-card__cancel" type="button">취소</button><button class="guestbook-card__submit" type="submit">등록</button></div>
      </form>`
    const card = this.query<HTMLFormElement>('.guestbook-card')
    this.styleCard(card, GUESTBOOK_COLORS[0], WRITE_CARD_TILT, WRITE_PHOTO_TILT)
    this.query<HTMLElement>('.guestbook-card__name').textContent = this.nickname
    const today = new Date()
    const time = this.query<HTMLTimeElement>('.guestbook-card__date')
    time.dateTime = today.toISOString()
    time.textContent = formatDate(today)
    this.showFrog(this.nickname, this.callbacks.getAppearance())

    const textarea = this.query<HTMLTextAreaElement>('textarea')
    const count = this.query<HTMLElement>('.guestbook-card__count')
    textarea.addEventListener('input', () => { count.textContent = `${textarea.value.length} / ${MESSAGE_LIMIT}` })
    // 메모 색을 고르면 카드 위 테이프 색이 바로 바뀐다
    card.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement
      if (input.name === 'guestbook-color' && this.isColor(input.value)) {
        card.style.setProperty('--tape', GUESTBOOK_COLOR_VALUES[input.value].value)
      }
    })
    card.addEventListener('submit', (event) => {
      event.preventDefault()
      const message = textarea.value.trim()
      const color = this.elements.modalHost.querySelector<HTMLInputElement>('input[name="guestbook-color"]:checked')?.value
      if (!message || !this.isColor(color)) return
      const button = this.query<HTMLButtonElement>('.guestbook-card__submit')
      button.disabled = true
      void this.callbacks.onSubmit(message, color).then((ok) => {
        if (ok) this.close()
        else button.disabled = false
      })
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
    const wasOpen = !this.elements.modalHost.hidden
    if (this.escapeHandler) window.removeEventListener('keydown', this.escapeHandler)
    this.escapeHandler = undefined
    this.disposePreview()
    this.elements.modalHost.hidden = true
    this.elements.modalHost.replaceChildren()
    this.callbacks.onModalVisibility(false)
    if (wasOpen && this.returnFocus?.isConnected) this.returnFocus.focus()
    this.returnFocus = undefined
  }

  private openModal(): void {
    // 다른 카드가 열려 있었다면 그 카드의 개구리와 키 처리부터 정리한다
    if (this.escapeHandler) window.removeEventListener('keydown', this.escapeHandler)
    this.disposePreview()
    if (this.elements.modalHost.hidden) {
      const active = document.activeElement
      this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : undefined
    }
    this.elements.modalHost.hidden = false
    this.callbacks.onModalVisibility(true)
    this.escapeHandler = (event) => { if (event.key === 'Escape') this.close() }
    window.addEventListener('keydown', this.escapeHandler)
  }

  /** 테이프 색과 카드·사진 기울기 */
  private styleCard(card: HTMLElement, color: GuestbookColor, cardTilt: number, photoTilt: number): void {
    card.style.setProperty('--tape', GUESTBOOK_COLOR_VALUES[color].value)
    card.style.setProperty('--card-tilt', `${cardTilt.toFixed(2)}deg`)
    card.style.setProperty('--photo-tilt', `${photoTilt.toFixed(2)}deg`)
  }

  /** 폴라로이드 속 개구리. 드래그 없이 정면을 보고 천천히 좌우로 살짝 돈다. */
  private showFrog(nickname: string, appearance: FrogCustomization): void {
    this.query<HTMLElement>('.guestbook-card__photo').setAttribute('aria-label', `${nickname}의 개구리`)
    this.disposePreview()
    this.preview = new FrogPreview(this.query<HTMLElement>('.guestbook-card__frog'), appearance, { interactive: false, motion: 'polaroid' })
  }

  private disposePreview(): void {
    this.preview?.dispose()
    this.preview = undefined
  }

  private bindClose(): void {
    this.elements.modalHost.querySelector('.guestbook-card__close')?.addEventListener('click', this.close)
    this.elements.modalHost.querySelector('.guestbook-card__cancel')?.addEventListener('click', this.close)
    this.elements.modalHost.querySelector('.guestbook-modal__backdrop')?.addEventListener('click', this.close)
  }

  private query<T extends Element>(selector: string): T {
    return this.elements.modalHost.querySelector<T>(selector)!
  }

  private isColor(value: string | undefined): value is GuestbookColor {
    return GUESTBOOK_COLORS.includes(value as GuestbookColor)
  }
}

/**
 * 글 id로 정하는 기울기 (-max°~+max°). 글마다 조금씩 다르지만 같은 글은 항상 같다.
 * salt로 카드와 사진이 서로 다른 값을 갖게 한다.
 */
function tiltFromId(id: string, salt: string, max: number): number {
  let hash = 2166136261
  for (const char of `${salt}:${id}`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const unit = (hash >>> 0) / 0xffffffff // 0 ~ 1
  return (unit * 2 - 1) * max
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
