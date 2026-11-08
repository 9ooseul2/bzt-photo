import { DEFAULT_FROG_CUSTOMIZATION, normalizeCustomization, type FrogCustomization } from './types.ts'

const STORAGE_KEY = 'b-photo-project.frog-customization.v1'

/** Local state only; a future transport can synchronize this small ID-only shape. */
export class FrogCustomizationStore {
  private current = this.load()

  get state(): FrogCustomization { return { ...this.current } }

  save(value: FrogCustomization): void {
    this.current = normalizeCustomization(value)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current)) } catch { /* keep session state */ }
  }

  private load(): FrogCustomization {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      return stored ? normalizeCustomization(JSON.parse(stored) as Partial<FrogCustomization>) : { ...DEFAULT_FROG_CUSTOMIZATION }
    } catch {
      return { ...DEFAULT_FROG_CUSTOMIZATION }
    }
  }
}
