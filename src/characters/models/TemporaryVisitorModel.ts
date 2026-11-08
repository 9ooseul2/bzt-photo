import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import type { CharacterAnimationState, CharacterVisual } from '../CharacterVisual.ts'

/**
 * Presentation-only placeholder for a future imported character model.
 * The visitor controller owns movement and only receives this Group to render.
 */
export function createTemporaryVisitorModel(): CharacterVisual {
  const model = new Group()
  model.name = 'temporary-visitor-model'

  const clothing = new MeshStandardMaterial({ color: '#4e6572', roughness: 0.78 })
  const accent = new MeshStandardMaterial({ color: '#d9a45b', roughness: 0.7 })
  const skin = new MeshStandardMaterial({ color: '#d9af91', roughness: 0.82 })
  const dark = new MeshStandardMaterial({ color: '#2e3437', roughness: 0.88 })

  const body = new Mesh(new CylinderGeometry(0.29, 0.35, 0.9, 10), clothing)
  body.position.y = 0.92

  const head = new Mesh(new SphereGeometry(0.28, 16, 12), skin)
  head.position.y = 1.62

  const leftHip = new Group()
  leftHip.name = 'left-leg-pivot'
  leftHip.position.set(-0.13, 0.48, 0)
  const leftLeg = new Mesh(new BoxGeometry(0.19, 0.48, 0.22), dark)
  leftLeg.position.y = -0.24
  leftHip.add(leftLeg)

  const rightHip = new Group()
  rightHip.name = 'right-leg-pivot'
  rightHip.position.set(0.13, 0.48, 0)
  const rightLeg = leftLeg.clone()
  rightHip.add(rightLeg)

  const leftShoulder = new Group()
  leftShoulder.name = 'left-arm-pivot'
  leftShoulder.position.set(-0.36, 1.28, 0)
  const leftArm = new Mesh(new BoxGeometry(0.14, 0.48, 0.16), clothing)
  leftArm.position.y = -0.24
  leftShoulder.add(leftArm)

  const rightShoulder = new Group()
  rightShoulder.name = 'right-arm-pivot'
  rightShoulder.position.set(0.36, 1.28, 0)
  const rightArm = leftArm.clone()
  rightShoulder.add(rightArm)

  // The small front panel defines the model's local forward (+Z) direction.
  const frontPanel = new Mesh(new BoxGeometry(0.34, 0.48, 0.05), accent)
  frontPanel.position.set(0, 0.98, 0.31)

  model.add(body, head, leftHip, rightHip, leftShoulder, rightShoulder, frontPanel)
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })

  let gaitTime = 0
  let walkBlend = 0

  return {
    root: model,
    updateAnimation(deltaSeconds: number, state: CharacterAnimationState): void {
      const blend = 1 - Math.exp(-10 * deltaSeconds)
      const targetBlend = state.isWalking ? 1 : 0
      walkBlend += (targetBlend - walkBlend) * blend

      if (state.isWalking) {
        gaitTime += deltaSeconds * Math.max(5.5, state.movementSpeed * 2.8)
      }

      const legSwing = Math.sin(gaitTime) * 0.58 * walkBlend
      const armSwing = legSwing * 0.68

      leftHip.rotation.x = legSwing
      rightHip.rotation.x = -legSwing
      leftShoulder.rotation.x = -armSwing
      rightShoulder.rotation.x = armSwing
    },
  }
}
