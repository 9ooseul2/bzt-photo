import type { ArtworkSide } from '../types.ts'

/** A wall-mounted, room-level introduction that remains independent from artwork data. */
export interface RoomIntroConfig {
  id: string
  roomName: string
  title: string
  paragraphs: string[]
  placement: {
    wallId: string
    /** Required for partitions; exterior walls infer their interior side when omitted. */
    side?: ArtworkSide
    offsetX: number
    centerHeight?: number
  }
  width: number
}
