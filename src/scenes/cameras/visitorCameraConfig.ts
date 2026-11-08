export interface ThirdPersonCameraConfig {
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
