import { isEmotionType, type EmotionType } from '../user/EmotionState.ts'

/** Local picker UI. It only emits an emotion choice and owns no visitor state. */
export class EmotionPicker {
  private readonly host: HTMLElement
  private readonly menu: HTMLElement
  private readonly onSelect: (emotion: EmotionType) => void
  private readonly toggleButton: HTMLButtonElement

  constructor(host: HTMLElement, onSelect: (emotion: EmotionType) => void) {
    const menu = host.querySelector<HTMLElement>('.emotion-control__menu')
    const toggleButton = host.querySelector<HTMLButtonElement>('.emotion-control__toggle')

    if (!menu || !toggleButton) {
      throw new Error('Emotion picker could not be created.')
    }

    this.host = host
    this.menu = menu
    this.onSelect = onSelect
    this.toggleButton = toggleButton
    this.toggleButton.addEventListener('click', this.toggle)
    this.menu.addEventListener('click', this.selectEmotion)
  }

  show(): void {
    this.host.hidden = false
  }

  hide(): void {
    this.close()
    this.host.hidden = true
  }

  close(): void {
    this.menu.hidden = true
    this.toggleButton.setAttribute('aria-expanded', 'false')
  }

  private readonly toggle = (): void => {
    const isOpening = this.menu.hidden
    this.menu.hidden = !isOpening
    this.toggleButton.setAttribute('aria-expanded', String(isOpening))
  }

  private readonly selectEmotion = (event: MouseEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLButtonElement)) {
      return
    }

    const emotion = target.dataset.emotion
    if (!emotion || !isEmotionType(emotion)) {
      return
    }

    this.onSelect(emotion)
    this.close()
  }
}
