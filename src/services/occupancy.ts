/** Swappable read-only source for each exhibition room's live visitor count. */
export interface OccupancyProvider {
  getCount(roomId: string): number | null
  subscribe(listener: () => void): () => void
}

/** Default while no presence server is connected: intentionally displays nothing. */
export class NullOccupancyProvider implements OccupancyProvider {
  getCount(_roomId: string): number | null {
    return null
  }

  subscribe(_listener: () => void): () => void {
    return () => undefined
  }
}

/** Keep the visitor-count wording consistent in every room-aware UI. */
export function formatOccupancy(count: number): string {
  return `${count}명`
}
