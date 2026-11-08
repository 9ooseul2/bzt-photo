import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three'
import { ExhibitionWall } from '../ExhibitionWall.ts'
import type { RoomPropConfig, WallNotesPropConfig } from './types.ts'

const NOTE_COLORS = ['#f5edcf', '#f7f6f1', '#f6dfc4', '#f4dce0', '#dceaf0']
const BOOK_COLORS = ['#7e5f4b', '#38485c', '#777675', '#d9d0bd']

/** All primitive visual construction remains in this file for a future GLB swap. */
export function createRoomProp(config: RoomPropConfig, walls: ReadonlyMap<string, ExhibitionWall>): Group | undefined {
  switch (config.kind) {
    case 'bookshelf-black': return createBlackBookshelf(config)
    case 'bookshelf-white': return createWhiteBookshelf(config)
    case 'floor-lamp': return createFloorLamp(config)
    case 'wall-notes': return createWallNotes(config, walls.get(config.wallId))
  }
}

function createBlackBookshelf(config: Extract<RoomPropConfig, { kind: 'bookshelf-black' }>): Group {
  const width = config.width ?? 0.9
  const height = config.height ?? 1.9
  const depth = config.depth ?? 0.35
  const root = positionedRoot(config.id, config.position, config.rotationY)
  const frameMaterial = new MeshStandardMaterial({ color: '#242526', roughness: 0.72, metalness: 0.45 })
  const bookMaterials = BOOK_COLORS.map((color) => new MeshStandardMaterial({ color, roughness: 0.88, metalness: 0 }))
  const postGeometry = new BoxGeometry(0.038, height, 0.038)
  const shelfGeometry = new BoxGeometry(width, 0.034, depth)

  for (const x of [-width / 2 + 0.03, width / 2 - 0.03]) {
    for (const z of [-depth / 2 + 0.03, depth / 2 - 0.03]) {
      const post = new Mesh(postGeometry, frameMaterial)
      post.position.set(x, height / 2, z)
      root.add(post)
    }
  }

  const shelfHeights = [0.12, 0.48, 0.84, 1.2, 1.56, 1.88]
  for (const y of shelfHeights) {
    const shelf = new Mesh(shelfGeometry, frameMaterial)
    shelf.position.y = y
    root.add(shelf)
  }

  for (let shelfIndex = 0; shelfIndex < shelfHeights.length - 1; shelfIndex += 1) {
    if (shelfIndex === 3) continue
    const bookCount = shelfIndex === 1 ? 4 : 6
    for (let index = 0; index < bookCount; index += 1) {
      if (shelfIndex === 2 && index === 4) continue
      const bookWidth = 0.065 + ((index * 17 + shelfIndex * 11) % 3) * 0.017
      const bookHeight = 0.19 + ((index * 13 + shelfIndex * 7) % 4) * 0.032
      const bookDepth = 0.13 + ((index + shelfIndex) % 2) * 0.025
      const book = new Mesh(new BoxGeometry(bookWidth, bookHeight, bookDepth), bookMaterials[(index + shelfIndex) % bookMaterials.length])
      book.position.set(-width / 2 + 0.09 + index * (bookWidth + 0.018), shelfHeights[shelfIndex] + 0.018 + bookHeight / 2, -0.025)
      book.rotation.z = ((index + shelfIndex) % 3 - 1) * 0.035
      root.add(book)
    }
  }

  const storageBox = new Mesh(new BoxGeometry(width * 0.42, 0.18, depth * 0.7), bookMaterials[1])
  storageBox.position.set(width * 0.16, 1.38, 0)
  root.add(storageBox)
  return root
}

function createWhiteBookshelf(config: Extract<RoomPropConfig, { kind: 'bookshelf-white' }>): Group {
  const width = config.width ?? 0.8
  const height = config.height ?? 1.6
  const depth = config.depth ?? 0.32
  const root = positionedRoot(config.id, config.position, config.rotationY)
  const frameMaterial = new MeshStandardMaterial({ color: '#eeeeea', roughness: 0.86, metalness: 0 })
  const bookMaterials = ['#c9b79a', '#adbbc8', '#cfaeb0', '#d8d3c5'].map((color) => new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }))
  const sideGeometry = new BoxGeometry(0.035, height, depth)
  const shelfGeometry = new BoxGeometry(width, 0.035, depth)

  for (const x of [-width / 2 + 0.018, width / 2 - 0.018]) {
    const side = new Mesh(sideGeometry, frameMaterial)
    side.position.set(x, height / 2, 0)
    root.add(side)
  }
  for (const y of [0.1, 0.56, 1.02, 1.48]) {
    const shelf = new Mesh(shelfGeometry, frameMaterial)
    shelf.position.y = y
    root.add(shelf)
  }

  for (let index = 0; index < 7; index += 1) {
    const widthValue = 0.1 + (index % 3) * 0.025
    const heightValue = 0.19 + (index % 2) * 0.05
    const book = new Mesh(new BoxGeometry(widthValue, heightValue, 0.024), bookMaterials[index % bookMaterials.length])
    book.position.set(-0.25 + index * 0.082, 1.04 + heightValue / 2, -depth / 2 - 0.02)
    book.rotation.z = -0.22 + (index % 4) * 0.11
    root.add(book)
  }
  return root
}

