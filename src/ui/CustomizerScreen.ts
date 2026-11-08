import { FrogPreview } from './FrogPreview.ts'
import { ACCESSORY_CATALOG, ACCESSORY_SLOTS, DEFAULT_FROG_CUSTOMIZATION, FROG_COLOR_VALUES, type AccessoryId, type AccessorySlot, type FrogColorId, type FrogCustomization, normalizeCustomization } from '../characters/customization/types.ts'

export type CustomizerMode = 'entry' | 'edit'

/** Inventory-like character dressing UI backed by an isolated Three.js preview. */
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
        <header class="customizer-screen__header"><p>MY VISITOR</p><h1>나만의 개구리 꾸미기</h1><span>색을 고르고 좋아하는 아이템을 착용해 보세요.</span></header>
        <div class="customizer-screen__body"><section class="customizer-inventory"></section><section class="customizer-preview"><div class="customizer-preview__canvas"></div><p>드래그하여 옆모습도 살펴보세요.</p></section></div>
        <footer class="customizer-screen__footer"><button class="customizer-reset" type="button">처음으로</button><div><button class="customizer-cancel" type="button">취소</button><button class="customizer-confirm" type="button">이 캐릭터로 입장하기</button></div></footer>
      </div>`
    this.inventoryHost = host.querySelector<HTMLElement>('.customizer-inventory')!
    this.previewHost = host.querySelector<HTMLElement>('.customizer-preview__canvas')!
    this.cancelButton = host.querySelector<HTMLButtonElement>('.customizer-cancel')!
    this.confirmButton = host.querySelector<HTMLButtonElement>('.customizer-confirm')!
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
    const colors = Object.entries(FROG_COLOR_VALUES).map(([id, item]) => `
      <button class="color-chip ${this.draft.color === id ? 'is-selected' : ''}" data-color="${id}" type="button" aria-label="${item.label}"><span style="background:${item.value}"></span><b>${item.label}</b></button>`).join('')
    const slots = ACCESSORY_SLOTS.map((slot) => {
      const cards = Object.entries(ACCESSORY_CATALOG).filter(([, item]) => item.slot === slot).map(([id, item]) => `
        <button class="inventory-card ${this.draft[slot] === id ? 'is-selected' : ''}" data-slot="${slot}" data-item="${id}" type="button"><span>${item.icon}</span><b>${item.label}</b></button>`).join('')
      return `<section class="inventory-slot"><h2>${slot.toUpperCase()}</h2><div class="inventory-slot__cards"><button class="inventory-card inventory-card--none ${this.draft[slot] === null ? 'is-selected' : ''}" data-slot="${slot}" data-item="none" type="button"><span>−</span><b>없음</b></button>${cards}</div></section>`
    }).join('')
    this.inventoryHost.innerHTML = `<section class="customizer-colors"><h2>몸 색상</h2><div>${colors}</div></section>${slots}`
  }

  private readonly onInventoryClick = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!button) return
    const color = button.dataset.color
    if (color && color in FROG_COLOR_VALUES) {
      this.updateDraft({ ...this.draft, color: color as FrogColorId })
      return
    }
    const slot = button.dataset.slot as AccessorySlot | undefined
    const item = button.dataset.item
    if (!slot || !ACCESSORY_SLOTS.includes(slot) || !item) return
    const current = this.draft[slot]
    const next = item === 'none' || current === item ? null : item as AccessoryId
    this.updateDraft({ ...this.draft, [slot]: next })
  }
}
