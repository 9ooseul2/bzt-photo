/**
 * 인증샷 폴라로이드. 숫자·문구만 바꿔서 조절할 수 있다.
 * 1080×1350(4:5)은 인스타그램 피드에서 가장 크게 보이는 세로 비율이다. PC·휴대폰 모두 같은 크기로 저장된다.
 * 아래 왼쪽은 일부러 비워 둔다 (사진을 받은 사람이 직접 꾸미는 자리).
 */
export const PHOTO_CARD = {
  width: 1080,
  height: 1350,
  /** 사진 바깥 흰 테두리 (위·양옆) */
  border: 60,
  paper: '#fffdf9',
  title: '비서재 사진전 : 비정형 온기',
  titleColor: '#081b0d',
  dateColor: '#8a857d',
  fontFamily: "Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
} as const

/** 정사각형 사진을 폴라로이드 한 장으로 만든다 */
export function composePhotoCard(photo: HTMLCanvasElement, date = new Date()): HTMLCanvasElement {
  const { width, height, border } = PHOTO_CARD
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return photo
  const photoSize = width - border * 2

  context.fillStyle = PHOTO_CARD.paper
  context.fillRect(0, 0, width, height)
  context.drawImage(photo, border, border, photoSize, photoSize)
  context.strokeStyle = '#e9e4dc'
  context.lineWidth = 1
  context.strokeRect(border + 0.5, border + 0.5, photoSize - 1, photoSize - 1)

  // 아래 여백 오른쪽: 전시 이름 + 날짜
  const right = width - border - 4
  const bottomTop = border + photoSize
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  context.fillStyle = PHOTO_CARD.titleColor
  context.font = `600 30px ${PHOTO_CARD.fontFamily}`
  context.fillText(PHOTO_CARD.title, right, bottomTop + 138)
  context.fillStyle = PHOTO_CARD.dateColor
  context.font = `500 26px ${PHOTO_CARD.fontFamily}`
  context.fillText(formatDate(date), right, bottomTop + 182)
  return canvas
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
