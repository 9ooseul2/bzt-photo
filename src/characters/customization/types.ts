export const FROG_COLORS = ['green', 'pink', 'blue', 'yellow'] as const
export type FrogColorId = (typeof FROG_COLORS)[number]

export const ACCESSORY_SLOTS = ['head', 'face', 'neck', 'hand'] as const
export type AccessorySlot = (typeof ACCESSORY_SLOTS)[number]
export type AccessoryId = 'beanie' | 'headset' | 'cap' | 'glasses' | 'sunglasses' | 'bubble_gum' | 'scarf' | 'crossbody_bag' | 'bow_tie' | 'balloon' | 'fish_bun' | 'book'

export interface FrogCustomization {
  color: FrogColorId
  face: AccessoryId | null
  hand: AccessoryId | null
  head: AccessoryId | null
  neck: AccessoryId | null
}

export const DEFAULT_FROG_CUSTOMIZATION: FrogCustomization = {
  color: 'green', head: null, face: null, neck: null, hand: null,
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
  fish_bun: { slot: 'hand', label: '붕어빵', icon: '🐟' },
  book: { slot: 'hand', label: '책', icon: '📕' },
}

export const FROG_COLOR_VALUES: Readonly<Record<FrogColorId, { label: string; value: string }>> = {
  green: { label: '초록', value: '#b9e59a' },
  pink: { label: '핑크', value: '#eeb5c2' },
  blue: { label: '파랑', value: '#a9d2e6' },
  yellow: { label: '노랑', value: '#efd88a' },
}

export function normalizeCustomization(value: Partial<FrogCustomization> | undefined): FrogCustomization {
  const output: FrogCustomization = { ...DEFAULT_FROG_CUSTOMIZATION }
  if (!value) return output
  if (FROG_COLORS.includes(value.color as FrogColorId)) output.color = value.color as FrogColorId
  for (const slot of ACCESSORY_SLOTS) {
    const accessory = value[slot]
    if (accessory && accessory in ACCESSORY_CATALOG && ACCESSORY_CATALOG[accessory as AccessoryId].slot === slot) {
      output[slot] = accessory as never
    }
  }
  return output
}
