import { SAMPLE_ARTWORKS } from '../scenes/exhibition/artworks/sampleArtworks.ts'
import { SAMPLE_EXHIBITION_CONFIG } from '../scenes/exhibition/sampleExhibitionConfig.ts'
import { SAMPLE_ROOM_INTROS } from '../scenes/exhibition/roomIntro/roomIntroConfig.ts'
import { EXHIBITION_PORTALS } from '../scenes/portals/portalConfig.ts'
import { ROOM_2_CONFIG } from './room2/room2Config.ts'
import { ROOM_2_APPEARANCE, ROOM_2_ARTWORKS, ROOM_2_INTROS, ROOM_2_LIGHTING, ROOM_2_PROPS } from './room2/room2Content.ts'
import type { ExhibitionRoomDefinition } from './types.ts'
import { VIDEO_ROOM_APPEARANCE, VIDEO_ROOM_CINEMA, VIDEO_ROOM_CONFIG, VIDEO_ROOM_LIGHTING, VIDEO_ROOM_PORTALS } from './videoRoom/videoRoomConfig.ts'

const ROOM_1: ExhibitionRoomDefinition = {
  id: 'room-1',
  displayName: '전시실 1',
  config: SAMPLE_EXHIBITION_CONFIG,
  portals: EXHIBITION_PORTALS,
  artworks: SAMPLE_ARTWORKS,
  intros: SAMPLE_ROOM_INTROS,
}

const ROOM_2: ExhibitionRoomDefinition = {
  id: 'room-2',
  displayName: '전시실 2',
  config: ROOM_2_CONFIG,
  // For a wall with rotationY = π/2, positive local X maps to world -Z.
  portals: [
    { id: 'to-room-1', wallId: 'room2-wall-west', offsetX: 8, label: '전시실 1', action: 'go-to-room', targetRoomId: 'room-1' },
    { id: 'to-guestbook', wallId: 'room2-wall-east', offsetX: -8, label: '방명록 남기기', action: 'enter-guestbook' },
    { id: 'to-video-room', wallId: 'room2-wall-east', offsetX: 8, label: '영상관', action: 'go-to-room', targetRoomId: 'video-room' },
  ],
  artworks: ROOM_2_ARTWORKS,
  intros: ROOM_2_INTROS,
  appearance: ROOM_2_APPEARANCE,
  lighting: ROOM_2_LIGHTING,
  props: ROOM_2_PROPS,
}

const VIDEO_ROOM: ExhibitionRoomDefinition = {
  id: 'video-room',
  displayName: '영상관',
  config: VIDEO_ROOM_CONFIG,
  portals: VIDEO_ROOM_PORTALS,
  artworks: [],
  intros: [],
  appearance: VIDEO_ROOM_APPEARANCE,
  lighting: VIDEO_ROOM_LIGHTING,
  cinema: VIDEO_ROOM_CINEMA,
}

/** The only list that needs an entry when a new exhibition room is added. */
export const EXHIBITION_ROOMS: readonly ExhibitionRoomDefinition[] = [ROOM_1, ROOM_2, VIDEO_ROOM]

export function getExhibitionRoom(roomId: string): ExhibitionRoomDefinition | undefined {
  return EXHIBITION_ROOMS.find((room) => room.id === roomId)
}
