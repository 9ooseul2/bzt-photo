/**
 * The frog camera focuses around 2 m high; 2.65 m keeps a medium photograph
 * comfortably above the visitor while remaining centred in the 6.4 m walls.
 */
export const DEFAULT_CENTER_HEIGHT = 2.65

/** Physical depth shared by each simple procedural frame. */
export const FRAME_THICKNESS = 0.075
/** Slim border for the warm wood and outer white-mat frame. */
export const FRAME_BORDER_WIDTH = 0.095
/** Breathing room around a photograph displayed in a white mat. */
export const WHITE_MAT_WIDTH = 0.19

/**
 * Places the visitor far enough from a 2 m photo for the third-person camera
 * to see both visitor and work, with wider works increasing the distance.
 */
export const VIEWING_DISTANCE = 2.15
/** Five positions form a readable small audience without crowding one wall face. */
export const VIEWING_SPOT_COUNT = 5
/** The fan stays entirely on the visible side of the wall instead of wrapping behind it. */
export const VIEWING_ARC_ANGLE = (90 * Math.PI) / 180
/** Above twice the 0.294 m frog collision radius, leaving a small visual gap. */
export const MIN_SPOT_SPACING = 0.66
/** Avoids an unnecessary walk when the visitor has already reached an art position. */
export const ALREADY_NEAR_DISTANCE = 0.62
/** Leaves a beat for the turn and camera guide before opening the detail view. */
export const POPUP_DELAY_AFTER_ARRIVAL = 0.5

/** Development-only visual check for the cached destination fan. */
export const SHOW_VIEWING_SPOTS_DEBUG = false
