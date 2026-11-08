import type { NavigationLayout, WallCollisionVolume } from '../../scenes/exhibition/createNavigationLayout.ts'

export interface NavigationPoint {
  x: number
  z: number
}

interface GridCell {
  column: number
  row: number
}

interface OpenNode extends GridCell {
  cost: number
  estimatedTotal: number
}

const NEIGHBOURS: readonly GridCell[] = [
  { column: -1, row: -1 },
  { column: 0, row: -1 },
  { column: 1, row: -1 },
  { column: -1, row: 0 },
  { column: 1, row: 0 },
  { column: -1, row: 1 },
  { column: 0, row: 1 },
  { column: 1, row: 1 },
]

/**
 * A small A* grid that consumes room navigation data, not render meshes.
 * Obstacles are inflated by the visitor radius to preserve clearance from walls.
 */
export class GridPathfinder {
  private readonly columns: number
  private readonly agentRadius: number
  private readonly cellSize: number
  private readonly layout: NavigationLayout
  private readonly originX: number
  private readonly originZ: number
  private readonly rows: number

  constructor(layout: NavigationLayout, agentRadius: number, cellSize = 0.45) {
    this.layout = layout
    this.agentRadius = agentRadius
    this.cellSize = cellSize
    const usableWidth = layout.walkableBounds.maxX - layout.walkableBounds.minX - agentRadius * 2
    const usableDepth = layout.walkableBounds.maxZ - layout.walkableBounds.minZ - agentRadius * 2

    this.columns = Math.max(1, Math.floor(usableWidth / cellSize) + 1)
    this.rows = Math.max(1, Math.floor(usableDepth / cellSize) + 1)
    this.originX = layout.walkableBounds.minX + agentRadius
    this.originZ = layout.walkableBounds.minZ + agentRadius
  }

  findPath(start: NavigationPoint, destination: NavigationPoint): readonly NavigationPoint[] {
    if (!this.isWalkableDestination(destination)) {
      return []
    }

    const startCell = this.findNearestWalkableCell(this.toGrid(start))
    const destinationCell = this.findNearestWalkableCell(this.toGrid(destination))

    if (!startCell || !destinationCell) {
      return []
    }

    const pathCells = this.findCellPath(startCell, destinationCell)

    if (!pathCells) {
      return []
    }

    const rawPath = [start, ...pathCells.map((cell) => this.toWorld(cell))]
    const finalCellPoint = rawPath.at(-1)

    if (finalCellPoint && this.isWalkablePoint(destination) && this.hasClearSegment(finalCellPoint, destination)) {
      rawPath.push(destination)
    }

    return this.simplifyPath(rawPath)
  }

  /** Rejects wall, boundary, and clearance-invalid click targets before rerouting. */
  isWalkableDestination(destination: NavigationPoint): boolean {
    return this.isWalkablePoint(destination)
  }

  private findCellPath(start: GridCell, destination: GridCell): GridCell[] | undefined {
    const startKey = this.key(start)
    const destinationKey = this.key(destination)
    const open: OpenNode[] = [
      {
        ...start,
        cost: 0,
        estimatedTotal: this.distance(start, destination),
      },
    ]
    const costs = new Map<string, number>([[startKey, 0]])
    const previous = new Map<string, GridCell>()
    const closed = new Set<string>()

    while (open.length > 0) {
      let bestIndex = 0

      for (let index = 1; index < open.length; index += 1) {
        if (open[index].estimatedTotal < open[bestIndex].estimatedTotal) {
          bestIndex = index
        }
      }

      const current = open.splice(bestIndex, 1)[0]
      const currentKey = this.key(current)

      if (currentKey === destinationKey) {
        return this.reconstructPath(previous, current)
      }

      closed.add(currentKey)

      for (const offset of NEIGHBOURS) {
        const neighbour = {
          column: current.column + offset.column,
          row: current.row + offset.row,
        }
        const neighbourKey = this.key(neighbour)

        if (closed.has(neighbourKey) || !this.isWalkableCell(neighbour)) {
          continue
        }

        // Prevent diagonal shortcuts through the corner of a wall.
        if (
          offset.column !== 0 &&
          offset.row !== 0 &&
          (!this.isWalkableCell({ column: current.column + offset.column, row: current.row }) ||
            !this.isWalkableCell({ column: current.column, row: current.row + offset.row }))
        ) {
          continue
        }

        const nextCost = current.cost + this.distance(current, neighbour)
        const recordedCost = costs.get(neighbourKey)

        if (recordedCost !== undefined && nextCost >= recordedCost) {
          continue
        }

        costs.set(neighbourKey, nextCost)
        previous.set(neighbourKey, current)
        const estimatedTotal = nextCost + this.distance(neighbour, destination)
        const existing = open.find((node) => this.key(node) === neighbourKey)

        if (existing) {
          existing.cost = nextCost
          existing.estimatedTotal = estimatedTotal
        } else {
          open.push({ ...neighbour, cost: nextCost, estimatedTotal })
        }
      }
    }

    return undefined
  }

