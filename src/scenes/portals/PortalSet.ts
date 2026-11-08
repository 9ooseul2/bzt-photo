import { Group, Object3D, Vector3 } from 'three'
import type { GridPathfinder } from '../../characters/pathfinding/GridPathfinder.ts'
import { ExhibitionWall } from '../exhibition/ExhibitionWall.ts'
import {
  APPROACH_DISTANCE,
  APPROACH_RETRY_COUNT,
  APPROACH_RETRY_INCREMENT,
  PORTAL_FRAME_WIDTH,
  PORTAL_HEIGHT,
  PORTAL_WALL_GAP,
  PORTAL_WIDTH,
} from './portalConfig.ts'
import { PortalDoor } from './PortalDoor.ts'
import type { PortalConfig } from './types.ts'

const FORWARD = new Vector3(0, 0, 1)

export interface PortalInstance {
  readonly approachPoint: Vector3 | undefined
  readonly config: PortalConfig
  readonly facingPoint: Vector3
}

/** Minimal world-space portal data for room-level UI such as a minimap. */
export interface PortalMapPosition {
  id: string
  rotationY: number
  width: number
  x: number
  z: number
}

interface ManagedPortal extends PortalInstance {
  readonly door: PortalDoor
}

/** Places free-standing portal visuals without adding them to structural wall groups. */
export class PortalSet {
  readonly group = new Group()
  private readonly portals = new Map<string, ManagedPortal>()

  constructor(configs: readonly PortalConfig[], walls: readonly ExhibitionWall[], pathfinder: GridPathfinder) {
    this.group.name = 'portal-set'
    const wallsById = new Map(walls.map((wall) => [wall.config.id, wall]))
    for (const config of configs) this.addPortal(config, wallsById.get(config.wallId), pathfinder)
  }

  getApproachPoint(id: string): Vector3 | undefined {
    return this.portals.get(id)?.approachPoint?.clone()
  }

  getFacingPoint(id: string): Vector3 | undefined {
    return this.portals.get(id)?.facingPoint.clone()
  }

  /** Reads the resolved visual positions rather than duplicating portal placement math in UI. */
  getMapPositions(): readonly PortalMapPosition[] {
    return [...this.portals.values()].map((portal) => {
      portal.door.group.updateWorldMatrix(true, false)
      const position = portal.door.group.getWorldPosition(new Vector3())
      const direction = portal.door.group.getWorldDirection(new Vector3())
      return {
        id: portal.config.id,
        rotationY: Math.atan2(direction.x, direction.z),
        width: PORTAL_WIDTH,
        x: position.x,
        z: position.z,
      }
    })
  }

  getPortalFromObject(object: Object3D): PortalInstance | undefined {
    let current: Object3D | null = object
    while (current) {
      const portalId = current.userData.portalId
      if (typeof portalId === 'string') return this.portals.get(portalId)
      current = current.parent
    }
    return undefined
  }

  update(elapsedSeconds: number): void {
    for (const portal of this.portals.values()) portal.door.update(elapsedSeconds)
  }

  dispose(): void {
    for (const portal of this.portals.values()) portal.door.dispose()
    this.portals.clear()
    this.group.clear()
  }

  private addPortal(config: PortalConfig, wall: ExhibitionWall | undefined, pathfinder: GridPathfinder): void {
    if (!wall) {
      console.warn(`Portal "${config.id}" references a missing wall and was skipped.`)
      return
    }
    if (Math.abs(config.offsetX) + PORTAL_WIDTH / 2 + PORTAL_FRAME_WIDTH / 2 > wall.config.length / 2) {
      console.warn(`Portal "${config.id}" exceeds the length of wall "${wall.config.id}" and was skipped.`)
      return
    }

    wall.group.updateWorldMatrix(true, false)
    const wallCenter = wall.group.getWorldPosition(new Vector3())
    const localX = new Vector3(1, 0, 0).transformDirection(wall.group.matrixWorld)
    const forward = new Vector3(0, 0, 1).transformDirection(wall.group.matrixWorld)
    const backward = forward.clone().multiplyScalar(-1)
    const towardRoom = new Vector3(-wallCenter.x, 0, -wallCenter.z)
    const interiorNormal = forward.dot(towardRoom) >= backward.dot(towardRoom) ? forward : backward
    interiorNormal.y = 0
    interiorNormal.normalize()

    const position = wallCenter.addScaledVector(localX, config.offsetX)
    position.y = 0
    position.addScaledVector(interiorNormal, wall.config.thickness / 2 + PORTAL_WALL_GAP)
    const door = new PortalDoor(config)
    door.group.position.copy(position)
    door.group.quaternion.setFromUnitVectors(FORWARD, interiorNormal)
    this.group.add(door.group)

    const facingPoint = position.clone().setY(PORTAL_HEIGHT / 2)
    const approachPoint = this.findApproachPoint(position, interiorNormal, pathfinder)
    if (!approachPoint) console.warn(`Portal "${config.id}" has no walkable approach point.`)
    this.portals.set(config.id, { config, door, facingPoint, approachPoint })
  }

  private findApproachPoint(center: Vector3, interiorNormal: Vector3, pathfinder: GridPathfinder): Vector3 | undefined {
    for (let retry = 0; retry <= APPROACH_RETRY_COUNT; retry += 1) {
      const distance = APPROACH_DISTANCE + APPROACH_RETRY_INCREMENT * retry
      const point = center.clone().addScaledVector(interiorNormal, distance)
      if (pathfinder.isWalkableDestination(point)) return point.setY(0)
    }
    return undefined
  }
}
