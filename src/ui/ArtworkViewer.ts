import type { ArtworkConfig } from '../scenes/exhibition/artworks/types.ts'
import { publicAsset } from '../config/publicAsset.ts'

/** DOM-only detail viewer, intentionally separate from Three.js interaction. */
export class ArtworkViewer {
  private readonly closeButton: HTMLButtonElement
  private dragPointerId: number | undefined
  private readonly host: HTMLElement
  private readonly image: HTMLImageElement
  private lastDragPosition: { x: number; y: number } | undefined
  private readonly message: HTMLElement
  private readonly onVisibilityChange: (isVisible: boolean) => void
  private panX = 0
  private panY = 0
  private previouslyFocused: HTMLElement | undefined
  private readonly resetButton: HTMLButtonElement
  private readonly stage: HTMLElement
  private readonly title: HTMLElement
  private zoom = 1

  constructor(host: HTMLElement, onVisibilityChange: (isVisible: boolean) => void) {
    this.host = host
    this.onVisibilityChange = onVisibilityChange
    this.host.innerHTML = `
      <section class="artwork-viewer__dialog" role="dialog" aria-modal="true" aria-labelledby="artwork-viewer-title">
        <button class="artwork-viewer__close" type="button" aria-label="작품 감상 닫기">×</button>
        <div class="artwork-viewer__stage">
          <img class="artwork-viewer__image" draggable="false" alt="">
          <p class="artwork-viewer__message" hidden>이미지를 불러오지 못했습니다</p>
        </div>
        <div class="artwork-viewer__details">
          <div><h2 id="artwork-viewer-title"></h2><p class="artwork-viewer__artist"></p></div>
          <p class="artwork-viewer__comment"></p>
          <button class="artwork-viewer__reset" type="button">원래 크기</button>
        </div>
      </section>
    `

    const closeButton = host.querySelector<HTMLButtonElement>('.artwork-viewer__close')
    const image = host.querySelector<HTMLImageElement>('.artwork-viewer__image')
    const message = host.querySelector<HTMLElement>('.artwork-viewer__message')
    const resetButton = host.querySelector<HTMLButtonElement>('.artwork-viewer__reset')
    const stage = host.querySelector<HTMLElement>('.artwork-viewer__stage')
    const title = host.querySelector<HTMLElement>('#artwork-viewer-title')
    if (!closeButton || !image || !message || !resetButton || !stage || !title) {
      throw new Error('Artwork viewer could not be created.')
    }

    this.closeButton = closeButton
    this.image = image
    this.message = message
    this.resetButton = resetButton
    this.stage = stage
    this.title = title
    this.closeButton.addEventListener('click', this.close)
    this.resetButton.addEventListener('click', this.resetView)
    this.host.addEventListener('click', this.handleBackgroundClick)
    this.image.addEventListener('load', this.handleImageLoad)
    this.image.addEventListener('error', this.handleImageError)
    this.stage.addEventListener('wheel', this.handleWheel, { passive: false })
    this.stage.addEventListener('pointerdown', this.startDrag)
    this.stage.addEventListener('pointermove', this.moveDrag)
    this.stage.addEventListener('pointerup', this.endDrag)
    this.stage.addEventListener('pointercancel', this.endDrag)
    this.stage.addEventListener('dblclick', this.resetView)
  }

  open(artwork: ArtworkConfig): void {
    if (this.host.hidden) {
      this.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
      this.host.hidden = false
      this.host.setAttribute('aria-hidden', 'false')
      this.onVisibilityChange(true)
      window.addEventListener('keydown', this.handleKeydown)
    }

    this.title.textContent = artwork.title
    this.host.querySelector<HTMLElement>('.artwork-viewer__artist')!.textContent = artwork.artist
    this.host.querySelector<HTMLElement>('.artwork-viewer__comment')!.textContent = artwork.comment ?? '작품에 대한 추가 설명이 없습니다.'
    this.image.alt = `${artwork.title} — ${artwork.artist}`
    this.image.hidden = false
    this.message.hidden = true
    this.resetView()
    this.image.src = publicAsset(artwork.imageUrl)
    window.requestAnimationFrame(() => this.closeButton.focus())
  }

  close = (): void => {
    if (this.host.hidden) return
    window.removeEventListener('keydown', this.handleKeydown)
    this.host.hidden = true
    this.host.setAttribute('aria-hidden', 'true')
    this.resetView()
    this.onVisibilityChange(false)
    this.previouslyFocused?.focus()
    this.previouslyFocused = undefined
  }

  private readonly handleBackgroundClick = (event: MouseEvent): void => {
    if (event.target === this.host) this.close()
  }

  private readonly handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }

  private readonly handleImageLoad = (): void => {
    this.message.hidden = true
    this.image.hidden = false
    this.resetView()
  }

  private readonly handleImageError = (): void => {
    this.image.hidden = true
    this.message.hidden = false
    this.resetView()
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    if (this.image.hidden) return
    const nextZoom = this.clamp(this.zoom * Math.exp(-event.deltaY * 0.0015), 1, 4)
    this.setZoom(nextZoom, { x: event.clientX, y: event.clientY })
  }

  private readonly startDrag = (event: PointerEvent): void => {
    if (this.zoom <= 1 || this.image.hidden) return
    this.dragPointerId = event.pointerId
    this.lastDragPosition = { x: event.clientX, y: event.clientY }
    this.stage.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  private readonly moveDrag = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId || !this.lastDragPosition) return
    this.panX += event.clientX - this.lastDragPosition.x
    this.panY += event.clientY - this.lastDragPosition.y
    this.lastDragPosition = { x: event.clientX, y: event.clientY }
    this.clampPan()
    this.applyTransform()
  }

  private readonly endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== this.dragPointerId) return
    if (this.stage.hasPointerCapture(event.pointerId)) this.stage.releasePointerCapture(event.pointerId)
    this.dragPointerId = undefined
    this.lastDragPosition = undefined
  }

  private readonly resetView = (): void => {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.applyTransform()
  }

  private setZoom(nextZoom: number, pointer: { x: number; y: number }): void {
    const bounds = this.stage.getBoundingClientRect()
    const offsetX = pointer.x - bounds.left - bounds.width / 2
    const offsetY = pointer.y - bounds.top - bounds.height / 2
    const zoomRatio = nextZoom / this.zoom
    this.panX = offsetX - (offsetX - this.panX) * zoomRatio
    this.panY = offsetY - (offsetY - this.panY) * zoomRatio
    this.zoom = nextZoom
    this.clampPan()
    this.applyTransform()
  }

  private clampPan(): void {
    const maximumX = Math.max(0, (this.image.offsetWidth * this.zoom - this.stage.clientWidth) / 2)
    const maximumY = Math.max(0, (this.image.offsetHeight * this.zoom - this.stage.clientHeight) / 2)
    this.panX = this.clamp(this.panX, -maximumX, maximumX)
    this.panY = this.clamp(this.panY, -maximumY, maximumY)
  }

  private applyTransform(): void {
    this.image.style.transform = `translate(-50%, -50%) translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value))
  }
}
