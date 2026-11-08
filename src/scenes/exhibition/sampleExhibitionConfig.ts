import type { ExhibitionRoomConfig } from './types.ts'

const roomWidth = 30
const roomDepth = 20
const wallHeight = 6.4
const entranceWidth = 3.6
const entranceX = 8.4
const southWallZ = roomDepth / 2

/**
 * Sample gallery plan. Every number in this file is intentionally editable:
 * changing the room dimensions or wall list and rebuilding the room updates
 * its mesh layout and future navigation input together.
 */
export const SAMPLE_EXHIBITION_CONFIG: ExhibitionRoomConfig = {
  id: 'sample-l-route-gallery',
  displayName: '전시실 1',
  dimensions: {
    width: roomWidth,
    depth: roomDepth,
    wallHeight,
  },
  wallThickness: 0.28,
  floor: {
    id: 'gallery-floor',
    color: '#9e9d97',
  },
  ceiling: {
    id: 'gallery-ceiling',
    height: wallHeight,
    thickness: 0.28,
    color: '#f3eee2',
  },
  // Starts just inside the entrance, facing into the gallery.
  spawnPoint: { x: 10.4, z: 7.1 },
  exteriorWalls: [
    {
      id: 'wall-exterior-north',
      position: { x: 0, z: -roomDepth / 2 },
      length: roomWidth,
      rotationY: 0,
    },
    {
      id: 'wall-exterior-west',
      position: { x: -roomWidth / 2, z: 0 },
      length: roomDepth,
      rotationY: Math.PI / 2,
    },
    {
      id: 'wall-exterior-east',
      position: { x: roomWidth / 2, z: 0 },
      length: roomDepth,
      rotationY: Math.PI / 2,
    },
    {
      id: 'wall-exterior-south-west',
      position: { x: (entranceX - entranceWidth / 2 - roomWidth / 2) / 2, z: southWallZ },
      length: entranceX - entranceWidth / 2 + roomWidth / 2,
      rotationY: 0,
    },
    {
      id: 'wall-exterior-south-east',
      position: { x: (entranceX + entranceWidth / 2 + roomWidth / 2) / 2, z: southWallZ },
      length: roomWidth / 2 - (entranceX + entranceWidth / 2),
      rotationY: 0,
    },
  ],
  partitions: [
    {
      id: 'wall-partition-west-gallery',
      position: { x: -5.5, z: 0.4 },
      length: 12.8,
      rotationY: Math.PI / 2,
      artworkSides: ['front', 'back'],
    },
    {
      id: 'wall-partition-south-gallery',
      position: { x: 0.25, z: -6 },
      length: 11.5,
      rotationY: 0,
      artworkSides: ['front', 'back'],
    },
    {
      id: 'wall-partition-east-stagger',
      position: { x: 6.2, z: 0.6 },
      length: 8.7,
      rotationY: Math.PI / 2,
      artworkSides: ['front', 'back'],
    },
    {
      id: 'wall-partition-north-stagger',
      position: { x: 1.5, z: 5.8 },
      length: 8,
      rotationY: 0,
      artworkSides: ['front', 'back'],
    },
  ],
  entrance: {
    id: 'gallery-main-entrance',
    position: { x: entranceX, z: southWallZ },
    width: entranceWidth,
    height: 3.8,
    rotationY: 0,
  },
}
