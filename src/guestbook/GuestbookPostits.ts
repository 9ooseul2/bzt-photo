import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Object3D,
} from 'three'
import { GUESTBOOK_POSTIT_SIZE, getSlotTransform } from './GuestbookPlacement.ts'
import type { GuestbookColor, GuestbookEntry } from './types.ts'

const POSTIT_COLORS: Record<GuestbookColor, string> = {
  butter: '#f7df88',
  pink: '#eeb4bd',
  sage: '#b8cda8',
  lavender: '#c9c0e1',
}

/** Shared geometry/material poster wall with per-entry groups for safe updates and raycasts. */
export class GuestbookPostits {
  readonly group = new Group()
  private readonly entries = new Map<string, GuestbookEntry>()
  private readonly geometry = new BoxGeometry(GUESTBOOK_POSTIT_SIZE, GUESTBOOK_POSTIT_SIZE, 0.035)
  private readonly materials = new Map<GuestbookColor, MeshStandardMaterial>()
  private readonly highlights = new Map<string, { glow: Mesh; label: Sprite; labelMaterial: SpriteMaterial; labelTexture: CanvasTexture; startedAt: number }>()
  private hovered: Group | undefined

  constructor(entries: readonly GuestbookEntry[]) {
    this.group.name = 'guestbook-postits'
    for (const entry of entries) this.add(entry)
  }

  add(entry: GuestbookEntry): boolean {
    if (!entry.placement || this.entries.has(entry.id)) return false
    const transform = getSlotTransform(entry.placement.slotId)
    if (!transform) return false

    const note = new Group()
    note.name = `guestbook-postit-${entry.id}`
    note.position.set(transform.x, transform.y, transform.z)
    note.rotation.y = transform.rotationY
    note.rotation.z = this.getTilt(entry.id)
    note.userData.entryId = entry.id

    const mesh = new Mesh(this.geometry, this.getMaterial(entry.color))
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.entryId = entry.id
    note.add(mesh)
    this.entries.set(entry.id, entry)
    this.group.add(note)
    return true
  }

  getEntryFromObject(object: Object3D): GuestbookEntry | undefined {
    let current: Object3D | null = object
    while (current) {
      const entryId = current.userData.entryId as string | undefined
      if (entryId) return this.entries.get(entryId)
      current = current.parent
    }
    return undefined
  }

  setHovered(entry: GuestbookEntry | undefined): void {
    const next = entry ? this.group.getObjectByName(`guestbook-postit-${entry.id}`) as Group | undefined : undefined
    if (next === this.hovered) return
    if (this.hovered) this.hovered.scale.setScalar(1)
    this.hovered = next
    if (this.hovered) this.hovered.scale.setScalar(1.06)
  }

  highlight(entryId: string, now = Date.now()): void {
    const note = this.group.getObjectByName(`guestbook-postit-${entryId}`) as Group | undefined
    if (!note) return
    this.removeHighlight(entryId)

    const glow = new Mesh(
      new BoxGeometry(GUESTBOOK_POSTIT_SIZE * 1.12, GUESTBOOK_POSTIT_SIZE * 1.12, 0.008),
      new MeshBasicMaterial({ color: '#fff9d5', transparent: true, opacity: 0.42, depthWrite: false }),
    )
    glow.position.z = 0.026
    glow.renderOrder = 1
    note.add(glow)

    const { sprite: label, material: labelMaterial, texture: labelTexture } = this.createNewLabel()
    note.add(label)
    this.highlights.set(entryId, { glow, label, labelMaterial, labelTexture, startedAt: now })
  }

  getPosition(entryId: string, target = new Vector3()): Vector3 | undefined {
    const note = this.group.getObjectByName(`guestbook-postit-${entryId}`)
    return note ? note.getWorldPosition(target) : undefined
  }

  update(now = Date.now()): void {
    for (const [entryId, effect] of this.highlights) {
      const elapsed = now - effect.startedAt
      const glowProgress = Math.min(1, elapsed / 1_800)
      const eased = 1 - (1 - glowProgress) ** 2
      const glowMaterial = effect.glow.material as MeshBasicMaterial
      glowMaterial.opacity = 0.42 * (1 - eased)
      if (elapsed >= 1_800) effect.glow.visible = false
      if (elapsed >= 8_000) this.removeHighlight(entryId)
    }
  }

  dispose(): void {
    for (const entryId of [...this.highlights.keys()]) this.removeHighlight(entryId)
    this.geometry.dispose()
    for (const material of this.materials.values()) material.dispose()
  }

  private getMaterial(color: GuestbookColor): MeshStandardMaterial {
    const cached = this.materials.get(color)
    if (cached) return cached
    const material = new MeshStandardMaterial({ color: POSTIT_COLORS[color], roughness: 0.82, metalness: 0 })
    this.materials.set(color, material)
    return material
  }

  private createNewLabel(): { material: SpriteMaterial; sprite: Sprite; texture: CanvasTexture } {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 52
    const context = canvas.getContext('2d')
    if (!context) throw new Error('New guestbook label canvas is unavailable.')
    context.beginPath()
    context.roundRect(2, 2, 124, 48, 18)
    context.fillStyle = 'rgba(48, 54, 43, 0.84)'
    context.fill()
    context.font = '600 26px Pretendard, Arial, sans-serif'
    context.fillStyle = '#ffffff'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('NEW', 64, 27)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = 'srgb'
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    const sprite = new Sprite(material)
    sprite.name = 'guestbook-new-label'
    sprite.position.set(0, GUESTBOOK_POSTIT_SIZE * 0.72, 0.05)
    sprite.scale.set(0.38, 0.154, 1)
    return { sprite, material, texture }
  }

  private removeHighlight(entryId: string): void {
    const effect = this.highlights.get(entryId)
    if (!effect) return
    effect.glow.parent?.remove(effect.glow)
    effect.label.parent?.remove(effect.label)
    effect.glow.geometry.dispose()
    ;(effect.glow.material as MeshBasicMaterial).dispose()
    effect.labelMaterial.dispose()
    effect.labelTexture.dispose()
    this.highlights.delete(entryId)
  }

  private getTilt(id: string): number {
    let hash = 0
    for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
    return ((hash % 9) - 4) * 0.012
  }
}
