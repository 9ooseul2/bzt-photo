import { CanvasTexture, Sprite, SpriteMaterial } from 'three'

export interface NicknameLabelConfig {
  height: number
}

/** Canvas-backed sprite label; Sprite keeps the nickname facing the active camera. */
export class NicknameLabel {
  readonly sprite: Sprite
  private readonly material: SpriteMaterial
  private readonly texture: CanvasTexture

  constructor(nickname: string, config: NicknameLabelConfig) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Nickname label canvas is unavailable.')
    }

    const fontSize = 42
    const horizontalPadding = 24
    const verticalPadding = 14
    context.font = `600 ${fontSize}px Pretendard, Arial, sans-serif`
    const textWidth = Math.ceil(context.measureText(nickname).width)
    canvas.width = textWidth + horizontalPadding * 2
    canvas.height = fontSize + verticalPadding * 2

    const drawContext = canvas.getContext('2d')
    if (!drawContext) {
      throw new Error('Nickname label canvas is unavailable.')
    }

    const radius = 18
    drawContext.beginPath()
    drawContext.roundRect(1, 1, canvas.width - 2, canvas.height - 2, radius)
    drawContext.fillStyle = 'rgba(35, 39, 33, 0.66)'
    drawContext.fill()
    drawContext.strokeStyle = 'rgba(255, 255, 255, 0.58)'
    drawContext.lineWidth = 2
    drawContext.stroke()
    drawContext.font = `600 ${fontSize}px Pretendard, Arial, sans-serif`
    drawContext.fillStyle = '#ffffff'
    drawContext.textAlign = 'center'
    drawContext.textBaseline = 'middle'
    drawContext.fillText(nickname, canvas.width / 2, canvas.height / 2 + 1)

    this.texture = new CanvasTexture(canvas)
    this.texture.colorSpace = 'srgb'
    this.material = new SpriteMaterial({
      map: this.texture,
      depthTest: true,
      depthWrite: false,
      transparent: true,
    })
    this.sprite = new Sprite(this.material)
    this.sprite.name = 'visitor-nickname-label'
    this.sprite.position.y = config.height
    const worldHeight = 0.28
    this.sprite.scale.set((canvas.width / canvas.height) * worldHeight, worldHeight, 1)
  }

  dispose(): void {
    this.texture.dispose()
    this.material.dispose()
  }
}
