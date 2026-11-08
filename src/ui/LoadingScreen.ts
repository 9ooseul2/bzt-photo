export class LoadingScreen {
  private readonly host: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
  }

  show(): void {
    this.host.hidden = false
    this.host.setAttribute('aria-busy', 'true')
    this.host.innerHTML = `
      <div class="loading-screen__card">
        <p class="loading-screen__message">입장 중...</p>
      </div>
    `
  }

  hide(): void {
    this.host.hidden = true
    this.host.setAttribute('aria-busy', 'false')
  }

  showError(onRetry: () => void): void {
    this.host.hidden = false
    this.host.setAttribute('aria-busy', 'false')
    this.host.innerHTML = `
      <div class="loading-screen__card loading-screen__card--error" role="alert">
        <p class="loading-screen__message">전시실을 준비하지 못했습니다.</p>
        <p class="loading-screen__detail">잠시 후 다시 시도해주세요.</p>
        <button class="loading-screen__retry" type="button">다시 시도하기</button>
      </div>
    `
    this.host.querySelector<HTMLButtonElement>('.loading-screen__retry')?.addEventListener('click', onRetry, {
      once: true,
    })
  }
}
