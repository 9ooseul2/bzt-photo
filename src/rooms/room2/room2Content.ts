import type { ArtworkConfig } from '../../scenes/exhibition/artworks/types.ts'
import type { RoomIntroConfig } from '../../scenes/exhibition/roomIntro/types.ts'
import type { RoomPropConfig } from '../../scenes/exhibition/props/types.ts'
import type { RoomAppearanceConfig, RoomLightingConfig } from '../types.ts'

export const ROOM_2_APPEARANCE: RoomAppearanceConfig = {
  wallColor: '#f4f3ef',
  ceilingColor: '#f2f1ec',
  floorColor: '#3a3a3c',
  floorRoughness: 0.95,
}

export const ROOM_2_LIGHTING: RoomLightingConfig = {
  background: '#515255',
  hemisphere: { sky: '#fff6e8', ground: '#756f67', intensity: 0.7 },
  keyLight: { color: '#fff4dc', intensity: 1.05, castShadow: false },
  trackLighting: true,
}

/** Eight reused samples, distributed as two works on each visible partition face. */
export const ROOM_2_ARTWORKS: readonly ArtworkConfig[] = [
  {
    id: 'room2-a-back-01', imageUrl: '/images/artworks/sample-01.jpg', title: '샘플 빛의 결', artist: '샘플 작가 A',
    comment: '벽을 따라 움직이는 오후의 빛을 담은 샘플 작품입니다.',
    placement: { wallId: 'room2-partition-a', side: 'back', offsetX: -7.2 }, width: 1.9, frameStyle: 'thin-wood',
  },
  {
    id: 'room2-a-back-02', imageUrl: '/images/artworks/sample-02.jpg', title: '샘플 산책', artist: '샘플 작가 B',
    comment: '느린 발걸음과 계절의 색을 위한 샘플 설명입니다.',
    placement: { wallId: 'room2-partition-a', side: 'back', offsetX: -2.4 }, width: 1.75, frameStyle: 'none',
  },
  {
    id: 'room2-a-front-03', imageUrl: '/images/artworks/sample-03.jpg', title: '샘플 정물', artist: '샘플 작가 C',
    comment: '작고 고요한 사물을 바라보는 샘플 작품입니다.',
    placement: { wallId: 'room2-partition-a', side: 'front', offsetX: -6.1 }, width: 1.9, frameStyle: 'thin-wood',
  },
  {
    id: 'room2-a-front-04', imageUrl: '/images/artworks/sample-04.jpg', title: '샘플의 창', artist: '샘플 작가 D',
    comment: '창가의 공기와 그림자를 기록한 샘플 작품입니다.',
    placement: { wallId: 'room2-partition-a', side: 'front', offsetX: 0.2 }, width: 1.8, frameStyle: 'none',
  },
  {
    id: 'room2-b-back-05', imageUrl: '/images/artworks/sample-05.jpg', title: '샘플 물결', artist: '샘플 작가 E',
    comment: '반복되는 선과 잔잔한 리듬을 담은 샘플입니다.',
    placement: { wallId: 'room2-partition-b', side: 'back', offsetX: -5.4 }, width: 1.8, frameStyle: 'thin-wood',
  },
  {
    id: 'room2-b-back-06', imageUrl: '/images/artworks/sample-06.jpg', title: '샘플 밤의 온도', artist: '샘플 작가 F',
    comment: '어두운 색 사이의 온기를 관찰하는 샘플 작품입니다.',
    placement: { wallId: 'room2-partition-b', side: 'back', offsetX: 2.1 }, width: 1.8, frameStyle: 'none',
  },
  {
    id: 'room2-b-front-07', imageUrl: '/images/artworks/sample-07.jpg', title: '샘플 들판', artist: '샘플 작가 G',
    comment: '넓은 여백과 낮은 수평선을 가진 샘플 작품입니다.',
    placement: { wallId: 'room2-partition-b', side: 'front', offsetX: -5.2 }, width: 1.85, frameStyle: 'thin-wood',
  },
  {
    id: 'room2-b-front-08', imageUrl: '/images/artworks/sample-08.jpg', title: '샘플 편지', artist: '샘플 작가 H',
    comment: '남겨진 문장과 손끝의 시간을 상상하는 샘플입니다.',
    placement: { wallId: 'room2-partition-b', side: 'front', offsetX: 3.1 }, width: 1.75, frameStyle: 'none',
  },
]

export const ROOM_2_INTROS: readonly RoomIntroConfig[] = [
  {
    id: 'room2-introduction',
    roomName: '전시실 2',
    title: '낮은 불빛 아래에서',
    paragraphs: [
      '이곳은 조금 더 어둡고, 조금 더 가까운 방입니다. 천장의 작은 조명들이 사진 한 장 한 장을 비추고, 그 사이의 공간은 조용히 그늘 속에 남겨 두었습니다.',
      '책장에 꽂힌 책처럼, 이 방의 사진들은 펼쳐 보기 전까지는 제 이야기를 다 들려주지 않습니다. 빛이 고인 자리마다 잠시 멈추어, 한 장씩 천천히 넘겨 보세요.',
      '복도를 따라 걷다 보면 길은 몇 번 꺾입니다. 서두를 필요는 없습니다. 마지막 모퉁이 끝에는 오늘의 감상을 남길 수 있는 문이 기다리고 있습니다.',
    ],
    placement: { wallId: 'room2-wall-north', offsetX: -7, centerHeight: 3.2 },
    width: 3.45,
  },
]

export const ROOM_2_PROPS: readonly RoomPropConfig[] = [
  { id: 'room2-bookshelf-black', kind: 'bookshelf-black', position: { x: -1, z: -11.62 } },
  { id: 'room2-notes-north', kind: 'wall-notes', wallId: 'room2-wall-north', offsetX: 3.2, centerHeight: 3.15 },
  { id: 'room2-bookshelf-white', kind: 'bookshelf-white', position: { x: -6, z: 11.62 } },
  { id: 'room2-notes-south', kind: 'wall-notes', wallId: 'room2-wall-south', offsetX: 1.8, centerHeight: 3.15 },
  { id: 'room2-floor-lamp', kind: 'floor-lamp', position: { x: 11.75, z: 10.9 } },
]
