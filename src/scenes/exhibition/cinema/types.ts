import type { PlanPosition } from '../types.ts'

/**
 * 영상관 설정. 숫자만 바꿔서 스크린 크기, 소파 배치, 조명을 조절할 수 있다.
 * 좌표는 방 중앙이 (0, 0)이고, 스크린은 북쪽 벽(-z 쪽)에 있으며 소파는 스크린 가운데를 바라본다.
 */
export interface CinemaConfig {
  /** 상영할 영상. public 폴더 기준 경로('/videos/a.mp4') 또는 외부 주소('https://...') */
  videoUrl: string
  /**
   * 앉기 전 스크린에 보이는 정지 이미지 (포스터). 비워 두면 영상 첫 장면을 쓴다.
   * 예: public/videos/poster.jpg 를 넣고 '/videos/poster.jpg'
   */
  posterUrl?: string
  /** 정지 이미지 위에 쓰는 문구 */
  screenMessage: string
  /** 영상관에 들어오면 잠깐 보여주는 안내 문구 */
  entryNotice: string
  screen: {
    /** 스크린 가로 길이 (세로는 16:9로 자동) */
    width: number
    /** 스크린 중심 높이 */
    centerY: number
    /** 스크린 면의 z 위치 (북쪽 벽 바로 앞) */
    z: number
    /** 스크린 테두리 색 (프로젝터 스크린처럼 밝은 천) */
    borderColor: string
  }
  seating: {
    /** 각 줄의 z 위치 (스크린에서 가까운 줄부터) */
    rowZ: readonly number[]
    /** 가운데에서 소파 중심까지의 거리. 왼쪽·오른쪽에 똑같이 놓인다 */
    offsets: readonly number[]
    /** 줄 양끝이 스크린 쪽으로 휘는 정도 (0이면 일자) */
    curve: number
  }
  /** 1인 소파 색 */
  sofaColor: string
  /** 조명(벽등, 스탠드) 빛 색 */
  lampColor: string
  /** 양옆 벽에 붙은 벽등 */
  wallLamps: {
    /** 벽등이 붙는 x 위치 (양옆 벽 안쪽 면) */
    wallX: number
    /** 벽등 z 위치들 (양쪽 벽에 똑같이) */
    z: readonly number[]
    height: number
    intensity: number
  }
  /** 키 큰 스탠드 조명 위치 */
  floorLamps: readonly PlanPosition[]
  /** 삼각대 스피커 위치 */
  speakers: readonly PlanPosition[]
}