  private reconstructPath(previous: ReadonlyMap<string, GridCell>, destination: GridCell): GridCell[] {
    const path = [destination]
    let current = destination

    while (previous.has(this.key(current))) {
      const parent = previous.get(this.key(current))

      if (!parent) {
        break
      }

      path.unshift(parent)
      current = parent
    }

    return path
  }

  private simplifyPath(points: readonly NavigationPoint[]): NavigationPoint[] {
    if (points.length < 3) {
      return [...points]
    }

    const simplified = [points[0]]
    let currentIndex = 0

    while (currentIndex < points.length - 1) {
      let nextIndex = points.length - 1

      while (nextIndex > currentIndex + 1 && !this.hasClearSegment(points[currentIndex], points[nextIndex])) {
        nextIndex -= 1
      }

      simplified.push(points[nextIndex])
      currentIndex = nextIndex
    }

    return simplified
  }

  private findNearestWalkableCell(preferred: GridCell): GridCell | undefined {
    const maximumRadius = Math.max(this.columns, this.rows)

    for (let radius = 0; radius <= maximumRadius; radius += 1) {
      for (let column = preferred.column - radius; column <= preferred.column + radius; column += 1) {
        for (let row = preferred.row - radius; row <= preferred.row + radius; row += 1) {
          const isOuterRing =
            column === preferred.column - radius ||
            column === preferred.column + radius ||
            row === preferred.row - radius ||
            row === preferred.row + radius

          if (isOuterRing && this.isWalkableCell({ column, row })) {
            return { column, row }
          }
        }
      }
    }

    return undefined
  }

  private isWalkableCell(cell: GridCell): boolean {
    return this.isInsideGrid(cell) && this.isWalkablePoint(this.toWorld(cell))
  }

  private isWalkablePoint(point: NavigationPoint): boolean {
    const { maxX, maxZ, minX, minZ } = this.layout.walkableBounds

    if (
      point.x < minX + this.agentRadius ||
      point.x > maxX - this.agentRadius ||
      point.z < minZ + this.agentRadius ||
      point.z > maxZ - this.agentRadius
    ) {
      return false
    }

    return !this.layout.blockingObstacles.some((wall) => this.isInsideExpandedWall(point, wall))
  }

  private isInsideExpandedWall(point: NavigationPoint, wall: WallCollisionVolume): boolean {
    const deltaX = point.x - wall.center.x
    const deltaZ = point.z - wall.center.z
    const cosine = Math.cos(wall.rotationY)
    const sine = Math.sin(wall.rotationY)
    const localX = cosine * deltaX - sine * deltaZ
    const localZ = sine * deltaX + cosine * deltaZ

    return (
      Math.abs(localX) <= wall.length / 2 + this.agentRadius &&
      Math.abs(localZ) <= wall.thickness / 2 + this.agentRadius
    )
  }

  private hasClearSegment(from: NavigationPoint, to: NavigationPoint): boolean {
    const distance = Math.hypot(to.x - from.x, to.z - from.z)
    const steps = Math.max(1, Math.ceil(distance / (this.cellSize / 3)))

    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps
      const point = {
        x: from.x + (to.x - from.x) * progress,
        z: from.z + (to.z - from.z) * progress,
      }

      if (!this.isWalkablePoint(point)) {
        return false
      }
    }

    return true
  }

  private toGrid(point: NavigationPoint): GridCell {
    return {
      column: Math.min(this.columns - 1, Math.max(0, Math.round((point.x - this.originX) / this.cellSize))),
      row: Math.min(this.rows - 1, Math.max(0, Math.round((point.z - this.originZ) / this.cellSize))),
    }
  }

  private toWorld(cell: GridCell): NavigationPoint {
    return {
      x: this.originX + cell.column * this.cellSize,
      z: this.originZ + cell.row * this.cellSize,
    }
  }

  private isInsideGrid(cell: GridCell): boolean {
    return cell.column >= 0 && cell.column < this.columns && cell.row >= 0 && cell.row < this.rows
  }

  private distance(from: GridCell, to: GridCell): number {
    return Math.hypot(from.column - to.column, from.row - to.row)
  }

  private key(cell: GridCell): string {
    return `${cell.column}:${cell.row}`
  }
}
