import type { CinemaConfig } from '../../scenes/exhibition/cinema/types.ts'
import type { ExhibitionRoomConfig } from '../../scenes/exhibition/types.ts'
import type { PortalConfig } from '../../scenes/portals/types.ts'
import type { RoomAppearanceConfig, RoomLightingConfig } from '../types.ts'

const width = 16
const depth = 20
const wallHeight = 6.4

/** 원룸형 영상관. 북쪽 벽에 스크린, 남쪽에서 입장한다. */
export const VIDEO_ROOM_CONFIG: ExhibitionRoomConfig = {
  id: 'video-room',
  displayName: '영상관',
  dimensions: { width, depth, wallHeight },
  wallThickness: 0.28,
  floor: { id: 'video-room-floor', color: '#463a32' },
  ceiling: { id: 'video-room-ceiling', height: wallHeight, thickness: 0.28, color: '#4e3727' },
  spawnPoint: { x: 0, z: 7.6 },
  exteriorWalls: [
    { id: 'video-wall-north', position: { x: 0, z: -depth / 2 }, length: width, rotationY: 0 },
    { id: 'video-wall-south', position: { x: 0, z: depth / 2 }, length: width, rotationY: 0 },
    { id: 'video-wall-west', position: { x: -width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
    { id: 'video-wall-east', position: { x: width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
  ],
  partitions: [],
  entrance: {
    id: 'video-room-entrance',
    // 방 이동은 포털로 하므로 형식상의 입구 (전시실 2와 같은 방식)
    position: { x: 0, z: depth / 2 },
    width: 0.1,
    height: 0.1,
    rotationY: 0,
  },
}

/**
 * 작고 따뜻한 상영실: 웜톤 진회색 벽, 그보다 한 단계 어두운 바닥.
 * 바닥은 위에서 오는 빛을 정면으로 받아 같은 색이어도 더 밝아 보이므로 일부러 더 어둡게 한다.
 */
export const VIDEO_ROOM_APPEARANCE: RoomAppearanceConfig = {
  wallColor: '#6f5f52',
  ceilingColor: '#4e3727',
  floorColor: '#463a32',
  floorRoughness: 0.8,
}

/** 전체 조명은 은은한 주황빛으로 약하게. 벽등·스탠드·스크린 빛(CinemaHall)이 군데군데 밝힌다. */
export const VIDEO_ROOM_LIGHTING: RoomLightingConfig = {
  background: '#1a1410',
  hemisphere: { sky: '#ffd6aa', ground: '#3a2a20', intensity: 0.72 },
  keyLight: { color: '#ffe2bf', intensity: 0.3, castShadow: false },
}

/**
 * 프로젝터 스크린 + 베이지 1인 소파 40개 (5줄 × 한 줄 8개).
 * 앉기 전에는 스크린에 정지 이미지만 보이고, 앉으면 그 사람 화면에서 0초부터 재생된다.
 * 소파는 두 개씩 짝지어 놓고, 짝 사이(0.8m)·가운데 통로(1.6m)·줄 사이에 여유를 둔다.
 * 영상은 public/videos 폴더에 넣거나, 외부 저장소 주소('https://...')를 적는다.
 */
export const VIDEO_ROOM_CINEMA: CinemaConfig = {
  videoUrl: '/videos/sample-video.mp4',
  // 포스터를 쓰려면 public/videos 폴더에 이미지를 넣고 아래 줄 앞의 // 를 지운다. 지금은 영상 첫 장면을 쓴다.
  // posterUrl: '/videos/poster.jpg',
  screenMessage: '좌석에 앉으면 재생됩니다',
  entryNotice: '빈 좌석을 클릭하면 영상을 처음부터 시청할 수 있습니다',
  screen: { width: 9.6, centerY: 3.4, z: -depth / 2 + 0.2, borderColor: '#e6e0d6' },
  seating: {
    rowZ: [-4.6, -2.5, -0.4, 1.7, 3.8],
    offsets: [1.3, 2.3, 4.1, 5.1],
    curve: 0.025,
  },
  sofaColor: '#e2d5bd',
  lampColor: '#ffbf7a',
  wallLamps: { wallX: width / 2 - 0.14, z: [-6.0, -1.5, 3.0], height: 2.4, intensity: 1.5 },
  floorLamps: [{ x: -6.6, z: -8.9 }, { x: 6.8, z: 4.6 }],
  speakers: [{ x: 6.1, z: -9.0 }],
}

export const VIDEO_ROOM_PORTALS: readonly PortalConfig[] = [
  { id: 'to-room-2', wallId: 'video-wall-south', offsetX: -4.6, label: '전시실 2', action: 'go-to-room', targetRoomId: 'room-2' },
]
