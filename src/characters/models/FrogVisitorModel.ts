import {
  BufferGeometry,
  CatmullRomCurve3,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { publicAsset } from '../../config/publicAsset.ts'
import type { CharacterAnimationState, CharacterVisual } from '../CharacterVisual.ts'
import type { VisitorCharacterConfig } from '../VisitorCharacter.ts'
import { createAccessoryModel } from '../customization/FrogAccessories.ts'
import { GLB_ACCESSORIES, loadAccessoryTemplate, preloadAccessoryTemplates } from '../customization/accessoryAssets.ts'
import {
  FROG_COLOR_VALUES,
  normalizeCustomization,
  type AccessoryId,
  type AccessorySlot,
  type FrogCustomization,
} from '../customization/types.ts'

/**
 * 캐릭터 크기. 숫자를 줄이면 작아진다 (0.602 = 처음 크기).
 * 이름표, 감정 표시 높이와 카메라가 바라보는 높이는 자동으로 따라간다.
 */
const MODEL_SCALE = 0.54
const ORIGINAL_MODEL_SCALE = 0.602
/** kkebook.glb 머리 꼭대기 높이 (모델 기준 단위) */
const KKEBOOK_HEAD_TOP = 2.13

/**
 * 걷기 동작 크기. 숫자를 키우면 더 크게 움직인다.
 * legSwing: 다리 앞뒤 흔들림(라디안), armSwing: 팔 흔들림(다리 대비 비율),
 * bob: 몸 위아래 들썩임, waddle: 좌우로 뒤뚱거림(라디안)
 */
export const WALK_ANIMATION = {
  legSwing: 0.6,
  armSwing: 0.9,
  bob: 0.05,
  waddle: 0.07,
}

/**
 * Dimensions that belong to the frog presentation, not to the path controller.
 * kkebook.glb is authored in the same local units as the original prototype frog,
 * so the same modelScale applies to both.
 */
export const FROG_VISITOR_CONFIG: VisitorCharacterConfig & {
  emoteHeight: number
  groundOffset: number
  modelScale: number
  nicknameHeight: number
} = {
  // The original presentation scale (0.86) is reduced to 70% for this view.
  collisionRadius: 0.294,
  // Keeps the same camera framing relative to the character when its size changes.
  cameraTargetHeight: 1.25 * (MODEL_SCALE / ORIGINAL_MODEL_SCALE),
  // Labels keep a fixed gap above kkebook's head top.
  emoteHeight: KKEBOOK_HEAD_TOP * MODEL_SCALE + 0.58,
  // kkebook's feet rest exactly on y = 0 (the prototype frog used 0.00602).
  groundOffset: 0,
  modelScale: MODEL_SCALE,
  nicknameHeight: KKEBOOK_HEAD_TOP * MODEL_SCALE + 0.27,
}

/** 꾸미기 화면 미리보기는 캐릭터 크기를 바꿔도 처음 크기로 보이게 하는 배율 */
export const FROG_PREVIEW_SCALE = ORIGINAL_MODEL_SCALE / MODEL_SCALE

/** Anchor coordinates for the prototype (fallback) frog built from basic geometry. */
export const FROG_ACCESSORY_ANCHOR_CONFIG = {
  body: [0, 0.92, 0] as const,
  face: [0, 1.62, 0.5] as const,
  hand: [0, -0.3, 0.2] as const,
  head: [0, 2.14, 0.02] as const,
  neck: [0, 1.15, 0] as const,
}

type AnchorKey = AccessorySlot | 'body'
type AnchorFit = { position?: readonly [number, number, number]; scale?: number }

/**
 * kkebook에 아직 GLB가 없는 (코드로 그린) 악세서리를 붙일 때의 보정값.
 * kkebook은 머리와 몸이 더 넓어서 일부 슬롯을 키우거나 옮긴다. 앵커 자체는 움직이지 않으므로
 * GLB 악세서리에는 영향을 주지 않는다.
 * position은 모델 기준 좌표로 그 악세서리를 놓을 위치, scale은 악세서리 크기 배율이다.
 */
export const KKEBOOK_ACCESSORY_FIT: Readonly<Record<AnchorKey, AnchorFit>> = {
  head: {},
  face: { scale: 1.25 },
  // 머리 아래 챙 바로 밑, 몸통 둘레에 맞춘 목 위치
  neck: { position: [0, 0.8, 0], scale: 1.22 },
  body: { scale: 1.15 },
  hand: {},
}

/** kkebook.glb 안의 입 3종 (kkebook-mouth-<id>). 한 번에 하나만 보인다. */
const KKEBOOK_MOUTHS = ['triangle', 'round', 'cat'] as const
type KkebookMouth = (typeof KKEBOOK_MOUTHS)[number]

/**
 * 얼굴 악세서리를 쓰면 바뀌는 입. 여기에 없으면 기본 세모 입.
 * 새 표정을 추가하려면 Blender 스크립트에 입을 만들고 KKEBOOK_MOUTHS와 여기에 이름을 넣는다.
 */
const MOUTH_FOR_ACCESSORY: Partial<Record<AccessoryId, KkebookMouth>> = {
  sunglasses: 'cat',
  bubble_gum: 'round',
}

/** 몸통 앵커(kkebook-body-anchor)에 붙는 악세서리. 나머지는 자기 슬롯 앵커에 붙는다. */
const BODY_ANCHORED: ReadonlySet<AccessoryId> = new Set<AccessoryId>(['crossbody_bag', 'book'])

/**
 * 책을 옆구리에 낄 때의 오른팔 자세 (어깨 기준 회전).
 * art/blender/kkebook_accessories.py의 book_arm_pose()와 같은 값 (Blender 좌표를 Three.js 좌표로 바꾼 축).
 * 이 자세인 동안 오른팔은 걸어도 흔들리지 않는다 (책이 몸에서 떨어지지 않게).
 */
const BOOK_ARM_POSE = new Quaternion().setFromAxisAngle(new Vector3(-0.66352, -0.71306, -0.22646).normalize(), 0.98857)

const KKEBOOK_URL = publicAsset('models/characters/kkebook.glb')

const BODY_COLOR = '#b9e59a'
const BELLY_COLOR = '#fff7d8'
const BLUSH_COLOR = '#ffaaa7'
const FACE_COLOR = '#4a3932'

export interface FrogVisitorVisual extends CharacterVisual {
  applyCustomization(customization: FrogCustomization): void
  dispose(): void
  getCustomization(): FrogCustomization
}

/** Everything the animation and customization code needs, regardless of where the mesh came from. */
interface FrogRig {
  /** 'kkebook' = kkebook.glb, 'procedural' = 파일을 못 불러왔을 때의 기본 개구리 */
  kind: 'kkebook' | 'procedural'
  root: Object3D
  groundOffset: number
  bodyMaterial: MeshStandardMaterial
  leftHip: Object3D
  rightHip: Object3D
  leftShoulder: Object3D
  rightShoulder: Object3D
  bobParts: { object: Object3D; baseY: number }[]
  anchors: Record<AnchorKey, Object3D>
  /** kkebook 입 부품. 예전 GLB나 기본 개구리처럼 입이 따로 없으면 빈 객체 */
  mouths: Partial<Record<KkebookMouth, Object3D>>
}

let kkebookTemplate: Promise<Object3D | null> | undefined

/** Loads kkebook.glb once and shares it; every frog instance clones it. */
export function preloadKkebookModel(): Promise<Object3D | null> {
  kkebookTemplate ??= new GLTFLoader()
    .loadAsync(KKEBOOK_URL)
    .then((gltf) => {
      // Geometry stays shared between clones, so instances must never dispose it.
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh) object.userData.sharedGeometry = true
      })
      return gltf.scene
    })
    .catch((error: unknown) => {
      console.warn('[kkebook] 캐릭터 파일을 불러오지 못해 기본 개구리로 표시합니다.', error)
      return null
    })
  return kkebookTemplate
}

