export const FROG_COLORS = ['green', 'yellow', 'blue', 'purple'] as const
export type FrogColorId = (typeof FROG_COLORS)[number]

/** 꾸미기 화면에서 아이템을 묶어 보여주는 분류. 분류마다 여러 개를 함께 착용할 수 있다. */
export const ACCESSORY_SLOTS = ['head', 'face', 'neck', 'hand'] as const
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number]
export type AccessoryId = 'beanie' | 'headset' | 'cap' | 'glasses' | 'sunglasses' | 'bubble_gum' | 'scarf' | 'crossbody_bag' | 'bow_tie' | 'balloon' | 'americano' | 'book'

export interface FrogCustomization {
  color: FrogColorId
  /** 착용한 악세서리 (ACCESSORY_ORDER 순서로 정리되어 있다) */
  accessories: AccessoryId[]
}

export const DEFAULT_FROG_CUSTOMIZATION: FrogCustomization = {
  color: 'green', accessories: [],
}

export const ACCESSORY_CATALOG: Readonly<Record<AccessoryId, { icon: string; label: string; slot: AccessorySlot }>> = {
  beanie: { slot: 'head', label: '털모자', icon: '🧶' },
  headset: { slot: 'head', label: '헤드셋', icon: '🎧' },
  cap: { slot: 'head', label: '캡모자', icon: '🧢' },
  glasses: { slot: 'face', label: '안경', icon: '👓' },
  sunglasses: { slot: 'face', label: '선글라스', icon: '🕶️' },
  bubble_gum: { slot: 'face', label: '풍선껌', icon: '🫧' },
  scarf: { slot: 'neck', label: '목도리', icon: '🧣' },
  crossbody_bag: { slot: 'neck', label: '크로스백', icon: '👜' },
  bow_tie: { slot: 'neck', label: '나비넥타이', icon: '🎀' },
  balloon: { slot: 'hand', label: '풍선', icon: '🎈' },
  americano: { slot: 'hand', label: '아메리카노', icon: '🥤' },
  book: { slot: 'hand', label: '책', icon: '📕' },
}

/** 착용 목록을 저장·비교할 때 쓰는 고정 순서 */
const ACCESSORY_ORDER = Object.keys(ACCESSORY_CATALOG) as AccessoryId[]

/**
 * 같은 자리를 써서 함께 착용할 수 없는 짝. 하나를 고르면 짝이 자동으로 벗겨진다.
 * 새 짝을 막으려면 여기에 한 줄 추가하면 된다.
 */
export const ACCESSORY_CONFLICTS: ReadonlyArray<readonly [AccessoryId, AccessoryId]> = [
  ['beanie', 'cap'], // 같은 머리 위
  ['glasses', 'sunglasses'], // 같은 눈 위치
  ['scarf', 'bow_tie'], // 같은 목 위치
  ['americano', 'book'], // 같은 팔
]

export const FROG_COLOR_VALUES: Readonly<Record<FrogColorId, { label: string; value: string }>> = {
  green: { label: '초록', value: '#b9e59a' },
  yellow: { label: '노랑', value: '#efd88a' },
  blue: { label: '파랑', value: '#a9d2e6' },
  purple: { label: '보라', value: '#c8b6e2' },
}

/** 이 악세서리와 함께 착용할 수 없는 악세서리들 */
export function getConflictingAccessories(id: AccessoryId): AccessoryId[] {
  return ACCESSORY_CONFLICTS.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []))
}

/**
 * 악세서리를 착용한다. 함께 못 쓰는 것은 벗기고, 벗긴 목록도 돌려준다 (안내 문구용).
 */
export function wearAccessory(customization: FrogCustomization, id: AccessoryId): { next: FrogCustomization; removed: AccessoryId[] } {
  const conflicts = getConflictingAccessories(id)
  const removed = customization.accessories.filter((item) => conflicts.includes(item))
  const kept = customization.accessories.filter((item) => item !== id && !conflicts.includes(item))
  return { next: normalizeCustomization({ ...customization, accessories: [...kept, id] }), removed }
}

export function takeOffAccessory(customization: FrogCustomization, id: AccessoryId): FrogCustomization {
  return normalizeCustomization({ ...customization, accessories: customization.accessories.filter((item) => item !== id) })
}

/** 예전 저장 형식: 분류마다 하나씩 ({ head: 'cap', face: null, ... }) */
type LegacyCustomization = Partial<Record<AccessorySlot, AccessoryId | null>>

/**
 * 저장된 값이나 받은 값을 안전한 모양으로 정리한다.
 * - 모르는 ID·중복은 버린다
 * - 함께 못 쓰는 짝이 같이 있으면 나중에 고른 쪽만 남긴다
 * - 예전 형식(분류마다 하나씩)으로 저장된 값도 그대로 옮겨 온다
 */
export function normalizeCustomization(value: (Partial<FrogCustomization> & LegacyCustomization) | undefined): FrogCustomization {
  const output: FrogCustomization = { color: DEFAULT_FROG_CUSTOMIZATION.color, accessories: [] }
  if (!value) return output
  if (FROG_COLORS.includes(value.color as FrogColorId)) output.color = value.color as FrogColorId

  const requested: unknown[] = Array.isArray(value.accessories)
    ? value.accessories
    : ACCESSORY_SLOTS.map((slot) => value[slot])
  const worn: AccessoryId[] = []
  for (const item of requested) {
    if (typeof item !== 'string' || !(item in ACCESSORY_CATALOG)) continue
    const id = item as AccessoryId
    const conflicts = getConflictingAccessories(id)
    // 나중에 고른 것이 이긴다
    for (let index = worn.length - 1; index >= 0; index -= 1) {
      if (worn[index] === id || conflicts.includes(worn[index])) worn.splice(index, 1)
    }
    worn.push(id)
  }
  output.accessories = ACCESSORY_ORDER.filter((id) => worn.includes(id))
  return output
}
