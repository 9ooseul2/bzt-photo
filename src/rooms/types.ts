import type { ArtworkConfig } from '../scenes/exhibition/artworks/types.ts'
import type { ExhibitionRoomConfig } from '../scenes/exhibition/types.ts'
import type { RoomIntroConfig } from '../scenes/exhibition/roomIntro/types.ts'
import type { RoomPropConfig } from '../scenes/exhibition/props/types.ts'
import type { PortalConfig } from '../scenes/portals/types.ts'

/** Optional room-level material overrides; omitted values retain gallery one defaults. */
export interface RoomAppearanceConfig {
  wallColor: string
  ceilingColor: string
  floorColor: string
  floorRoughness: number
}

/** Optional room-level illumination. A defined room controls whether it has a key light. */
export interface RoomLightingConfig {
  background: string
  hemisphere: {
    sky: string
    ground: string
    intensity: number
  }
  keyLight?: {
    color: string
    intensity: number
    castShadow: boolean
  }
  trackLighting?: boolean
}

/**
 * All content owned by one exhibition room. Future appearance, lighting, and
 * prop options belong alongside this data without changing scene consumers.
 */
export interface ExhibitionRoomDefinition {
  id: string
  displayName: string
  config: ExhibitionRoomConfig
  portals: readonly PortalConfig[]
  artworks: readonly ArtworkConfig[]
  intros: readonly RoomIntroConfig[]
  appearance?: RoomAppearanceConfig
  lighting?: RoomLightingConfig
  props?: readonly RoomPropConfig[]
}