function createFloorLamp(config: Extract<RoomPropConfig, { kind: 'floor-lamp' }>): Group {
  const height = config.height ?? 1.7
  const root = positionedRoot(config.id, config.position, config.rotationY)
  const black = new MeshStandardMaterial({ color: '#242526', roughness: 0.65, metalness: 0.5 })
  const shadeMaterial = new MeshStandardMaterial({ color: '#f4d39f', emissive: '#ffb963', emissiveIntensity: 0.45, roughness: 0.72, metalness: 0 })
  const base = new Mesh(new CylinderGeometry(0.23, 0.25, 0.045, 20), black)
  base.position.y = 0.0225
  const pole = new Mesh(new CylinderGeometry(0.025, 0.025, height - 0.32, 12), black)
  pole.position.y = (height - 0.32) / 2 + 0.045
  const shade = new Mesh(new SphereGeometry(0.27, 20, 12), shadeMaterial)
  shade.position.y = height - 0.19
  const bulb = new PointLight('#ffcf8a', 12, 5, 2)
  bulb.position.y = height - 0.24
  bulb.castShadow = false
  root.add(base, pole, shade, bulb)
  return root
}

function createWallNotes(config: WallNotesPropConfig, wall: ExhibitionWall | undefined): Group | undefined {
  if (!wall) {
    console.warn(`Wall notes "${config.id}" reference a missing wall and were skipped.`)
    return undefined
  }
  const width = config.width ?? 1.4
  const height = config.height ?? 1.15
  const root = new Group()
  root.name = `prop:${config.id}`
  wall.group.updateWorldMatrix(true, false)
  const wallCenter = wall.group.getWorldPosition(new Vector3())
  const localX = new Vector3(1, 0, 0).transformDirection(wall.group.matrixWorld)
  const forward = new Vector3(0, 0, 1).transformDirection(wall.group.matrixWorld)
  const backward = forward.clone().multiplyScalar(-1)
  const towardRoom = new Vector3(-wallCenter.x, 0, -wallCenter.z)
  const normal = forward.dot(towardRoom) >= backward.dot(towardRoom) ? forward : backward
  normal.y = 0
  normal.normalize()
  root.position.copy(wallCenter).addScaledVector(localX, config.offsetX).addScaledVector(normal, wall.config.thickness / 2 + 0.012)
  root.position.y = config.centerHeight ?? 3.25
  root.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal)

  const seed = hash(config.id)
  for (let index = 0; index < 12; index += 1) {
    const random = mulberry32(seed + index * 31)
    const noteWidth = 0.1 + random() * 0.15
    const noteHeight = 0.08 + random() * 0.13
    const note = new Mesh(
      new BoxGeometry(noteWidth, noteHeight, 0.008),
      new MeshStandardMaterial({ color: NOTE_COLORS[index % NOTE_COLORS.length], roughness: 0.92, metalness: 0 }),
    )
    note.position.set((random() - 0.5) * width, (random() - 0.5) * height, random() * 0.004)
    note.rotation.z = (random() - 0.5) * 0.22
    const pin = new Mesh(new SphereGeometry(0.013, 10, 8), new MeshStandardMaterial({ color: '#82786a', roughness: 0.62, metalness: 0.25 }))
    pin.position.set(note.position.x, note.position.y + noteHeight * 0.28, 0.012)
    root.add(note, pin)
  }
  return root
}

function positionedRoot(id: string, position: { x: number; z: number }, rotationY = 0): Group {
  const root = new Group()
  root.name = `prop:${id}`
  root.position.set(position.x, 0, position.z)
  root.rotation.y = rotationY
  return root
}

function hash(value: string): number {
  let output = 2166136261
  for (const character of value) {
    output ^= character.charCodeAt(0)
    output = Math.imul(output, 16777619)
  }
  return output >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
