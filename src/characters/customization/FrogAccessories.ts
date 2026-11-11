import {
  BufferGeometry,
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { AccessoryId } from './types.ts'

const cream = new MeshStandardMaterial({ color: '#fff0cb', roughness: 0.8 })
const knit = new MeshStandardMaterial({ color: '#e7c9a2', roughness: 0.88 })
const pink = new MeshStandardMaterial({ color: '#eaa9b5', roughness: 0.78 })
const brown = new MeshStandardMaterial({ color: '#6d5043', roughness: 0.75 })
const charcoal = new MeshStandardMaterial({ color: '#34383b', roughness: 0.68 })
const softGray = new MeshStandardMaterial({ color: '#c9c6c1', roughness: 0.76 })
const beige = new MeshStandardMaterial({ color: '#d9c5a7', roughness: 0.82 })
const red = new MeshStandardMaterial({ color: '#b85955', roughness: 0.76 })
const gold = new MeshStandardMaterial({ color: '#d6964b', roughness: 0.78 })
const bubblePink = new MeshStandardMaterial({ color: '#f4c4d6', roughness: 0.25, transparent: true, opacity: 0.82 })
const bookCover = new MeshStandardMaterial({ color: '#6e86a2', roughness: 0.74 })
const page = new MeshStandardMaterial({ color: '#fff6df', roughness: 0.86 })
const dark = new MeshStandardMaterial({ color: '#3d302a', roughness: 0.82 })
const sphere = new SphereGeometry(1, 16, 12)

function mesh(geometry: BufferGeometry, material: MeshStandardMaterial): Mesh {
  const result = new Mesh(geometry, material)
  result.castShadow = true
  result.receiveShadow = true
  return result
}

/**
 * Basic-geometry prototypes keyed by stable IDs. Each branch can be swapped
 * for a matching GLB factory without changing character anchors or state.
 */
export function createAccessoryModel(id: AccessoryId): Group {
  const group = new Group()
  group.name = `frog-accessory-${id}`

  if (id === 'beanie') {
    const crown = mesh(sphere, knit); crown.scale.set(0.51, 0.28, 0.46); crown.position.y = 0.09
    const foldedBand = mesh(new TorusGeometry(0.42, 0.072, 8, 20), cream); foldedBand.rotation.x = Math.PI / 2; foldedBand.position.y = -0.08
    const pom = mesh(sphere, cream); pom.scale.setScalar(0.12); pom.position.y = 0.34
    group.add(crown, foldedBand, pom)
  } else if (id === 'headset') {
    const headband = mesh(new TubeGeometry(new CatmullRomCurve3([
      new Vector3(-0.62, -0.1, 0.08), new Vector3(-0.48, 0.36, 0.1), new Vector3(0, 0.56, 0.1),
      new Vector3(0.48, 0.36, 0.1), new Vector3(0.62, -0.1, 0.08),
    ]), 24, 0.045, 8, false), cream)
    headband.name = 'headband'
    const leftCup = mesh(sphere, softGray); leftCup.name = 'left-ear-cup'; leftCup.scale.set(0.19, 0.24, 0.15); leftCup.position.set(-0.62, -0.13, 0.04)
    const rightCup = leftCup.clone(); rightCup.position.x *= -1
    rightCup.name = 'right-ear-cup'
    const leftPad = mesh(sphere, charcoal); leftPad.scale.set(0.12, 0.16, 0.045); leftPad.position.set(-0.62, -0.13, 0.16)
    const rightPad = leftPad.clone(); rightPad.position.x *= -1
    const leftStar = createStar(); leftStar.name = 'left-star'; leftStar.position.set(-0.81, -0.13, 0.04); leftStar.rotation.y = -Math.PI / 2
    const rightStar = createStar(); rightStar.name = 'right-star'; rightStar.position.set(0.81, -0.13, 0.04); rightStar.rotation.y = Math.PI / 2
    group.add(headband, leftCup, rightCup, leftPad, rightPad, leftStar, rightStar)
  } else if (id === 'cap') {
    const crown = mesh(sphere, red); crown.scale.set(0.5, 0.23, 0.44); crown.position.y = 0.08
    const brim = mesh(sphere, red); brim.scale.set(0.34, 0.035, 0.22); brim.position.set(0, -0.035, 0.42)
    const topButton = mesh(sphere, cream); topButton.scale.setScalar(0.045); topButton.position.y = 0.31
    group.add(crown, brim, topButton)
  } else if (id === 'glasses') {
    const left = mesh(new TorusGeometry(0.135, 0.018, 6, 16), brown); left.position.set(-0.25, 0.02, 0)
    const right = left.clone(); right.position.x *= -1
    const bridge = mesh(new BoxGeometry(0.22, 0.024, 0.024), brown); bridge.position.y = 0.02
    const leftArm = mesh(new BoxGeometry(0.15, 0.018, 0.018), brown); leftArm.position.set(-0.38, 0.02, -0.05); leftArm.rotation.y = 0.35
    const rightArm = leftArm.clone(); rightArm.position.x *= -1; rightArm.rotation.y *= -1
    group.add(left, right, bridge, leftArm, rightArm)
  } else if (id === 'sunglasses') {
    // Placeholder until sunglasses.glb exists: two narrow dark lenses and a bridge.
    const left = mesh(new BoxGeometry(0.26, 0.11, 0.03), charcoal); left.position.set(-0.24, 0.03, 0.02)
    const right = left.clone(); right.position.x *= -1
    const bridge = mesh(new BoxGeometry(0.2, 0.018, 0.018), charcoal); bridge.position.y = 0.06
    group.add(left, right, bridge)
  } else if (id === 'bubble_gum') {
    // Placeholder until bubble_gum.glb exists: a translucent pink bubble in front of the mouth.
    const bubble = mesh(sphere, bubblePink); bubble.scale.setScalar(0.18); bubble.position.set(0, -0.2, 0.16)
    group.add(bubble)
  } else if (id === 'scarf') {
    const band = createNeckBand(pink)
    const tail = mesh(new BoxGeometry(0.15, 0.4, 0.06), pink); tail.position.set(0.16, -0.25, 0.43); tail.rotation.z = -0.18
    const tailEnd = mesh(sphere, pink); tailEnd.scale.set(0.08, 0.1, 0.035); tailEnd.position.set(0.21, -0.45, 0.43)
    group.add(band, tail, tailEnd)
  } else if (id === 'crossbody_bag') {
    group.name = 'frog-accessory-crossbody-bag'
    // Frog-local +Z is the front. The strap starts at its right shoulder (viewer left)
    // and reaches its left waist (viewer right), then continues over the back.
    const frontStrap = createStrapPath([new Vector3(-0.38, 0.45, 0.5), new Vector3(-0.08, 0.16, 0.52), new Vector3(0.36, -0.25, 0.52)]); frontStrap.name = 'front-strap'
    const shoulderStrap = createStrapPath([new Vector3(-0.38, 0.45, 0.5), new Vector3(-0.55, 0.48, 0), new Vector3(-0.5, 0.43, -0.46)]); shoulderStrap.name = 'shoulder-segment'
    const backStrap = createStrapPath([new Vector3(-0.5, 0.43, -0.46), new Vector3(-0.08, 0.13, -0.5), new Vector3(0.36, -0.25, -0.5)]); backStrap.name = 'back-strap'
    const bagBody = mesh(new BoxGeometry(0.35, 0.24, 0.145), beige); bagBody.name = 'bag-body'; bagBody.position.set(0.38, -0.27, 0.53)
    const bagFlap = mesh(new BoxGeometry(0.34, 0.115, 0.03), cream); bagFlap.name = 'bag-flap'; bagFlap.position.set(0.38, -0.19, 0.615)
    const clasp = mesh(sphere, gold); clasp.name = 'clasp'; clasp.scale.set(0.035, 0.035, 0.02); clasp.position.set(0.38, -0.225, 0.637)
    group.add(frontStrap, backStrap, shoulderStrap, bagBody, bagFlap, clasp)
  } else if (id === 'bow_tie') {
    const band = createNeckBand(cream)
    const center = mesh(sphere, gold); center.scale.set(0.07, 0.07, 0.048); center.position.z = 0.45
    const left = mesh(sphere, red); left.scale.set(0.16, 0.1, 0.05); left.position.set(-0.14, 0, 0.45)
    const right = left.clone(); right.position.x *= -1
    group.add(band, center, left, right)
  } else if (id === 'balloon') {
    const string = createStrapSegment(new Vector3(0.02, 0.02, 0.08), new Vector3(0.25, 0.61, 0.18), 0.009); string.name = 'balloon-string'
    const balloon = mesh(sphere, red); balloon.scale.set(0.16, 0.23, 0.145); balloon.position.set(0.3, 0.86, 0.2)
    const knot = mesh(sphere, gold); knot.scale.set(0.032, 0.04, 0.025); knot.position.set(0.25, 0.61, 0.18)
    group.add(string, balloon, knot)
  } else if (id === 'americano') {
    // Placeholder until americano.glb exists: a dark cup with a green straw.
    const cup = mesh(new CylinderGeometry(0.12, 0.09, 0.3, 16), dark); cup.position.set(0, 0.05, 0.18)
    const straw = mesh(new CylinderGeometry(0.012, 0.012, 0.22, 8), cream); straw.position.set(0.03, 0.26, 0.18); straw.rotation.z = -0.2
    group.add(cup, straw)
  } else if (id === 'book') {
    const cover = mesh(new BoxGeometry(0.4, 0.285, 0.1), bookCover)
    const pages = mesh(new BoxGeometry(0.34, 0.225, 0.104), page); pages.position.z = 0.004
    const spine = mesh(new BoxGeometry(0.05, 0.29, 0.115), red); spine.position.x = -0.2
    const frontCover = mesh(new BoxGeometry(0.385, 0.27, 0.015), bookCover); frontCover.position.z = 0.06
    group.add(cover, pages, spine, frontCover)
  }
  return group
}

function createNeckBand(material: MeshStandardMaterial): Mesh {
  const band = mesh(new TorusGeometry(0.45, 0.052, 8, 24), material)
  // The torus plane is rotated into XZ so it encircles the neck's Y axis.
  band.rotation.x = Math.PI / 2
  return band
}

function createStrapSegment(start: Vector3, end: Vector3, radius = 0.026): Mesh {
  const direction = new Vector3().subVectors(end, start)
  const strap = mesh(new CylinderGeometry(radius, radius, direction.length(), 8), beige)
  strap.position.copy(start).add(end).multiplyScalar(0.5)
  strap.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  return strap
}

function createStrapPath(points: readonly Vector3[]): Mesh {
  const path = new CatmullRomCurve3([...points])
  const strap = mesh(new TubeGeometry(path, 24, 0.032, 8, false), beige)
  strap.castShadow = true
  return strap
}

function createStar(): Mesh {
  const shape = new Shape()
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 0.09 : 0.04
    const angle = -Math.PI / 2 + index * (Math.PI / 5)
    const point = new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius)
    if (index === 0) shape.moveTo(point.x, point.y)
    else shape.lineTo(point.x, point.y)
  }
  shape.closePath()
  const star = mesh(new ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }), cream)
  star.castShadow = true
  return star
}