// Start downloading as soon as the app loads so the entry/customizer screen is ready.
void preloadKkebookModel()
preloadAccessoryTemplates()

/** 코드로 그린 악세서리를 kkebook 크기에 맞게 옮기고 키운다 (앵커는 그대로). */
function fitPrototypeAccessory(model: Object3D, key: AnchorKey, anchor: Object3D): Object3D {
  const fit = KKEBOOK_ACCESSORY_FIT[key]
  if (fit.position) {
    model.position.set(
      fit.position[0] - anchor.position.x,
      fit.position[1] - anchor.position.y,
      fit.position[2] - anchor.position.z,
    )
  }
  model.scale.setScalar(fit.scale ?? 1)
  return model
}

function createKkebookRig(template: Object3D): FrogRig | null {
  const root = template.clone(true)
  const find = (name: string): Object3D | undefined => root.getObjectByName(`kkebook-${name}`)

  // Each instance gets its own materials so body colour can differ per visitor.
  const materialCopies = new Map<Material, MeshStandardMaterial>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    const source = object.material as MeshStandardMaterial
    let copy = materialCopies.get(source)
    if (!copy) {
      copy = source.clone()
      materialCopies.set(source, copy)
    }
    object.material = copy
  })
  const bodyMaterial = [...materialCopies.values()].find((material) => material.name === 'Kkebook_Body')

  const body = find('body')
  const leftHip = find('left-leg-pivot')
  const rightHip = find('right-leg-pivot')
  const leftShoulder = find('left-arm-pivot')
  const rightShoulder = find('right-arm-pivot')
  const head = find('head-anchor')
  const face = find('face-anchor')
  const neck = find('neck-anchor')
  const bodyAnchor = find('body-anchor')
  const hand = find('hand-anchor')
  if (!bodyMaterial || !body || !leftHip || !rightHip || !leftShoulder || !rightShoulder
    || !head || !face || !neck || !bodyAnchor || !hand) {
    console.warn('[kkebook] 파일 안에 필요한 부품 이름이 없어 기본 개구리로 표시합니다.')
    return null
  }

  const anchors: Record<AnchorKey, Object3D> = { head, face, neck, body: bodyAnchor, hand }
  const mouths: Partial<Record<KkebookMouth, Object3D>> = {}
  for (const id of KKEBOOK_MOUTHS) {
    const mouth = find(`mouth-${id}`)
    if (mouth) mouths[id] = mouth
  }

  // Everything above the legs bobs together while the feet stay on the floor.
  const partsContainer = leftHip.parent ?? root
  const bobParts = partsContainer.children
    .filter((child) => child !== leftHip && child !== rightHip)
    .map((object) => ({ object, baseY: object.position.y }))

  return {
    kind: 'kkebook',
    root,
    groundOffset: 0,
    bodyMaterial,
    leftHip,
    rightHip,
    leftShoulder,
    rightShoulder,
    bobParts,
    anchors,
    mouths,
  }
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
 * The original toy-like frog from basic Three.js geometry. Kept as a fallback
 * when kkebook.glb cannot be loaded. Local forward direction is +Z.
 */
