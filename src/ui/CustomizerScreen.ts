import { FrogPreview } from './FrogPreview.ts'
import { ACCESSORY_CATALOG, ACCESSORY_SLOTS, DEFAULT_FROG_CUSTOMIZATION, FROG_COLOR_VALUES, normalizeCustomization, takeOffAccessory, wearAccessory, type AccessoryId, type FrogColorId, type FrogCustomization } from '../characters/customization/types.ts'

export type CustomizerMode = 'entry' | 'edit'

/**
 * 캐릭터 꾸미기 화면. 아이템 카드는 눌러서 켜고 끈다 (여러 개 함께 착용 가능).
 * 함께 못 쓰는 아이템을 고르면 원래 쓰던 것을 벗기고 짧게 알려준다.
 */
export class CustomizerScreen {
  private draft: FrogCustomization = { ...DEFAULT_FROG_CUSTOMIZATION }
  private readonly host: HTMLElement
  private readonly onCancel: () => void
  private readonly onConfirm: (customization: FrogCustomization) => void
  private readonly previewHost: HTMLElement
  private preview: FrogPreview | undefined
  private readonly inventoryHost: HTMLElement
  private readonly cancelButton: HTMLButtonElement
  private readonly confirmButton: HTMLButtonElement
  private readonly notice: HTMLElement
  private noticeTimer: number | undefined

  constructor(
    host: HTMLElement,
    onConfirm: (customization: FrogCustomization) => void,
    onCancel: () => void,
  ) {
    this.host = host
    this.onConfirm = onConfirm
    this.onCancel = onCancel
    host.innerHTML = `
      <div class="customizer-screen__panel">
        <header class="customizer-screen__header"><p>MY VISITOR</p><h1>나만의 깨북이 꾸미기</h1><span>색을 고르고 좋아하는 아이템을 여러 개 함께 착용해 보세요.</span></header>
        <div class="customizer-screen__body"><section class="customizer-inventory"></section><section class="customizer-preview"><div class="customizer-preview__canvas"><p class="customizer-notice" role="status" hidden></p></div><p>드래그해서 위아래, 옆모습까지 둘러보세요.</p></section></div>
        <footer class="customizer-screen__footer"><button class="customizer-reset" type="button">처음으로</button><div><button class="customizer-cancel" type="button">취소</button><button class="customizer-confirm" type="button">이 캐릭터로 입장하기</button></div></footer>
      </div>`
    this.inventoryHost = host.querySelector<HTMLElement>('.customizer-inventory')!
    this.previewHost = host.querySelector<HTMLElement>('.customizer-preview__canvas')!
    this.cancelButton = host.querySelector<HTMLButtonElement>('.customizer-cancel')!
    this.confirmButton = host.querySelector<HTMLButtonElement>('.customizer-confirm')!
    this.notice = host.querySelector<HTMLElement>('.customizer-notice')!
    this.inventoryHost.addEventListener('click', this.onInventoryClick)
    host.querySelector<HTMLButtonElement>('.customizer-reset')!.addEventListener('click', () => this.updateDraft({ ...DEFAULT_FROG_CUSTOMIZATION }))
    this.cancelButton.addEventListener('click', () => { this.close(); this.onCancel() })
    this.confirmButton.addEventListener('click', () => { const state = { ...this.draft }; this.close(); this.onConfirm(state) })
  }

  open(mode: CustomizerMode, customization: FrogCustomization): void {
    this.draft = normalizeCustomization(customization)
    this.host.hidden = false
    this.cancelButton.hidden = mode === 'entry'
    this.confirmButton.textContent = mode === 'entry' ? '이 캐릭터로 입장하기' : '적용하기'
    this.renderInventory()
    this.preview = new FrogPreview(this.previewHost, this.draft)
  }

  close(): void {
    this.hideNotice()
    this.preview?.dispose()
    this.preview = undefined
    this.host.hidden = true
  }

  private updateDraft(next: FrogCustomization): void {
    this.draft = normalizeCustomization(next)
    this.preview?.setCustomization(this.draft)
    this.renderInventory()
  }

  private renderInventory(): void {
    const worn = new Set(this.draft.accessories)
    const colors = Object.entries(FROG_COLOR_VALUES).map(([id, item]) => `
      <button class="color-chip ${this.draft.color === id ? 'is-selected' : ''}" data-color="${id}" type="button" aria-label="${item.label}" title="${item.label}"><span style="background:${item.value}"></span></button>`).join('')
    const slots = ACCESSORY_SLOTS.map((slot) => {
      const cards = Object.entries(ACCESSORY_CATALOG).filter(([, item]) => item.slot === slot).map(([id, item]) => {
        const isWorn = worn.has(id as AccessoryId)
        return `
        <button class="inventory-card ${isWorn ? 'is-selected' : ''}" data-item="${id}" type="button" aria-pressed="${isWorn}"><span>${item.icon}</span><b>${item.label}</b></button>`
      }).join('')
      return `<section class="inventory-slot"><h2>${slot.toUpperCase()}</h2><div class="inventory-slot__cards inventory-slot__cards--three">${cards}</div></section>`
    }).join('')
    const count = this.draft.accessories.length
    this.inventoryHost.innerHTML = `<section class="customizer-colors"><h2>몸 색상</h2><div>${colors}</div></section>
      <div class="inventory-summary"><span>착용 중 <b>${count}</b>개</span><button class="inventory-clear" type="button" data-action="clear" ${count === 0 ? 'disabled' : ''}>모두 벗기</button></div>${slots}`
  }

  private readonly onInventoryClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button) return
    const color = button.dataset.color
    if (color && color in FROG_COLOR_VALUES) {
      this.updateDraft({ ...this.draft, color: color as FrogColorId })
      return
    }
    if (button.dataset.action === 'clear') {
      this.updateDraft({ ...this.draft, accessories: [] })
      return
    }
    const item = button.dataset.item
    if (!item || !(item in ACCESSORY_CATALOG)) return
    const id = item as AccessoryId
    if (this.draft.accessories.includes(id)) {
      this.updateDraft(takeOffAccessory(this.draft, id))
      return
    }
    const { next, removed } = wearAccessory(this.draft, id)
    this.updateDraft(next)
    if (removed.length > 0) {
      const removedNames = removed.map((other) => ACCESSORY_CATALOG[other].label)
      this.showNotice(`${withObjectParticle(removedNames.join(', '))} 벗고 ${withObjectParticle(ACCESSORY_CATALOG[id].label)} 착용했어요`)
    }
  }

  /** 미리보기 위쪽에 잠깐 띄우는 안내 (함께 못 쓰는 아이템을 바꿨을 때) */
  private showNotice(message: string): void {
    this.notice.textContent = message
    this.notice.hidden = false
    window.clearTimeout(this.noticeTimer)
    this.noticeTimer = window.setTimeout(() => this.hideNotice(), 2600)
  }

  private hideNotice(): void {
    window.clearTimeout(this.noticeTimer)
    this.notice.hidden = true
  }
}

/** 받침 있는 글자로 끝나면 '을', 아니면 '를' (예: 책을, 캡모자를) */
function withObjectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasFinalConsonant = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${word}${hasFinalConsonant ? '을' : '를'}`
}
