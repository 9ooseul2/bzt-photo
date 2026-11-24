export interface CameraAutoSwingConfig {
  /** Turn the camera toward open space automatically when walls squeeze it. */
  enabled: boolean
  /** Start swinging when the free distance drops below this share of the zoom distance. */
  triggerRatio: number
  /** A direction counts as open when it has at least this share of the zoom distance. */
  satisfiedRatio: number
  /** Furthest the camera will swing to either side, in radians. */
  maximumAngle: number
  /** Angular spacing of the candidate directions that are tested, in radians. */
  searchStep: number
  /** When nothing is fully open, a direction must gain this many metres to be worth turning to. */
  minimumGain: number
  /** Turning speed in radians per second. */
  speed: number
  /** Seconds between open-direction searches. */
  searchInterval: number
}

export interface ThirdPersonCameraConfig {
  /** Seconds after a manual camera drag during which auto-swing stays out of the way. */
  autoSwingDelayAfterManual: number
  autoSwing: CameraAutoSwingConfig
  /** Half-width of the camera's collision probe; keeps the lens off walls it would graze. */
  collisionRadius: number
  /** Camera near plane in metres; smaller means less of the wall can slip into view. */
  nearClip: number
  /** Initial camera-to-focus distance in metres. */
  distance: number
  fieldOfView: number
  /** Raises the camera's look target above the character head for artwork-first framing. */
  focusHeightOffset: number
  initialAzimuth: number
  /** Initial viewing pitch relative to horizontal; negative looks downward. */
  initialPitch: number
  maximumZoomDistance: number
  /** Highest view pitch relative to horizontal. */
  maximumPitch: number
  /** Preferred lower camera distance; physical geometry takes priority in tighter spaces. */
  minimumCollisionDistance: number
  /** Lowest view pitch relative to horizontal. */
  minimumPitch: number
  minimumZoomDistance: number
  occlusionPadding: number
  /** Fixed vertical placement of the camera around the tracked character. */
  orbitElevation: number
  cameraDistanceSmoothing: number
  rotationSensitivity: number
  rotationSmoothing: number
  verticalRotationSensitivity: number
  wheelZoomSensitivity: number
  zoomSmoothing: number
}

export interface CameraInteractionConfig {
  /** Pointer travel required before a left press becomes a camera drag. */
  dragThreshold: number
  /** Browser wheel line units converted to pixel-like units for consistent zoom. */
  wheelLineSize: number
}

/**
 * Visitor camera composition. Adjust these values without changing input or
 * character code when refining the final exhibition viewing distance.
 */
export const VISITOR_CAMERA_CONFIG: ThirdPersonCameraConfig = {
  autoSwingDelayAfterManual: 1.2,
  autoSwing: {
    enabled: true,
    triggerRatio: 0.7,
    satisfiedRatio: 0.9,
    maximumAngle: (120 * Math.PI) / 180,
    searchStep: (10 * Math.PI) / 180,
    minimumGain: 0.4,
    speed: (95 * Math.PI) / 180,
    searchInterval: 0.12,
  },
  collisionRadius: 0.2,
  nearClip: 0.05,
  distance: 4.5,
  fieldOfView: 52,
  focusHeightOffset: 0.8,
  initialAzimuth: 0,
  initialPitch: (-12 * Math.PI) / 180,
  maximumZoomDistance: 6,
  maximumPitch: (15 * Math.PI) / 180,
  minimumCollisionDistance: 1.1,
  minimumPitch: (-25 * Math.PI) / 180,
  minimumZoomDistance: 3,
  occlusionPadding: 0.22,
  orbitElevation: (12 * Math.PI) / 180,
  cameraDistanceSmoothing: 12,
  rotationSensitivity: 0.0044,
  rotationSmoothing: 14,
  verticalRotationSensitivity: 0.0033,
  wheelZoomSensitivity: 0.01,
  zoomSmoothing: 14,
}

export const CAMERA_INTERACTION_CONFIG: CameraInteractionConfig = {
  dragThreshold: 6,
  wheelLineSize: 16,
}