function createProceduralRig(): FrogRig {
  const root = new Group()
  root.name = 'frog-procedural-rig'

  const bodyMaterial = new MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.78, metalness: 0 })
  const bellyMaterial = new MeshStandardMaterial({ color: BELLY_COLOR, roughness: 0.82, metalness: 0 })
  const blushMaterial = new MeshStandardMaterial({ color: BLUSH_COLOR, roughness: 0.9, metalness: 0 })
  const faceMaterial = new MeshStandardMaterial({ color: FACE_COLOR, roughness: 0.72, metalness: 0 })
  const sphere = new SphereGeometry(1, 24, 18)

  const body = createRoundedPart(sphere, bodyMaterial, new Vector3(0, 0.86, 0), new Vector3(0.57, 0.62, 0.43))
  body.name = 'frog-body'
  const belly = createRoundedPart(sphere, bellyMaterial, new Vector3(0, 0.82, 0.405), new Vector3(0.34, 0.39, 0.045))
  belly.name = 'frog-belly'
  const head = createRoundedPart(sphere, bodyMaterial, new Vector3(0, 1.57, 0.015), new Vector3(0.79, 0.59, 0.48))
  head.name = 'frog-head'

  const leftEyeBump = createRoundedPart(sphere, bodyMaterial, new Vector3(-0.38, 1.98, 0.005), new Vector3(0.31, 0.31, 0.32))
  const rightEyeBump = leftEyeBump.clone()
  rightEyeBump.position.x *= -1
  leftEyeBump.name = 'frog-left-eye-bump'
  rightEyeBump.name = 'frog-right-eye-bump'

  const eyeGeometry = new SphereGeometry(1, 16, 12)
  const leftEye = createRoundedPart(eyeGeometry, faceMaterial, new Vector3(-0.32, 1.72, 0.456), new Vector3(0.073, 0.083, 0.047))
  const rightEye = leftEye.clone()
  rightEye.position.x *= -1
  leftEye.name = 'frog-left-eye'
  rightEye.name = 'frog-right-eye'

  const leftCheek = createRoundedPart(sphere, blushMaterial, new Vector3(-0.52, 1.45, 0.448), new Vector3(0.17, 0.13, 0.035))
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
  const leftLeg = createRoundedPart(sphere, bodyMaterial, new Vector3(0, -0.12, 0.08), new Vector3(0.24, 0.31, 0.28))
  leftHip.add(leftLeg)
  const rightHip = new Group()
  rightHip.name = 'frog-right-leg-pivot'
  rightHip.position.set(0.25, 0.42, 0.035)
  rightHip.add(leftLeg.clone())

  const leftShoulder = new Group()
  leftShoulder.name = 'frog-left-arm-pivot'
  leftShoulder.position.set(-0.55, 1.02, 0.025)
  const leftArm = createRoundedPart(sphere, bodyMaterial, new Vector3(0, -0.12, 0.045), new Vector3(0.18, 0.28, 0.2))
  leftShoulder.add(leftArm)
  const rightShoulder = new Group()
  rightShoulder.name = 'frog-right-arm-pivot'
  rightShoulder.position.set(0.55, 1.02, 0.025)
  rightShoulder.add(leftArm.clone())

  const makeAnchor = (name: string, position: readonly [number, number, number]): Group => {
    const anchor = new Group()
    anchor.name = name
    anchor.position.set(...position)
    return anchor
  }
  const headAnchor = makeAnchor('frog-head-anchor', FROG_ACCESSORY_ANCHOR_CONFIG.head)
  const faceAnchor = makeAnchor('frog-face-anchor', FROG_ACCESSORY_ANCHOR_CONFIG.face)
  // Neck accessories use a centred anchor so their bands are visible from front and back.
  const neckAnchor = makeAnchor('frog-neck-anchor', FROG_ACCESSORY_ANCHOR_CONFIG.neck)
  const bodyAnchor = makeAnchor('frog-body-anchor', FROG_ACCESSORY_ANCHOR_CONFIG.body)
  const handAnchor = makeAnchor('frog-hand-anchor', FROG_ACCESSORY_ANCHOR_CONFIG.hand)
  rightShoulder.add(handAnchor)

  root.add(
    body, belly, head, leftEyeBump, rightEyeBump, leftEye, rightEye, leftCheek, rightCheek, mouth,
    leftHip, rightHip, leftShoulder, rightShoulder, headAnchor, faceAnchor, neckAnchor, bodyAnchor,
  )
  root.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  return {
    kind: 'procedural',
    root,
    groundOffset: 0.00602,
    bodyMaterial,
    leftHip,
    rightHip,
    leftShoulder,
    rightShoulder,
    bobParts: [{ object: body, baseY: 0.86 }, { object: belly, baseY: 0.82 }],
    anchors: { head: headAnchor, face: faceAnchor, neck: neckAnchor, body: bodyAnchor, hand: handAnchor },
    mouths: {},
  }
}

