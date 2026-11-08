import type { ExhibitionRoomDefinition } from '../rooms/types.ts'
import { formatOccupancy, type OccupancyProvider } from '../services/occupancy.ts'

interface RoomSwitcherCallbacks {
  onSelect: (roomId: string) => void
}

/** Accessible room menu, kept independent from Three.js scene lifetime. */
export class RoomSwitcher {
  private readonly button: HTMLButtonElement
  private currentRoomId: string | undefined
  private readonly host: HTMLElement
  private readonly menu: HTMLElement
  private readonly occupancyProvider: OccupancyProvider
  private readonly onSelect: (roomId: string) => void
  private readonly rooms: readonly ExhibitionRoomDefinition[]
  private readonly unsubscribe: () => void

  constructor(
    host: HTMLElement,
    rooms: readonly ExhibitionRoomDefinition[],
    occupancyProvider: OccupancyProvider,
    callbacks: RoomSwitcherCallbacks,
  ) {
    this.host = host
    this.rooms = rooms
    this.occupancyProvider = occupancyProvider
    this.onSelect = callbacks.onSelect
    this.host.innerHTML = `
      <button class="room-switcher__toggle" type="button" aria-haspopup="menu" aria-expanded="false">다른 전시실로 이동하기</button>
      <div class="room-switcher__menu" role="menu" aria-label="다른 전시실로 이동하기" hidden></div>
    `
    const button = host.querySelector<HTMLButtonElement>('.room-switcher__toggle')
    const menu = host.querySelector<HTMLElement>('.room-switcher__menu')
    if (!button || !menu) throw new Error('Room switcher could not be created.')
    this.button = button
    this.menu = menu
    this.button.addEventListener('click', this.toggle)
    this.button.addEventListener('keydown', this.handleButtonKeydown)
    this.menu.addEventListener('keydown', this.handleMenuKeydown)
    this.host.addEventListener('pointerdown', this.stopSceneEvent)
    this.host.addEventListener('pointermove', this.stopSceneEvent)
    this.host.addEventListener('pointerup', this.stopSceneEvent)
    this.host.addEventListener('wheel', this.stopSceneEvent, { passive: false })
    this.unsubscribe = occupancyProvider.subscribe(this.render)
    this.render()
  }

  show(currentRoomId: string): void {
    this.currentRoomId = currentRoomId
    this.host.hidden = false
    this.render()
  }

  hide = (): void => {
    this.close(false)
    this.host.hidden = true
  }

  dispose(): void {
    this.close(false)
    this.unsubscribe()
    this.button.removeEventListener('click', this.toggle)
    this.button.removeEventListener('keydown', this.handleButtonKeydown)
    this.menu.removeEventListener('keydown', this.handleMenuKeydown)
    this.host.removeEventListener('pointerdown', this.stopSceneEvent)
    this.host.removeEventListener('pointermove', this.stopSceneEvent)
    this.host.removeEventListener('pointerup', this.stopSceneEvent)
    this.host.removeEventListener('wheel', this.stopSceneEvent)
    this.host.replaceChildren()
  }

  private readonly render = (): void => {
    const activeElement = document.activeElement
    this.menu.replaceChildren(...this.rooms.map((room) => {
      const isCurrent = room.id === this.currentRoomId
      const item = document.createElement('button')
      item.className = 'room-switcher__item'
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.dataset.roomId = room.id
      item.disabled = isCurrent
      item.setAttribute('aria-current', isCurrent ? 'true' : 'false')
      const count = this.occupancyProvider.getCount(room.id)
      item.textContent = count === null ? room.displayName : `${room.displayName} · ${formatOccupancy(count)}`
      if (isCurrent) {
        const current = document.createElement('span')
        current.className = 'room-switcher__current'
        current.textContent = '현재'
        item.append(' ', current)
      }
      item.addEventListener('click', () => {
        if (item.disabled) return
        this.close(false)
        this.onSelect(room.id)
      })
      return item
    }))
    if (activeElement instanceof HTMLElement && activeElement.dataset.roomId) {
      this.menu.querySelector<HTMLElement>(`[data-room-id="${activeElement.dataset.roomId}"]`)?.focus()
    }
  }

  private readonly toggle = (): void => {
    if (this.menu.hidden) this.open()
    else this.close(true)
  }

  private open(): void {
    this.render()
    this.menu.hidden = false
    this.button.setAttribute('aria-expanded', 'true')
    document.addEventListener('pointerdown', this.handleOutsidePointer, true)
    window.addEventListener('keydown', this.handleWindowKeydown)
  }

  private close(restoreFocus: boolean): void {
    if (this.menu.hidden) return
    this.menu.hidden = true
    this.button.setAttribute('aria-expanded', 'false')
    document.removeEventListener('pointerdown', this.handleOutsidePointer, true)
    window.removeEventListener('keydown', this.handleWindowKeydown)
    if (restoreFocus) this.button.focus()
  }

  private readonly handleOutsidePointer = (event: PointerEvent): void => {
    if (!this.host.contains(event.target as Node)) this.close(true)
  }

  private readonly handleWindowKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      this.close(true)
    }
  }

  private readonly handleButtonKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (this.menu.hidden) this.open()
    this.focusItem(event.key === 'ArrowDown' ? 0 : -1)
  }

  private readonly handleMenuKeydown = (event: KeyboardEvent): void => {
    const items = this.enabledItems
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + direction + items.length) % items.length
      items[nextIndex].focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      this.focusItem(event.key === 'Home' ? 0 : -1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.close(true)
    }
  }

  private get enabledItems(): HTMLButtonElement[] {
    return [...this.menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')]
  }

  private focusItem(index: number): void {
    const items = this.enabledItems
    if (items.length === 0) return
    items[index < 0 ? items.length - 1 : index]?.focus()
  }

  private readonly stopSceneEvent = (event: Event): void => {
    event.stopPropagation()
    if (event.type === 'wheel') event.preventDefault()
  }
}
