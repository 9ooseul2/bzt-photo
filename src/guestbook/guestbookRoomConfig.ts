import type { ExhibitionRoomConfig } from '../scenes/exhibition/types.ts'
import { GUESTBOOK_ROOM_DIMENSIONS } from './GuestbookPlacement.ts'

const { depth, wallHeight, width } = GUESTBOOK_ROOM_DIMENSIONS

/** Independent room plan for the personal guestbook viewing experience. */
export const GUESTBOOK_ROOM_CONFIG: ExhibitionRoomConfig = {
  id: 'guestbook-gallery',
  dimensions: { width, depth, wallHeight },
  wallThickness: 0.28,
  floor: { id: 'guestbook-floor', color: '#aaa69c' },
  ceiling: { id: 'guestbook-ceiling', height: wallHeight, thickness: 0.28, color: '#f3eee2' },
  spawnPoint: { x: 0, z: 7.3 },
  exteriorWalls: [
    { id: 'guestbook-wall-north', position: { x: 0, z: -depth / 2 }, length: width, rotationY: 0 },
    { id: 'guestbook-wall-west', position: { x: -width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
    { id: 'guestbook-wall-east', position: { x: width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
    { id: 'guestbook-wall-south', position: { x: 0, z: depth / 2 }, length: width, rotationY: 0 },
  ],
  partitions: [],
  entrance: {
    id: 'guestbook-entrance',
    // Navigation is handled by UI for now, so the structural doorway stays visually minimal.
    position: { x: 0, z: depth / 2 },
    width: 0.1,
    height: 0.1,
    rotationY: 0,
  },
}
