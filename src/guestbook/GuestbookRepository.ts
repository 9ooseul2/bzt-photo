import type { GuestbookEntry } from './types.ts'

const STORAGE_KEY = 'b-photo-project.guestbook.entries.v1'

/** Browser-only persistence adapter; replace this module when adding a shared database. */
export class GuestbookRepository {
  load(): GuestbookEntry[] {
    try {
      const serialized = window.localStorage.getItem(STORAGE_KEY)
      if (!serialized) return []
      const parsed: unknown = JSON.parse(serialized)
      return Array.isArray(parsed) ? parsed.filter(this.isEntry) : []
    } catch {
      return []
    }
  }

  save(entry: GuestbookEntry): void {
    const entries = this.load()
    entries.push(entry)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Quota/privacy failures leave the current in-memory exhibition usable.
    }
  }

  private readonly isEntry = (value: unknown): value is GuestbookEntry => {
    if (!value || typeof value !== 'object') return false
    const entry = value as Partial<GuestbookEntry>
    return (
      typeof entry.id === 'string' &&
      typeof entry.nickname === 'string' &&
      typeof entry.message === 'string' &&
      typeof entry.createdAt === 'string' &&
      typeof entry.color === 'string'
    )
  }
}
