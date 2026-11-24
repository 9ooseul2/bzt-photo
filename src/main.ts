import './style.css'
import { App } from './core/App.ts'

const appElement = document.querySelector<HTMLDivElement>('#app')

if (!appElement) {
  throw new Error('Application root element (#app) was not found.')
}

keepViewportAtTop()

const app = new App(appElement)
app.start()

/**
 * iOS Safari(특히 iOS 26)는 키보드를 닫거나 화면을 쓸어 올린 뒤 페이지가 위로 밀린 채 남는 일이 있다.
 * 그러면 방명록·꾸미기 버튼이 시계와 다이내믹 아일랜드 아래로 들어간다.
 * 이 사이트는 페이지 자체가 스크롤될 일이 없으므로, 밀려 있으면 맨 위로 되돌린다.
 * 글을 입력하는 중에는 키보드 위로 입력창을 보여 주려는 동작이라 건드리지 않는다.
 */
function keepViewportAtTop(): void {
  const isTyping = () => {
    const active = document.activeElement
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)
  }
  const reset = () => {
    if (isTyping()) return
    if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0)
    if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0
    if (document.body.scrollTop !== 0) document.body.scrollTop = 0
  }
  // 키보드가 닫힌 직후에는 Safari가 화면 크기를 다시 계산하는 중이라 조금 기다렸다가 맞춘다.
  document.addEventListener('focusout', () => {
    window.setTimeout(reset, 60)
    window.setTimeout(reset, 350)
  })
  window.visualViewport?.addEventListener('resize', reset)
  window.addEventListener('scroll', reset, { passive: true })
  window.addEventListener('orientationchange', () => window.setTimeout(reset, 300))
}
