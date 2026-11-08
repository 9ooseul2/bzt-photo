import type { VisitorSession } from '../user/VisitorSession.ts'

export class EntryScreen {
  private readonly form: HTMLFormElement
  private readonly host: HTMLElement
  private readonly input: HTMLInputElement
  private readonly onEnter: (nickname: string) => void
  private readonly session: VisitorSession
  private readonly submitButton: HTMLButtonElement

  constructor(
    host: HTMLElement,
    session: VisitorSession,
    onEnter: (nickname: string) => void,
  ) {
    const form = host.querySelector<HTMLFormElement>('.entry-card')
    const input = host.querySelector<HTMLInputElement>('.entry-card__input')
    const submitButton = host.querySelector<HTMLButtonElement>('.entry-card__submit')

    if (!form || !input || !submitButton) {
      throw new Error('Entry screen could not be created.')
    }

    this.host = host
    this.session = session
    this.onEnter = onEnter
    this.form = form
    this.input = input
    this.submitButton = submitButton
    this.input.addEventListener('input', this.updateValidity)
    this.form.addEventListener('submit', this.submit)
    this.updateValidity()
  }

  show(): void {
    this.host.hidden = false
    window.requestAnimationFrame(() => this.input.focus())
  }

  hide(): void {
    this.host.hidden = true
  }

  private readonly updateValidity = (): void => {
    this.submitButton.disabled = !this.session.hasValidNickname(this.input.value)
  }

  private readonly submit = (event: SubmitEvent): void => {
    event.preventDefault()
    const nickname = this.session.normalizeNickname(this.input.value)

    if (!this.session.hasValidNickname(nickname)) {
      this.updateValidity()
      this.input.focus()
      return
    }

    this.onEnter(nickname)
  }
}
