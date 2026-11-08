import type { Group } from 'three'

/** Movement state passed from a controller to whichever character model is active. */
export interface CharacterAnimationState {
  isWalking: boolean
  movementSpeed: number
}

/**
 * Rendering and animation contract for a controllable character.
 * Imported character assets can implement this without changing path movement.
 */
export interface CharacterVisual {
  root: Group
  updateAnimation(deltaSeconds: number, state: CharacterAnimationState): void
}
