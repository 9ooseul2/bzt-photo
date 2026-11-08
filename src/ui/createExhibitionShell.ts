export interface ExhibitionShell {
  canvasHost: HTMLDivElement
  customizerHost: HTMLElement
  customizeButton: HTMLButtonElement
  entryHost: HTMLElement
  emotionHost: HTMLElement
  artworkViewerHost: HTMLElement
  giftShopCardHost: HTMLElement
  galleryGuestbookButton: HTMLButtonElement
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
            <li>마우스를 드래그하면 주변을 둘러볼 수 있습니다.</li>
            <li>마우스 휠로 시야를 확대하거나 축소할 수 있습니다.</li>
            <li>작품을 클릭하면 큰 화면으로 감상하실 수 있습니다.</li>
            <li>다른 전시실로 이동하려면 화면 왼쪽의 버튼을 눌러주세요.</li>
            <li>관람 안내는 오른쪽 아래의 '?' 버튼에서 다시 확인하실 수 있습니다.</li>
            <li>조용한 관람을 위해 관람객 간 대화는 지원하지 않습니다. 대신 이모지로 감상을 자유롭게 표현해주세요!</li>
          </ul>
          <button class="guide-dialog__confirm" type="button">관람 시작하기</button>
        </section>
      </section>
      <div class="emotion-control" hidden>
        <div class="emotion-control__menu" role="menu" aria-label="감정 표현 선택" hidden>
          <button type="button" role="menuitem" data-emotion="❤️" aria-label="하트">❤️</button>
          <button type="button" role="menuitem" data-emotion="👏" aria-label="박수">👏</button>
          <button type="button" role="menuitem" data-emotion="🥹" aria-label="감동">🥹</button>
        </div>
        <button class="emotion-control__toggle" type="button" aria-label="감정 표현" aria-expanded="false">❤️</button>
      </div>
      <button class="scene-switch scene-switch--guestbook" type="button" hidden>방명록</button>
      <section class="room-switcher" hidden></section>
      <button class="customize-button" type="button" aria-label="캐릭터 꾸미기" hidden>꾸미기</button>
      <section class="minimap" hidden></section>
      <button class="scene-switch scene-switch--return" type="button" hidden>전시실로 돌아가기</button>
      <button class="guestbook-write" type="button" hidden>방명록 남기기</button>
      <button class="guide-help" type="button" aria-label="관람 안내 다시 보기" hidden>?</button>
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
  const emotionHost = rootElement.querySelector<HTMLElement>('.emotion-control')
  const artworkViewerHost = rootElement.querySelector<HTMLElement>('.artwork-viewer')
  const giftShopCardHost = rootElement.querySelector<HTMLElement>('.gift-shop-card')
  const galleryGuestbookButton = rootElement.querySelector<HTMLButtonElement>('.scene-switch--guestbook')
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

  if (!canvasHost || !customizerHost || !customizeButton || !entryHost || !emotionHost || !artworkViewerHost || !roomIntroReaderHost || !roomSwitcherHost || !giftShopCardHost || !galleryGuestbookButton || !loadingHost || !minimapHost || !guideHost || !helpButton || !guestbookReturnButton || !guestbookWriteButton || !guestbookModalHost || !sceneTransition || !toastHost) {
    throw new Error('Exhibition UI could not be created.')
  }

  return {
    canvasHost, customizerHost, customizeButton, entryHost, emotionHost, artworkViewerHost, roomIntroReaderHost, roomSwitcherHost, giftShopCardHost, galleryGuestbookButton, guideHost, helpButton, loadingHost, minimapHost,
    guestbookReturnButton, guestbookWriteButton, guestbookModalHost, sceneTransition, toastHost,
  }
}
