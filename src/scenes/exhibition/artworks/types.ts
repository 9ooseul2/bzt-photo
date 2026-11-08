import type { ArtworkSide } from '../types.ts'

export type FrameStyle = 'thin-wood' | 'white-mat' | 'none'

/** Data-only description of a work, ready to be replaced by CMS or API data later. */
export interface ArtworkConfig {
  id: string
  /** URL relative to the Vite public directory. */
  imageUrl: string
  title: string
  artist: string
  comment?: string
  placement: {
    wallId: string
    side: ArtworkSide
    /** Horizontal offset from the wall centre, along its local X axis. */
    offsetX: number
    /** Height of the photo centre above the floor. */
    centerHeight?: number
  }
  /** Photo width in world metres; its height follows the source image ratio. */
  width: number
  frameStyle: FrameStyle
}

/** A future multiplayer visitor can reserve one of these IDs before walking to it. */
export interface ViewingSpot {
  id: string
  artworkId: string
  position: { x: number; z: number }
}
