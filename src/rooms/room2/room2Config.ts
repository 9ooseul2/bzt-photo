import type { ExhibitionRoomConfig } from '../../scenes/exhibition/types.ts'

const width = 28
const depth = 24
const wallHeight = 6.4

/**
 * A three-corridor ㄹ plan. The partition endpoints meet their exterior walls
 * at the wall centre lines, so collision geometry has no navigable seam.
 */
export const ROOM_2_CONFIG: ExhibitionRoomConfig = {
  id: 'room-2',
  displayName: '전시실 2',
  dimensions: { width, depth, wallHeight },
  wallThickness: 0.28,
  floor: { id: 'room2-floor', color: '#9e9d97' },
  ceiling: { id: 'room2-ceiling', height: wallHeight, thickness: 0.28, color: '#f3eee2' },
  // Matches the approach point of room 1's north-west room-transfer door.
  spawnPoint: { x: -12.8, z: -8.282 },
  exteriorWalls: [
    { id: 'room2-wall-north', position: { x: 0, z: -depth / 2 }, length: width, rotationY: 0 },
    { id: 'room2-wall-south', position: { x: 0, z: depth / 2 }, length: width, rotationY: 0 },
    { id: 'room2-wall-west', position: { x: -width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
    { id: 'room2-wall-east', position: { x: width / 2, z: 0 }, length: depth, rotationY: Math.PI / 2 },
  ],
  partitions: [
    {
      id: 'room2-partition-a',
      position: { x: -3, z: -4 },
      length: 22,
      rotationY: 0,
      artworkSides: ['front', 'back'],
    },
    {
      id: 'room2-partition-b',
      position: { x: 3, z: 4 },
      length: 22,
      rotationY: 0,
      artworkSides: ['front', 'back'],
    },
  ],
  entrance: {
    id: 'room2-formal-entrance',
    // Room transfers use portals; this only fulfils the shared room contract.
    position: { x: 0, z: depth / 2 },
    width: 0.1,
    height: 0.1,
    rotationY: 0,
  },
}
