import type { MovementInput } from './MovementInput.ts'

const SOURCE_ID = 'joystick'
/** 가운데 이 비율 안쪽은 손이 살짝 떨린 것으로 보고 무시한다. */
const DEAD_ZONE = 0.15
/** 손잡이를 바깥 원 끝 가까이(95%)까지 밀면 달리기 시작한다. */
const RUN_ENTER = 0.95
/** 달리는 중에는 85% 아래로 돌아와야 다시 걷는다(경계에서 걷기·달리기가 깜빡이지 않게). */
const RUN_EXIT = 0.85

/**
 * 터치 기기용 가상 조이스틱. 화면 왼쪽 아래에 보이고, 손잡이를 끈 방향과 거리를
 * MovementInput 의 `joystick` 칸에 넣는다. 끝까지 밀면 달린다.
 *
 * - 보이는지 여부는 CSS 의 (pointer: coarse) 로 정한다. PC 에서는 보이지 않는다.
 * - 조이스틱은 3D 캔버스와 형제 요소라서, 조이스틱을 누른 손가락은 둘러보기·탭 이동으로 전달되지 않는다.
 *   다른 손가락으로 화면을 끌면 둘러보기가 동시에 된다.
 */
export class VirtualJoystick {
  private readonly input: MovementInput
  private readonly root: HTMLDivElement
  private readonly knob: HTMLDivElement
  private activePointerId: number | undefined
  private centerX = 0
  private centerY = 0
  private radius = 1
  private running = false

  constructor(host: HTMLElement, input: MovementInput) {
    this.input = input

    this.root = document.createElement('div')
    this.root.className = 'virtual-joystick'
    this.root.setAttribute('aria-hidden', 'true')
    this.knob = document.createElement('div')
    this.knob.className = 'virtual-joystick__knob'
    this.root.append(this.knob)
    host.append(this.root)

    this.root.addEventListener('pointerdown', this.onPointerDown)
    this.root.addEventListener('pointermove', this.onPointerMove)
    this.root.addEventListener('pointerup', this.onPointerEnd)
    this.root.addEventListener('pointercancel', this.onPointerEnd)
    this.root.addEventListener('lostpointercapture', this.onPointerEnd)
    this.root.addEventListener('contextmenu', preventDefault)
    window.addEventListener('blur', this.release)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  /** 작품 보기·방명록 등 창이 열리면 숨기고 입력을 0으로 돌린다. */
  setEnabled(enabled: boolean): void {
    if (!enabled) this.release()
    this.root.hidden = !enabled
  }

  dispose(): void {
    this.release()
    this.root.removeEventListener('pointerdown', this.onPointerDown)
    this.root.removeEventListener('pointermove', this.onPointerMove)
    this.root.removeEventListener('pointerup', this.onPointerEnd)
    this.root.removeEventListener('pointercancel', this.onPointerEnd)
    this.root.removeEventListener('lostpointercapture', this.onPointerEnd)
    this.root.removeEventListener('contextmenu', preventDefault)
    window.removeEventListener('blur', this.release)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.root.remove()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // 한 번에 한 손가락만 조이스틱을 잡는다.
    if (this.activePointerId !== undefined) return
    event.preventDefault()

    const rect = this.root.getBoundingClientRect()
    this.centerX = rect.left + rect.width / 2
    this.centerY = rect.top + rect.height / 2
    // 손잡이 가운데가 바깥 원 테두리까지 갈 수 있다.
    this.radius = Math.max(rect.width / 2, 1)
    this.activePointerId = event.pointerId
    this.root.setPointerCapture(event.pointerId)
    this.root.classList.add('virtual-joystick--active')
    this.moveTo(event.clientX, event.clientY)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    event.preventDefault()
    this.moveTo(event.clientX, event.clientY)
  }

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    this.release()
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.release()
  }

  private readonly release = (): void => {
    const pointerId = this.activePointerId
    this.activePointerId = undefined
    if (pointerId !== undefined && this.root.hasPointerCapture(pointerId)) {
      this.root.releasePointerCapture(pointerId)
    }
    this.running = false
    this.knob.style.transform = ''
    this.root.classList.remove('virtual-joystick--active', 'virtual-joystick--running')
    this.input.set(SOURCE_ID, { forward: 0, right: 0 })
  }

  private moveTo(clientX: number, clientY: number): void {
    const dx = clientX - this.centerX
    const dy = clientY - this.centerY
    const distance = Math.hypot(dx, dy)
    const amount = Math.min(distance / this.radius, 1)
    const knobScale = distance > 0 ? (amount * this.radius) / distance : 0
    this.knob.style.transform = `translate(${dx * knobScale}px, ${dy * knobScale}px)`

    if (amount < DEAD_ZONE) {
      this.setRunning(false)
      this.input.set(SOURCE_ID, { forward: 0, right: 0 })
      return
    }

    this.setRunning(this.running ? amount >= RUN_EXIT : amount >= RUN_ENTER)
    // 데드존 밖은 0~1로 다시 펼쳐서, 조금 밀면 천천히, 많이 밀면 걷기 최고 속도가 되게 한다.
    const strength = (amount - DEAD_ZONE) / (1 - DEAD_ZONE)
    this.input.set(SOURCE_ID, {
      // 화면 위쪽이 카메라가 보는 앞쪽이다.
      forward: (-dy / distance) * strength,
      right: (dx / distance) * strength,
      run: this.running,
    })
  }

  private setRunning(running: boolean): void {
    if (this.running === running) return
    this.running = running
    this.root.classList.toggle('virtual-joystick--running', running)
  }
}

function preventDefault(event: Event): void {
  event.preventDefault()
}
