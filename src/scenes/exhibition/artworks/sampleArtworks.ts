import type { ArtworkConfig } from './types.ts'

/**
 * One local source of exhibition content. The URLs deliberately remain valid
 * public paths even before the eventual sample image files are supplied.
 */
export const SAMPLE_ARTWORKS: readonly ArtworkConfig[] = [
  {
    id: 'sample-west-front', imageUrl: '/images/artworks/sample-01.jpg', title: '샘플 빛의 결', artist: '샘플 작가 A',
    comment: '벽을 따라 움직이는 오후의 빛을 담은 샘플 작품입니다.',
    placement: { wallId: 'wall-partition-west-gallery', side: 'front', offsetX: -3.2 }, width: 2.05, frameStyle: 'thin-wood',
  },
  {
    id: 'sample-west-back', imageUrl: '/images/artworks/sample-02.jpg', title: '샘플 산책', artist: '샘플 작가 B',
    comment: '느린 발걸음과 계절의 색을 위한 샘플 설명입니다.',
    placement: { wallId: 'wall-partition-west-gallery', side: 'back', offsetX: 3.1 }, width: 1.85, frameStyle: 'white-mat',
  },
  {
    id: 'sample-south-front', imageUrl: '/images/artworks/sample-03.jpg', title: '샘플 정물', artist: '샘플 작가 C',
    comment: '작고 고요한 사물을 바라보는 샘플 작품입니다.',
    placement: { wallId: 'wall-partition-south-gallery', side: 'front', offsetX: -3 }, width: 2.1, frameStyle: 'none',
  },
  {
    id: 'sample-south-back', imageUrl: '/images/artworks/sample-04.jpg', title: '샘플의 창', artist: '샘플 작가 D',
    comment: '창가의 공기와 그림자를 기록한 샘플 작품입니다.',
    placement: { wallId: 'wall-partition-south-gallery', side: 'back', offsetX: 3 }, width: 1.9, frameStyle: 'thin-wood',
  },
  {
    id: 'sample-east-front', imageUrl: '/images/artworks/sample-05.jpg', title: '샘플 물결', artist: '샘플 작가 E',
    comment: '반복되는 선과 잔잔한 리듬을 담은 샘플입니다.',
    placement: { wallId: 'wall-partition-east-stagger', side: 'front', offsetX: -2.05 }, width: 1.7, frameStyle: 'white-mat',
  },
  {
    id: 'sample-east-back', imageUrl: '/images/artworks/sample-06.jpg', title: '샘플 밤의 온도', artist: '샘플 작가 F',
    comment: '어두운 색 사이의 온기를 관찰하는 샘플 작품입니다.',
    placement: { wallId: 'wall-partition-east-stagger', side: 'back', offsetX: 2.05 }, width: 1.75, frameStyle: 'none',
  },
  {
    id: 'sample-north-front', imageUrl: '/images/artworks/sample-07.jpg', title: '샘플 들판', artist: '샘플 작가 G',
    comment: '넓은 여백과 낮은 수평선을 가진 샘플 작품입니다.',
    placement: { wallId: 'wall-partition-north-stagger', side: 'front', offsetX: -2.15 }, width: 1.75, frameStyle: 'thin-wood',
  },
  {
    id: 'sample-north-back', imageUrl: '/images/artworks/sample-08.jpg', title: '샘플 편지', artist: '샘플 작가 H',
    comment: '남겨진 문장과 손끝의 시간을 상상하는 샘플입니다.',
    placement: { wallId: 'wall-partition-north-stagger', side: 'back', offsetX: 2.1 }, width: 1.7, frameStyle: 'white-mat',
  },
]