/**
 * Builds the visitor frog. The returned root is available immediately; the kkebook
 * mesh appears as soon as kkebook.glb has loaded (usually before the first frame,
 * because the file is preloaded). If loading fails, the prototype frog is shown.
 */
export function createFrogVisitorModel(initialCustomization?: FrogCustomization): FrogVisitorVisual {
  const model = new Group()
  model.name = 'frog-visitor-model'
  model.scale.setScalar(FROG_VISITOR_CONFIG.modelScale)

  let rig: FrogRig | undefined
  let disposed = false
  let gaitTime = 0
  let walkBlend = 0
  let customization = normalizeCustomization(initialCustomization)
  /** 오른팔이 책을 끼는 자세로 고정되어 있는지 */
  let rightArmPosed = false

  const clearAnchor = (anchor: Object3D): void => {
    anchor.traverse((object) => {
      if (object instanceof Mesh && !object.userData.sharedGeometry) object.geometry.dispose()
    })
    anchor.clear()
  }

  const applyToRig = (): void => {
    if (!rig) return
    rig.bodyMaterial.color.set(FROG_COLOR_VALUES[customization.color].value)
    // 얼굴 악세서리에 맞는 입만 보이게 한다 (그 입이 파일에 없으면 기본 세모 입 유지)
    const wanted = (customization.face && MOUTH_FOR_ACCESSORY[customization.face]) || 'triangle'
    const shownMouth = rig.mouths[wanted] ? wanted : 'triangle'
    for (const id of KKEBOOK_MOUTHS) {
      const mouth = rig.mouths[id]
      if (mouth) mouth.visible = id === shownMouth
    }
    // 책을 들면 오른팔을 옆구리에 끼는 자세로 (kkebook만. 기본 개구리는 그대로)
    rightArmPosed = rig.kind === 'kkebook' && customization.hand === 'book'
    if (rightArmPosed) rig.rightShoulder.quaternion.copy(BOOK_ARM_POSE)
    else rig.rightShoulder.rotation.set(0, 0, 0)

    clearAnchor(rig.anchors.body)
    for (const slot of ['head', 'face', 'neck', 'hand'] as const) {
      const anchor = rig.anchors[slot]
      clearAnchor(anchor)
      const accessory = customization[slot]
      if (!accessory) continue
      const anchorKey: AnchorKey = BODY_ANCHORED.has(accessory) ? 'body' : slot
      const targetAnchor = rig.anchors[anchorKey]

      if (rig.kind === 'kkebook' && GLB_ACCESSORIES.has(accessory)) {
        // GLB 악세서리: 자리만 먼저 잡고, 파일이 준비되면 채운다 (대부분 미리 받아져 있어 바로 채워짐)
        const holder = new Group()
        holder.name = `accessory-${accessory}`
        targetAnchor.add(holder)
        const requestedRig = rig
        void loadAccessoryTemplate(accessory).then((template) => {
          // 그 사이 다른 악세서리로 바꿨거나 캐릭터가 사라졌으면 무시
          if (holder.parent !== targetAnchor || rig !== requestedRig) return
          holder.add(template
            ? template.clone(true)
            : fitPrototypeAccessory(createAccessoryModel(accessory), anchorKey, targetAnchor))
        })
        continue
      }

      const prototype = createAccessoryModel(accessory)
      targetAnchor.add(rig.kind === 'kkebook' ? fitPrototypeAccessory(prototype, anchorKey, targetAnchor) : prototype)
    }
  }

  const disposeRig = (target: FrogRig): void => {
    for (const anchor of Object.values(target.anchors)) clearAnchor(anchor)
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    target.root.traverse((object) => {
      if (object instanceof Mesh) {
        if (!object.userData.sharedGeometry) geometries.add(object.geometry)
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of meshMaterials) materials.add(material)
      }
    })
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    target.root.removeFromParent()
  }

  void preloadKkebookModel().then((template) => {
    if (disposed) return
    const next = (template && createKkebookRig(template)) ?? createProceduralRig()
    rig = next
    model.position.y = next.groundOffset
    model.add(next.root)
    applyToRig()
  })

  return {
    root: model,
    applyCustomization(nextCustomization: FrogCustomization): void {
      customization = normalizeCustomization(nextCustomization)
      applyToRig()
    },
    getCustomization(): FrogCustomization { return { ...customization } },
    dispose(): void {
      disposed = true
      if (rig) disposeRig(rig)
      rig = undefined
    },
    updateAnimation(deltaSeconds: number, state: CharacterAnimationState): void {
      const blend = 1 - Math.exp(-10 * deltaSeconds)
      walkBlend += ((state.isWalking ? 1 : 0) - walkBlend) * blend

      if (state.isWalking) {
        gaitTime += deltaSeconds * Math.max(5.2, state.movementSpeed * 2.65)
      }
      if (!rig) return

      const stride = Math.sin(gaitTime)
      const legSwing = stride * WALK_ANIMATION.legSwing * walkBlend
      const armSwing = legSwing * WALK_ANIMATION.armSwing
      const bodyBob = Math.abs(stride) * WALK_ANIMATION.bob * walkBlend

      rig.leftHip.rotation.x = legSwing
      rig.rightHip.rotation.x = -legSwing
      rig.leftShoulder.rotation.x = -armSwing
      if (!rightArmPosed) rig.rightShoulder.rotation.x = armSwing
      for (const part of rig.bobParts) part.object.position.y = part.baseY + bodyBob
      // Leans onto the stepping foot for a toy-like waddle; pivots at the feet.
      rig.root.rotation.z = stride * WALK_ANIMATION.waddle * walkBlend
    },
  }
}
