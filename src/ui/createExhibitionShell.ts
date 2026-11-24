export interface ExhibitionShell {
  canvasHost: HTMLDivElement
  customizerHost: HTMLElement
  customizeButton: HTMLButtonElement
  entryHost: HTMLElement
  artworkViewerHost: HTMLElement
  giftShopCardHost: HTMLElement
  floatingActionsHost: HTMLElement
  guideHost: HTMLElement
  helpButton: HTMLButtonElement
  loadingHost: HTMLElement
  minimapHost: HTMLElement
  roomIntroReaderHost: HTMLElement
  roomSwitcherHost: HTMLElement
  guestbookReturnButton: HTMLButtonElement
  guestbookWriteButton: HTMLButtonElement
  guestbookModalHost: HTMLElement
  sceneTransition: HTMLElement
  toastHost: HTMLElement
  photoButton: HTMLButtonElement
  photoPreviewHost: HTMLElement
}

/** Creates the canvas host plus lightweight DOM layers for the visitor flow. */
export function createExhibitionShell(rootElement: HTMLElement): ExhibitionShell {
  rootElement.innerHTML = `
    <main class="exhibition-app">
      <div class="scene-canvas" aria-label="3D exhibition"></div>
      <section class="entry-screen" aria-labelledby="entry-title">
        <form class="entry-card" novalidate>
          <p class="entry-card__eyebrow">B. PHOTO PROJECT</p>
          <h1 id="entry-title">GALLERY</h1>
          <label class="entry-card__label" for="visitor-nickname">닉네임</label>
          <input
            id="visitor-nickname"
            class="entry-card__input"
            name="nickname"
            type="text"
            maxlength="12"
            autocomplete="nickname"
            placeholder="닉네임을 입력해주세요"
            aria-describedby="nickname-hint"
          >
          <p id="nickname-hint" class="entry-card__hint">최대 12자</p>
          <button class="entry-card__submit" type="submit" disabled>입장하기</button>
        </form>
      </section>
      <section class="loading-screen" aria-live="polite" aria-busy="true" hidden>
        <div class="loading-screen__card">
          <p class="loading-screen__message">입장 중...</p>
        </div>
      </section>
      <section class="guide-layer" hidden aria-hidden="true">
        <div class="guide-layer__backdrop"></div>
        <section class="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <button class="guide-dialog__close" type="button" aria-label="관람 안내 닫기">×</button>
          <h2 id="guide-title">관람 안내</h2>
          <ul class="guide-dialog__list">
            <li>이동하고 싶은 위치의 바닥을 클릭해주세요.</li>
            <li class="guide-dialog__item--keyboard">키보드 방향키나 W·A·S·D 키로 직접 걸어 다닐 수도 있습니다. Shift를 함께 누르면 달려요.</li>
            <li class="guide-dialog__item--touch">왼쪽 아래 조이스틱으로 직접 걸어 다닐 수도 있습니다. 끝까지 밀면 달려요.</li>
            <li>마우스를 드래그하면 주변을 둘러볼 수 있습니다.</li>
            <li>마우스 휠로 시야를 확대하거나 축소할 수 있습니다.</li>
            <li>작품을 클릭하면 큰 화면으로 감상하실 수 있습니다.</li>
            <li>다른 전시실이나 방명록으로 가려면 왼쪽 위의 '이동' 버튼을 눌러주세요.</li>
            <li>인증샷, 캐릭터 꾸미기, 관람 안내는 오른쪽 아래의 + 버튼을 누르면 나옵니다.</li>
          </ul>
          <div class="guide-dialog__footer">
            <button class="guide-dialog__dismiss-today" type="button">오늘 그만 보기</button>
            <button class="guide-dialog__confirm" type="button">관람 시작하기</button>
          </div>
        </section>
      </section>
      <section class="photo-preview" hidden></section>
      <section class="room-switcher" hidden></section>
      <section class="minimap" hidden></section>
      <button class="scene-switch scene-switch--return" type="button" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
        <span>전시실로 돌아가기</span>
      </button>
      <button class="guestbook-write" type="button" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L9 18z" /><path d="M13.5 7.5l3 3" /></svg>
        <span>방명록 남기기</span>
      </button>
      <div class="floating-actions" hidden>
        <div class="floating-actions__menu" id="floating-actions-menu" hidden>
          <button class="floating-actions__item photo-button" type="button" hidden>
            <span class="floating-actions__label">인증샷</span>
            <span class="floating-actions__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /><circle cx="12" cy="12.75" r="3.25" /></svg></span>
          </button>
          <button class="floating-actions__item customize-button" type="button" hidden>
            <span class="floating-actions__label">꾸미기</span>
            <span class="floating-actions__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l-5 2.5 1.5 4.5 2.5-1V20h8V10l2.5 1L20 6.5 15 4a3 3 0 0 1-6 0z" /></svg></span>
          </button>
          <button class="floating-actions__item guide-help" type="button" hidden>
            <span class="floating-actions__label">관람 안내</span>
            <span class="floating-actions__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6" /><path d="M12 16.8v.2" /></svg></span>
          </button>
        </div>
        <button class="floating-actions__toggle" type="button" aria-expanded="false" aria-controls="floating-actions-menu" aria-label="메뉴 열기">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <section class="guestbook-modal" hidden></section>
      <section class="artwork-viewer" hidden aria-hidden="true"></section>
      <section class="room-intro-reader" hidden aria-hidden="true"></section>
      <section class="gift-shop-card" hidden aria-hidden="true"></section>
      <p class="guestbook-toast" role="status" hidden></p>
      <div class="scene-transition" hidden></div>
      <section class="customizer-screen" hidden></section>
    </main>
  `

  const canvasHost = rootElement.querySelector<HTMLDivElement>('.scene-canvas')
  const customizerHost = rootElement.querySelector<HTMLElement>('.customizer-screen')
  const customizeButton = rootElement.querySelector<HTMLButtonElement>('.customize-button')
  const entryHost = rootElement.querySelector<HTMLElement>('.entry-screen')
  const artworkViewerHost = rootElement.querySelector<HTMLElement>('.artwork-viewer')
  const giftShopCardHost = rootElement.querySelector<HTMLElement>('.gift-shop-card')
  const floatingActionsHost = rootElement.querySelector<HTMLElement>('.floating-actions')
  const loadingHost = rootElement.querySelector<HTMLElement>('.loading-screen')
  const minimapHost = rootElement.querySelector<HTMLElement>('.minimap')
  const roomIntroReaderHost = rootElement.querySelector<HTMLElement>('.room-intro-reader')
  const roomSwitcherHost = rootElement.querySelector<HTMLElement>('.room-switcher')
  const guideHost = rootElement.querySelector<HTMLElement>('.guide-layer')
  const helpButton = rootElement.querySelector<HTMLButtonElement>('.guide-help')
  const guestbookReturnButton = rootElement.querySelector<HTMLButtonElement>('.scene-switch--return')
  const guestbookWriteButton = rootElement.querySelector<HTMLButtonElement>('.guestbook-write')
  const guestbookModalHost = rootElement.querySelector<HTMLElement>('.guestbook-modal')
  const sceneTransition = rootElement.querySelector<HTMLElement>('.scene-transition')
  const toastHost = rootElement.querySelector<HTMLElement>('.guestbook-toast')
  const photoButton = rootElement.querySelector<HTMLButtonElement>('.photo-button')
  const photoPreviewHost = rootElement.querySelector<HTMLElement>('.photo-preview')

  if (!canvasHost || !customizerHost || !customizeButton || !entryHost || !artworkViewerHost || !roomIntroReaderHost || !roomSwitcherHost || !giftShopCardHost || !floatingActionsHost || !loadingHost || !minimapHost || !guideHost || !helpButton || !guestbookReturnButton || !guestbookWriteButton || !guestbookModalHost || !sceneTransition || !toastHost || !photoButton || !photoPreviewHost) {
    throw new Error('Exhibition UI could not be created.')
  }

  return {
    canvasHost, customizerHost, customizeButton, entryHost, artworkViewerHost, roomIntroReaderHost, roomSwitcherHost, giftShopCardHost, floatingActionsHost, guideHost, helpButton, loadingHost, minimapHost,
    guestbookReturnButton, guestbookWriteButton, guestbookModalHost, sceneTransition, toastHost, photoButton, photoPreviewHost,
  }
}
