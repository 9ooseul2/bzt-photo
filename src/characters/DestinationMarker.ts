import { DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from 'three'
import type { NavigationPoint } from './pathfinding/GridPathfinder.ts'

type MarkerState = 'appearing' | 'hidden' | 'hiding' | 'visible'

/** Lightweight 3D movement feedback that is independent from pathfinding. */
export class DestinationMarker {
  readonly mesh: Mesh<RingGeometry, MeshBasicMaterial>
  private elapsed = 0
  private state: MarkerState = 'hidden'

  constructor() {
    const material = new MeshBasicMaterial({
      color: '#b9f2c6',
      depthWrite: false,
      opacity: 0,
      side: DoubleSide,
      transparent: true,
    })

    this.mesh = new Mesh(new RingGeometry(0.2, 0.31, 32), material)
    this.mesh.name = 'movement-destination-marker'
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.y = 0.035
    this.mesh.renderOrder = 1
    this.mesh.visible = false
  }

  show(destination: NavigationPoint): void {
    this.mesh.position.set(destination.x, 0.035, destination.z)
    this.mesh.scale.setScalar(0.25)
    this.mesh.material.opacity = 0
    this.mesh.visible = true
    this.elapsed = 0
    this.state = 'appearing'
  }

  hide(): void {
    if (this.state === 'hidden' || this.state === 'hiding') {
      return
    }

    this.elapsed = 0
    this.state = 'hiding'
  }

  update(deltaSeconds: number): void {
    if (this.state === 'hidden' || this.state === 'visible') {
      return
    }

    this.elapsed += deltaSeconds

    if (this.state === 'appearing') {
      const progress = Math.min(1, this.elapsed / 0.18)
      const easedProgress = 1 - (1 - progress) ** 3
      this.mesh.scale.setScalar(0.25 + 0.75 * easedProgress)
      this.mesh.material.opacity = 0.68 * easedProgress

      if (progress === 1) {
        this.state = 'visible'
      }

      return
    }

    const progress = Math.min(1, this.elapsed / 0.24)
    this.mesh.scale.setScalar(1 + 0.18 * progress)
    this.mesh.material.opacity = 0.68 * (1 - progress)

    if (progress === 1) {
      this.mesh.visible = false
      this.state = 'hidden'
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
  }
}
