import { formatDate } from '../photo/photoCard.ts'

/** 지금 열려 있는 브라우저 종류 (저장·공유가 막혀 있는지 판단) */
interface BrowserInfo {
  /** 카카오톡·인스타그램·페이스북 등 앱 안의 브라우저 */
  inApp: boolean
  kakao: boolean
  android: boolean
  /** 휴대폰·태블릿처럼 손가락으로 누르는 기기 */
  touch: boolean
}

function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent
  return {
    inApp: /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|Threads/i.test(ua),
    kakao: /KAKAOTALK/i.test(ua),
    android: /Android/i.test(ua),
    touch: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  }
}

/**
 * 인증샷 미리보기. 사진은 진짜 이미지(<img>)라서 어떤 브라우저에서든 길게 눌러 저장할 수 있다.
 * 그 위에 브라우저가 지원하는 버튼만 보여 준다:
 * - 휴대폰 브라우저: [공유 / 저장] (공유창에서 '이미지 저장', 인스타그램 등으로 바로 보내기)
 * - 카카오톡·인스타그램 안: 길게 눌러 저장 안내 + [다른 브라우저로 열기]
 * - PC: [복사] [사진 저장]
 */
export class PhotoPreview {
  private readonly host: HTMLElement
  private readonly onVisibilityChange: (isVisible: boolean) => void
  private readonly onRetake: () => void
  private objectUrl: string | undefined
  private returnFocus: HTMLElement | undefined

  constructor(host: HTMLElement, onVisibilityChange: (isVisible: boolean) => void, onRetake: () => void) {
    this.host = host
    this.onVisibilityChange = onVisibilityChange
    this.onRetake = onRetake
  }

  /** 찍는 순간 화면이 살짝 하얗게 번쩍인다 */
  flash(): void {
    const flash = document.createElement('div')
    flash.className = 'photo-flash'
    this.host.parentElement?.append(flash)
    window.setTimeout(() => flash.remove(), 450)
  }

  async open(card: HTMLCanvasElement): Promise<void> {
    const blob = await new Promise<Blob | null>((resolve) => card.toBlob(resolve, 'image/png'))
    if (!blob) return
    this.revoke()
    this.objectUrl = URL.createObjectURL(blob)
    const now = new Date()
    const fileName = `beeeezit-${formatDate(now).replaceAll('.', '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`
    const file = new File([blob], fileName, { type: 'image/png' })
    const browser = detectBrowser()
    const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
    const canCopy = !browser.touch && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write

    if (this.host.hidden) {
      const active = document.activeElement
      this.returnFocus = active instanceof HTMLElement && active !== document.body ? active : undefined
    }
    this.host.innerHTML = `
      <div class="photo-preview__backdrop"></div>
      <section class="photo-preview__sheet" role="dialog" aria-modal="true" aria-label="인증샷 미리보기">
        <button class="photo-preview__close" type="button" aria-label="미리보기 닫기">×</button>
        <img class="photo-preview__image" alt="전시장에서 찍은 인증샷">
        <p class="photo-preview__inapp" hidden><b>사진을 길게 눌러 저장해 주세요</b><span></span></p>
        <div class="photo-preview__actions"></div>
        <p class="photo-preview__hint" role="status"></p>
      </section>`
    this.host.querySelector<HTMLImageElement>('.photo-preview__image')!.src = this.objectUrl
    const actions = this.host.querySelector<HTMLElement>('.photo-preview__actions')!
    const hint = this.host.querySelector<HTMLElement>('.photo-preview__hint')!
    const addButton = (label: string, onClick: () => void, primary = false) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      if (primary) button.classList.add('is-primary')
      button.addEventListener('click', onClick)
      actions.append(button)
      return button
    }

    addButton('다시 찍기', () => { this.close(); this.onRetake() })

    if (browser.inApp) {
      // 앱 안의 브라우저는 파일 저장·공유가 막힌 경우가 많다: 길게 눌러 저장을 먼저 안내
      const inApp = this.host.querySelector<HTMLElement>('.photo-preview__inapp')!
      inApp.hidden = false
      const detail = inApp.querySelector('span')!
      if (canShare) addButton('공유 / 저장', () => void this.share(file, hint), true)
      if (browser.kakao) {
        detail.textContent = '카카오톡 안에서는 저장 버튼이 막혀 있을 수 있어요. 다른 브라우저에서는 다시 입장해야 할 수 있어요.'
        addButton('다른 브라우저로 열기', () => { window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}` }, !canShare)
      } else if (browser.android) {
        detail.textContent = '앱 안에서는 저장 버튼이 막혀 있을 수 있어요. 다른 브라우저에서는 다시 입장해야 할 수 있어요.'
        const { host, pathname, search, hash } = window.location
        addButton('다른 브라우저로 열기', () => { window.location.href = `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;end` }, !canShare)
      } else {
        detail.textContent = '앱 안에서는 저장 버튼이 막혀 있을 수 있어요. 오른쪽 위 ⋯ 메뉴에서 "외부 브라우저로 열기"를 눌러도 돼요.'
      }
    } else if (browser.touch) {
      if (canShare) {
        addButton('공유 / 저장', () => void this.share(file, hint), true)
        hint.textContent = "공유창에서 '이미지 저장'을 누르면 사진첩에 저장돼요. 사진을 길게 눌러도 저장할 수 있어요."
      } else {
        addButton('사진 저장', () => this.download(fileName), true)
        hint.textContent = '사진을 길게 눌러도 저장할 수 있어요.'
      }
    } else {
      if (canCopy) {
        addButton('복사', () => {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(() => { hint.textContent = '복사했어요. 원하는 곳에 붙여 넣어 주세요.' })
            .catch(() => { hint.textContent = '복사하지 못했어요. 사진 저장을 눌러 주세요.' })
        })
      }
      addButton('사진 저장', () => this.download(fileName), true)
      hint.textContent = 'PNG 파일(1080×1350)로 저장돼요. 인스타그램 피드 비율이에요.'
    }

    this.host.querySelector('.photo-preview__close')!.addEventListener('click', this.close)
    this.host.querySelector('.photo-preview__backdrop')!.addEventListener('click', this.close)
    if (this.host.hidden) {
      this.host.hidden = false
      window.addEventListener('keydown', this.onKeydown)
      this.onVisibilityChange(true)
    }
    window.requestAnimationFrame(() => actions.querySelector<HTMLButtonElement>('.is-primary')?.focus())
  }

  close = (): void => {
    if (this.host.hidden) return
    window.removeEventListener('keydown', this.onKeydown)
    this.host.hidden = true
    this.host.replaceChildren()
    this.revoke()
    this.onVisibilityChange(false)
    if (this.returnFocus?.isConnected) this.returnFocus.focus()
    this.returnFocus = undefined
  }

  private async share(file: File, hint: HTMLElement): Promise<void> {
    try {
      await navigator.share({ files: [file], title: '비서재 사진전 : 비정형 온기' })
    } catch (error) {
      // 공유창을 그냥 닫은 경우(AbortError)는 안내하지 않는다
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        hint.textContent = '공유창을 열지 못했어요. 사진을 길게 눌러 저장해 주세요.'
      }
    }
  }

  private download(fileName: string): void {
    if (!this.objectUrl) return
    const link = document.createElement('a')
    link.href = this.objectUrl
    link.download = fileName
    document.body.append(link)
    link.click()
    link.remove()
  }

  private revoke(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = undefined
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close()
  }
}
