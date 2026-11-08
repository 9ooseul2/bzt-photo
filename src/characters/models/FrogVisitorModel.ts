import {
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Material,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import type { CharacterAnimationState, CharacterVisual } from '../CharacterVisual.ts'
import type { VisitorCharacterConfig } from '../VisitorCharacter.ts'
import { createAccessoryModel } from '../customization/FrogAccessories.ts'
import { FROG_COLOR_VALUES, normalizeCustomization, type AccessorySlot, type FrogCustomization } from '../customization/types.ts'

/**
 * Dimensions that belong to the frog presentation, not to the path controller.
 * A future GLB visual should export a compatible CharacterVisual and can reuse
 * the collision and camera settings below.
 */
export const FROG_VISITOR_CONFIG: VisitorCharacterConfig & {
  emoteHeight: number
  groundOffset: number
  modelScale: number
  nicknameHeight: number
} = {
  // The original presentation scale (0.86) is reduced to 70% for this view.
  collisionRadius: 0.294,
  cameraTargetHeight: 1.25,
  emoteHeight: 1.93,
  // Compensates for the rounded feet's -0.01 local-unit resting extent.
  groundOffset: 0.00602,
  modelScale: 0.602,
  nicknameHeight: 1.62,
}

/** Anchor coordinates remain explicit so prototype meshes can later be replaced by GLB attachments. */
export const FROG_ACCESSORY_ANCHOR_CONFIG = {
  body: [0, 0.92, 0] as const,
  face: [0, 1.62, 0.5] as const,
  hand: [0, -0.3, 0.2] as const,
  head: [0, 2.14, 0.02] as const,
  neck: [0, 1.15, 0] as const,
}

const BODY_COLOR = '#b9e59a'
const BELLY_COLOR = '#fff7d8'
const BLUSH_COLOR = '#ffaaa7'
const FACE_COLOR = '#4a3932'

export interface FrogVisitorVisual extends CharacterVisual {
  applyCustomization(customization: FrogCustomization): void
  dispose(): void
  getCustomization(): FrogCustomization
}

function createRoundedPart(
  geometry: SphereGeometry,
  material: MeshStandardMaterial,
  position: Vector3,
  scale: Vector3,
): Mesh<SphereGeometry, MeshStandardMaterial> {
  const part = new Mesh(geometry, material)
  part.position.copy(position)
  part.scale.copy(scale)
  return part
}

/**
 * Builds the default toy-like frog from basic Three.js geometry. The model's
 * local forward direction is +Z, matching VisitorCharacter's facing logic.
 */
export function createFrogVisitorModel(initialCustomization?: FrogCustomization): FrogVisitorVisual {
  const model = new Group()
  model.name = 'frog-visitor-model'
  model.position.y = FROG_VISITOR_CONFIG.groundOffset
  model.scale.setScalar(FROG_VISITOR_CONFIG.modelScale)

  const bodyMaterial = new MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.78, metalness: 0 })
  const bellyMaterial = new MeshStandardMaterial({ color: BELLY_COLOR, roughness: 0.82, metalness: 0 })
  const blushMaterial = new MeshStandardMaterial({ color: BLUSH_COLOR, roughness: 0.9, metalness: 0 })
  const faceMaterial = new MeshStandardMaterial({ color: FACE_COLOR, roughness: 0.72, metalness: 0 })
  const sphere = new SphereGeometry(1, 24, 18)

  const body = createRoundedPart(
    sphere,
    bodyMaterial,
    new Vector3(0, 0.86, 0),
    new Vector3(0.57, 0.62, 0.43),
  )
  body.name = 'frog-body'

  const belly = createRoundedPart(
    sphere,
    bellyMaterial,
    new Vector3(0, 0.82, 0.405),
    new Vector3(0.34, 0.39, 0.045),
  )
  belly.name = 'frog-belly'

  const head = createRoundedPart(
    sphere,
    bodyMaterial,
    new Vector3(0, 1.57, 0.015),
    new Vector3(0.79, 0.59, 0.48),
  )
  head.name = 'frog-head'

  const leftEyeBump = createRoundedPart(
    sphere,
    bodyMaterial,
    new Vector3(-0.38, 1.98, 0.005),
    new Vector3(0.31, 0.31, 0.32),
  )
  const rightEyeBump = leftEyeBump.clone()
  rightEyeBump.position.x *= -1
  leftEyeBump.name = 'frog-left-eye-bump'
  rightEyeBump.name = 'frog-right-eye-bump'

  const eyeGeometry = new SphereGeometry(1, 16, 12)
  const leftEye = createRoundedPart(
    eyeGeometry,
    faceMaterial,
    new Vector3(-0.32, 1.72, 0.456),
    new Vector3(0.073, 0.083, 0.047),
  )
  const rightEye = leftEye.clone()
  rightEye.position.x *= -1
  leftEye.name = 'frog-left-eye'
  rightEye.name = 'frog-right-eye'

  const leftCheek = createRoundedPart(
    sphere,
    blushMaterial,
    new Vector3(-0.52, 1.45, 0.448),
    new Vector3(0.17, 0.13, 0.035),
  )
  const rightCheek = leftCheek.clone()
  rightCheek.position.x *= -1
  leftCheek.name = 'frog-left-cheek'
  rightCheek.name = 'frog-right-cheek'

  const mouthCurve = new CatmullRomCurve3([
    new Vector3(-0.075, 1.61, 0.49),
    new Vector3(0.045, 1.66, 0.49),
    new Vector3(0.095, 1.60, 0.49),
    new Vector3(0.005, 1.55, 0.49),
    new Vector3(0.098, 1.49, 0.49),
    new Vector3(0.04, 1.43, 0.49),
    new Vector3(-0.075, 1.48, 0.49),
  ])
  const mouth = new Mesh(new TubeGeometry(mouthCurve, 28, 0.022, 8, false), faceMaterial)
  mouth.name = 'frog-three-mouth'

  const leftHip = new Group()
  leftHip.name = 'frog-left-leg-pivot'
  leftHip.position.set(-0.25, 0.42, 0.035)
  const leftLeg = createRoundedPart(
    sphere,
    bodyMaterial,
    new Vector3(0, -0.12, 0.08),
    new Vector3(0.24, 0.31, 0.28),
  )
  leftHip.add(leftLeg)

  const rightHip = new Group()
  rightHip.name = 'frog-right-leg-pivot'
  rightHip.position.set(0.25, 0.42, 0.035)
  const rightLeg = leftLeg.clone()
  rightHip.add(rightLeg)

  const leftShoulder = new Group()
  leftShoulder.name = 'frog-left-arm-pivot'
  leftShoulder.position.set(-0.55, 1.02, 0.025)
  const leftArm = createRoundedPart(
    sphere,
    bodyMaterial,
    new Vector3(0, -0.12, 0.045),
    new Vector3(0.18, 0.28, 0.2),
  )
  leftShoulder.add(leftArm)

  const rightShoulder = new Group()
  rightShoulder.name = 'frog-right-arm-pivot'
  rightShoulder.position.set(0.55, 1.02, 0.025)
  const rightArm = leftArm.clone()
  rightShoulder.add(rightArm)

  const headAnchor = new Group()
  headAnchor.name = 'frog-head-anchor'
  headAnchor.position.set(...FROG_ACCESSORY_ANCHOR_CONFIG.head)
  const faceAnchor = new Group()
  faceAnchor.name = 'frog-face-anchor'
  faceAnchor.position.set(...FROG_ACCESSORY_ANCHOR_CONFIG.face)
  const neckAnchor = new Group()
  neckAnchor.name = 'frog-neck-anchor'
  // Neck accessories use a centred anchor so their bands are visible from front and back.
  neckAnchor.position.set(...FROG_ACCESSORY_ANCHOR_CONFIG.neck)
  const bodyAnchor = new Group()
  bodyAnchor.name = 'frog-body-anchor'
  bodyAnchor.position.set(...FROG_ACCESSORY_ANCHOR_CONFIG.body)
  const handAnchor = new Group()
  handAnchor.name = 'frog-hand-anchor'
  handAnchor.position.set(...FROG_ACCESSORY_ANCHOR_CONFIG.hand)
  rightShoulder.add(handAnchor)

  model.add(
    body,
    belly,
    head,
    leftEyeBump,
    rightEyeBump,
    leftEye,
    rightEye,
    leftCheek,
    rightCheek,
    mouth,
    leftHip,
    rightHip,
    leftShoulder,
    rightShoulder,
    headAnchor,
    faceAnchor,
    neckAnchor,
    bodyAnchor,
  )
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  let gaitTime = 0
  let walkBlend = 0
  let customization = normalizeCustomization(initialCustomization)
  const anchors: Record<AccessorySlot, Group> = {
    head: headAnchor, face: faceAnchor, neck: neckAnchor, hand: handAnchor,
  }

  const clearAnchor = (anchor: Group): void => {
    anchor.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose()
    })
    anchor.clear()
  }

  const applyCustomization = (nextCustomization: FrogCustomization): void => {
    customization = normalizeCustomization(nextCustomization)
    bodyMaterial.color.set(FROG_COLOR_VALUES[customization.color].value)
    clearAnchor(bodyAnchor)
    for (const slot of ['head', 'face', 'neck', 'hand'] as const) {
      const anchor = anchors[slot]
      clearAnchor(anchor)
      const accessory = customization[slot]
      if (!accessory) continue
      const targetAnchor = accessory === 'crossbody_bag' ? bodyAnchor : anchor
      targetAnchor.add(createAccessoryModel(accessory))
    }
  }

  applyCustomization(customization)

  return {
    root: model,
    applyCustomization,
    getCustomization(): FrogCustomization { return { ...customization } },
    dispose(): void {
      for (const anchor of Object.values(anchors)) clearAnchor(anchor)
      clearAnchor(bodyAnchor)
      const geometries = new Set<BufferGeometry>()
      const materials = new Set<Material>()
      model.traverse((object) => {
        if (object instanceof Mesh) {
          geometries.add(object.geometry)
          const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
          for (const material of meshMaterials) materials.add(material)
        }
      })
      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
    },
    updateAnimation(deltaSeconds: number, state: CharacterAnimationState): void {
      const blend = 1 - Math.exp(-10 * deltaSeconds)
      walkBlend += ((state.isWalking ? 1 : 0) - walkBlend) * blend

      if (state.isWalking) {
        gaitTime += deltaSeconds * Math.max(5.2, state.movementSpeed * 2.65)
      }

      const legSwing = Math.sin(gaitTime) * 0.28 * walkBlend
      const armSwing = legSwing * 0.7
      const bodyBob = Math.abs(Math.sin(gaitTime)) * 0.018 * walkBlend

      leftHip.rotation.x = legSwing
      rightHip.rotation.x = -legSwing
      leftShoulder.rotation.x = -armSwing
      rightShoulder.rotation.x = armSwing
      body.position.y = 0.86 + bodyBob
      belly.position.y = 0.82 + bodyBob
    },
  }
}
