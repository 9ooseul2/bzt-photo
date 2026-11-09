import { Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { publicAsset } from '../../config/publicAsset.ts'
import type { AccessoryId } from './types.ts'

/**
 * kkebook에 맞춰 Blender로 만든 악세서리 목록 (public/models/accessories/<id>.glb).
 * 파일 원점이 붙을 앵커 위치라서 앵커에 그대로 붙이면 제자리에 놓인다.
 * 여기에 없는 악세서리는 FrogAccessories.ts의 코드로 그린 모양을 쓴다.
 * 새 GLB를 추가하면 파일을 넣고 이 목록에 ID만 추가하면 된다.
 */
export const GLB_ACCESSORIES: ReadonlySet<AccessoryId> = new Set<AccessoryId>([
  'beanie', 'cap', 'headset',
  'glasses', 'sunglasses', 'bubble_gum',
  'scarf', 'crossbody_bag', 'bow_tie',
])

const loader = new GLTFLoader()
const templates = new Map<AccessoryId, Promise<Object3D | null>>()

/** 악세서리 GLB를 한 번만 불러오고 공유한다. 실패하면 null (코드로 그린 모양으로 대체). */
export function loadAccessoryTemplate(id: AccessoryId): Promise<Object3D | null> {
  let template = templates.get(id)
  if (!template) {
    template = loader
      .loadAsync(publicAsset(`models/accessories/${id}.glb`))
      .then((gltf) => {
        gltf.scene.traverse((object) => {
          if (object instanceof Mesh) {
            // Geometry is shared by every clone, so wearing/removing must never dispose it.
            object.userData.sharedGeometry = true
            object.castShadow = true
            object.receiveShadow = true
          }
        })
        return gltf.scene
      })
      .catch((error: unknown) => {
        console.warn(`[accessory] ${id}.glb 을 불러오지 못해 기본 모양으로 표시합니다.`, error)
        return null
      })
    templates.set(id, template)
  }
  return template
}

/** 꾸미기 화면에서 바로 보이도록 앱 시작 시 미리 내려받는다. */
export function preloadAccessoryTemplates(): void {
  for (const id of GLB_ACCESSORIES) void loadAccessoryTemplate(id)
}
