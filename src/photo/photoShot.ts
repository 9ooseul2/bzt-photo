import { MathUtils, type Object3D, PerspectiveCamera, Raycaster, type Scene, Vector2, Vector3, type WebGLRenderer } from 'three'

/**
 * 인증샷 카메라. 숫자만 바꿔서 구도를 조절할 수 있다.
 * - free: 화면 📷 버튼. 관람객이 바라보던 방향을 배경으로, 깨북이 뒤쪽 위에서 광각으로 찍는다.
 * - artwork: 작품 창의 "인증샷 남기기". 고른 작품을 정면에서, 깨북이와 함께 찍는다.
 * fov = 화각(도), height = 카메라 높이(m), distance = 깨북이(또는 작품 앞 줄)에서 물러나는 거리(m),
 * lookY = 바라보는 높이(m), maxFov = 뒤가 좁아 덜 물러났을 때 넓힐 수 있는 최대 화각
 */
export const PHOTO_CAMERA = {
  free: { fov: 54, height: 2.45, distance: 3.9, lookY: 0.95, lookAhead: 1.0 },
  artwork: { fov: 54, height: 2.3, distance: 4.3, lookY: 1.45 },
  maxFov: 78,
  /** 벽에서 이만큼 떨어진 곳까지만 물러난다 */
  wallMargin: 0.3,
  minDistance: 1.8,
  /** 사진(정사각형) 한 변 픽셀 */
  size: 960,
} as const

export interface PhotoStage {
  renderer: WebGLRenderer
  scene: Scene
  /** 지금 화면의 카메라 (바라보던 방향을 알아낼 때 쓴다) */
  viewCamera: PerspectiveCamera
  /** 내 깨북이 (찍는 순간에만 카메라 쪽으로 돌려 세운다) */
  frog: Object3D
  /** 카메라가 뚫고 지나가면 안 되는 벽들 */
  occluders: readonly Object3D[]
}

export interface PhotoArtworkTarget {
  /** 작품 가운데 */
  center: Vector3
  /** 작품 앞면 방향 (방 안쪽) */
  normal: Vector3
}

const raycaster = new Raycaster()

/** 화면 📷 버튼: 바라보던 방향을 배경으로 찍는다 */
export function captureFreePhoto(stage: PhotoStage): HTMLCanvasElement {
  const config = PHOTO_CAMERA.free
  const view = stage.viewCamera.getWorldDirection(new Vector3())
  const forward = new Vector2(view.x, view.z)
  if (forward.lengthSq() < 1e-6) forward.set(0, -1)
  forward.normalize()
  const frog = stage.frog.position
  const distance = limitByWalls(stage, new Vector3(frog.x, config.height, frog.z), new Vector3(-forward.x, 0, -forward.y), config.distance)
  const camera = createCamera(widenedFov(config.fov, config.distance, distance))
  camera.position.set(frog.x - forward.x * distance, config.height, frog.z - forward.y * distance)
  camera.lookAt(frog.x + forward.x * config.lookAhead, config.lookY, frog.z + forward.y * config.lookAhead)
  return renderSquare(stage, camera)
}

/** 작품 창의 "인증샷 남기기": 고른 작품을 정면에서, 깨북이와 함께 찍는다 */
export function captureArtworkPhoto(stage: PhotoStage, artwork: PhotoArtworkTarget): HTMLCanvasElement {
  const config = PHOTO_CAMERA.artwork
  const frog = stage.frog.position
  const normal = new Vector3(artwork.normal.x, 0, artwork.normal.z).normalize()
  const side = new Vector3(-normal.z, 0, normal.x)
  // 깨북이가 작품에서 얼마나 앞(along), 옆(lateral)에 서 있는지
  const offset = new Vector3(frog.x - artwork.center.x, 0, frog.z - artwork.center.z)
  const along = Math.max(0.8, offset.dot(normal))
  const lateral = offset.dot(side)
  // 작품은 가운데 근처, 깨북이도 너무 한쪽으로 치우치지 않도록 옆으로 30%만 따라간다
  const base = artwork.center.clone().addScaledVector(side, lateral * 0.3)
  const start = base.clone().addScaledVector(normal, along).setY(config.height)
  const distance = limitByWalls(stage, start, normal, config.distance)
  const camera = createCamera(widenedFov(config.fov, along + config.distance, along + distance))
  camera.position.copy(start).addScaledVector(normal, distance)
  const look = base.clone().addScaledVector(normal, along * 0.45)
  camera.lookAt(look.x, config.lookY, look.z)
  return renderSquare(stage, camera)
}

/** 뒤로 물러나다 벽에 닿으면 벽 앞에서 멈춘다 */
function limitByWalls(stage: PhotoStage, origin: Vector3, direction: Vector3, wanted: number): number {
  raycaster.set(origin, direction.clone().normalize())
  raycaster.far = wanted + PHOTO_CAMERA.wallMargin
  const hit = raycaster.intersectObjects(stage.occluders as Object3D[], true)[0]
  if (!hit) return wanted
  return Math.max(PHOTO_CAMERA.minDistance, Math.min(wanted, hit.distance - PHOTO_CAMERA.wallMargin))
}

/** 덜 물러났으면 그만큼 화각을 넓혀서 비슷한 범위가 담기게 한다 */
function widenedFov(fov: number, wantedDistance: number, actualDistance: number): number {
  if (actualDistance >= wantedDistance - 0.01) return fov
  const halfWidth = Math.tan(MathUtils.degToRad(fov / 2)) * wantedDistance
  return Math.min(PHOTO_CAMERA.maxFov, MathUtils.radToDeg(Math.atan(halfWidth / actualDistance)) * 2)
}

function createCamera(fov: number): PerspectiveCamera {
  return new PerspectiveCamera(fov, 1, 0.1, 80)
}

/**
 * 정사각형으로 한 번 더 그려서 2D 캔버스에 옮긴다.
 * 같은 순간 안에서 그리고 되돌리므로 화면에는 아무 변화가 보이지 않는다.
 * 찍는 순간에만 깨북이가 카메라 쪽을 돌아본다.
 */
function renderSquare(stage: PhotoStage, camera: PerspectiveCamera): HTMLCanvasElement {
  const { renderer, frog } = stage
  const size = PHOTO_CAMERA.size
  const previousSize = renderer.getSize(new Vector2())
  const previousRatio = renderer.getPixelRatio()
  const previousRotation = frog.rotation.y
  frog.rotation.y = Math.atan2(camera.position.x - frog.position.x, camera.position.z - frog.position.z)
  frog.updateMatrixWorld(true)

  const output = document.createElement('canvas')
  output.width = size
  output.height = size
  try {
    renderer.setPixelRatio(1)
    renderer.setSize(size, size, false)
    renderer.render(stage.scene, camera)
    output.getContext('2d')?.drawImage(renderer.domElement, 0, 0, size, size)
  } finally {
    frog.rotation.y = previousRotation
    frog.updateMatrixWorld(true)
    renderer.setPixelRatio(previousRatio)
    renderer.setSize(previousSize.x, previousSize.y, false)
    renderer.render(stage.scene, stage.viewCamera)
  }
  return output
}
