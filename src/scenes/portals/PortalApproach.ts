import type { DestinationMarker } from '../../characters/DestinationMarker.ts'
import type { VisitorCharacter } from '../../characters/VisitorCharacter.ts'
import type { GridPathfinder } from '../../characters/pathfinding/GridPathfinder.ts'
import { PORTAL_ALREADY_NEAR_DISTANCE } from './portalConfig.ts'
import type { PortalInstance } from './PortalSet.ts'

interface PendingPortalApproach {
  elapsed: number
  hasStartedTurning: boolean
  phase: 'walking' | 'turning' | 'done'
  portal: PortalInstance
}

/** Shared visitor choreography for portal actions, independent from artwork viewing. */
export class PortalApproach {
  private readonly character: VisitorCharacter
  private readonly destinationMarker: DestinationMarker
  private readonly onArrive: (portal: PortalInstance) => void
  private readonly pathfinder: GridPathfinder
  private pending: PendingPortalApproach | undefined

  constructor(
    character: VisitorCharacter,
    destinationMarker: DestinationMarker,
    pathfinder: GridPathfinder,
    onArrive: (portal: PortalInstance) => void,
  ) {
    this.character = character
    this.destinationMarker = destinationMarker
    this.pathfinder = pathfinder
    this.onArrive = onArrive
  }

  get activePortalId(): string | undefined {
    return this.pending?.portal.config.id
  }

  start(portal: PortalInstance): boolean {
    if (this.activePortalId === portal.config.id) return false
    this.cancel()
    this.pending = { portal, phase: 'turning', elapsed: 0, hasStartedTurning: false }
    const approachPoint = portal.approachPoint
    if (!approachPoint) return true

    const isAlreadyNear = Math.hypot(
      this.character.root.position.x - approachPoint.x,
      this.character.root.position.z - approachPoint.z,
    ) <= PORTAL_ALREADY_NEAR_DISTANCE
    const path = isAlreadyNear ? [] : this.pathfinder.findPath(this.character.root.position, approachPoint)
    if (isAlreadyNear || !this.character.setPath(path)) {
      this.character.clearPath()
      this.destinationMarker.hide()
      return true
    }

    this.pending.phase = 'walking'
    this.destinationMarker.show(approachPoint)
    return true
  }

  cancel(): void {
    if (!this.pending) return
    this.pending = undefined
    this.character.clearPath()
    this.destinationMarker.hide()
  }

  update(deltaSeconds: number): void {
    const pending = this.pending
    if (!pending) return
    if (pending.phase === 'walking') {
      if (!this.character.isMoving) {
        pending.phase = 'turning'
        pending.elapsed = 0
        pending.hasStartedTurning = false
      }
      return
    }
    if (pending.phase === 'turning') {
      if (!pending.hasStartedTurning) {
        this.character.faceToward(pending.portal.facingPoint)
        pending.hasStartedTurning = true
      }
      pending.elapsed += deltaSeconds
      if (this.character.isFacingTarget || pending.elapsed >= 0.8) {
        pending.phase = 'done'
        pending.elapsed = 0
      }
      return
    }
    pending.elapsed += deltaSeconds
    if (pending.elapsed >= 0.3) {
      this.pending = undefined
      this.onArrive(pending.portal)
    }
  }
}
