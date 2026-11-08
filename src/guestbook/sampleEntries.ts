import type { GuestbookEntry } from './types.ts'

/** Demo-only records are never written to localStorage. */
const samplePlacements = ['north-0', 'north-1', 'north-2', 'north-3', 'east-0', 'east-1', 'east-2', 'east-3', 'south-0', 'south-1', 'south-2', 'south-3', 'west-0', 'west-1', 'west-2', 'west-3']

export const SAMPLE_GUESTBOOK_ENTRIES: readonly GuestbookEntry[] = [
  ['sample-01', '민트', '전시장 안을 천천히 걷는 시간이 좋았어요.', 'butter'], ['sample-02', '봄날', '빛과 그림자가 정말 예뻐요.', 'pink'],
  ['sample-03', '물결', '사진마다 다른 이야기가 들리는 것 같아요.', 'sage'], ['sample-04', '다람', '오늘의 마음을 남기고 갑니다.', 'lavender'],
  ['sample-05', '소나기', '조용해서 더 오래 보고 싶어지는 전시네요.', 'butter'], ['sample-06', '유자', '따뜻한 색감이 기억에 남아요.', 'pink'],
  ['sample-07', '하루', '좋은 작품들 감사히 감상했습니다.', 'sage'], ['sample-08', '코튼', '다음 전시도 기대할게요.', 'lavender'],
  ['sample-09', '구름', '혼자만의 산책처럼 편안한 공간이에요.', 'butter'], ['sample-10', '여름', '작품을 보고 나니 마음이 맑아졌어요.', 'pink'],
  ['sample-11', '초록', '오늘의 기록을 남기고 갑니다.', 'sage'], ['sample-12', '연필', '다시 천천히 둘러보고 싶습니다.', 'lavender'],
  ['sample-13', '하늬', '포스트잇을 읽는 재미가 있어요.', 'butter'], ['sample-14', '새벽', '좋은 전시 감사합니다.', 'pink'],
  ['sample-15', '온기', '마음에 오래 남을 것 같아요.', 'sage'], ['sample-16', '달빛', '따뜻한 하루 보내세요.', 'lavender'],
].map(([id, nickname, message, color], index) => ({
  id,
  nickname,
  message,
  color: color as GuestbookEntry['color'],
  createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  placement: { slotId: samplePlacements[index], wallId: samplePlacements[index].split('-')[0] },
}))
