import type { RoomIntroConfig } from './types.ts'

/** One source of room-introduction content; additional section introductions can join this array later. */
export const SAMPLE_ROOM_INTROS: readonly RoomIntroConfig[] = [
  {
    id: 'gallery-one-introduction',
    roomName: '전시실 1',
    title: '천천히, 오래 보는 일',
    paragraphs: [
      '우리는 하루에도 수백 장의 사진을 넘겨 봅니다. 손끝으로 밀어내는 사이, 사진 속 빛과 그림자는 눈에 닿기도 전에 지나가 버리곤 합니다.',
      '이 방은 그 속도를 잠시 늦추기 위한 곳입니다. 벽에 걸린 사진들은 특별한 사건보다 평범한 순간을 담고 있습니다. 창가에 머문 오후의 빛, 아무도 앉지 않은 의자, 누군가 지나간 뒤의 골목처럼요.',
      '한 장의 사진 앞에 조금 더 오래 머물러 보세요. 처음에는 보이지 않던 색과 결, 찍은 사람이 그 자리에 서 있던 이유가 천천히 드러날지도 모릅니다.',
      '다른 관람객과 같은 사진 앞에 나란히 서게 된다면, 말 대신 작은 마음을 남겨 주세요. 같은 장면을 함께 바라보는 것만으로도 충분합니다.',
    ],
    placement: {
      wallId: 'wall-partition-east-stagger',
      side: 'front',
      offsetX: 1.65,
      centerHeight: 3.3,
    },
    width: 3.25,
  },
]
