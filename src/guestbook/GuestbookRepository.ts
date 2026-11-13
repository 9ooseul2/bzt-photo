import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config/supabase.ts'
import { GUESTBOOK_COLORS, type GuestbookColor, type GuestbookEntry } from './types.ts'

const TABLE_URL = `${SUPABASE_URL}/rest/v1/guestbook_entries`
const CLIENT_ID_KEY = 'bzt-photo.guestbook.client-id'
/** 이 브라우저에서 쓴 글 id 목록 (삭제 버튼을 보여줄지 정할 때 사용) */
const MY_ENTRIES_KEY = 'bzt-photo.guestbook.my-entries'
const REQUEST_TIMEOUT_MS = 8000

/** 방명록 쓰기 실패 이유. 화면에 보여줄 안내 문구를 고를 때 쓴다. */
export type GuestbookSaveError = 'too-fast' | 'busy' | 'invalid' | 'network'

export class GuestbookSaveFailure extends Error {
  readonly reason: GuestbookSaveError
  constructor(reason: GuestbookSaveError) {
    super(reason)
    this.reason = reason
  }
}

interface EntryRow {
  color: string
  created_at: string
  id: string
  message: string
  nickname: string
}

/**
 * 방명록을 Supabase에 저장하고 불러온다 (모든 방문자가 같은 방명록을 본다).
 * 별도 라이브러리 없이 Supabase의 REST 주소에 바로 요청한다.
 * 읽기/쓰기는 누구나, 지우기는 그 글을 쓴 브라우저만 가능하다 (supabase/guestbook.sql, guestbook_delete.sql).
 * 고치기는 막혀 있다.
 */
export class GuestbookRepository {
  /**
   * 최신 글부터 limit개를 불러와 오래된 순으로 돌려준다.
   * 서버에 닿지 못하면 null (화면은 샘플 방명록으로 대신 채운다).
   */
  async loadLatest(limit: number): Promise<GuestbookEntry[] | null> {
    try {
      const response = await this.request(
        `${TABLE_URL}?select=id,nickname,message,color,created_at&order=created_at.desc&limit=${limit}`,
        { method: 'GET' },
      )
      if (!response.ok) return null
      const rows: unknown = await response.json()
      if (!Array.isArray(rows)) return null
      return rows.filter(this.isRow).map(this.toEntry).reverse()
    } catch {
      return null
    }
  }

  /** 새 글을 저장한다. 실패하면 GuestbookSaveFailure를 던진다. */
  async save(input: { color: GuestbookColor; message: string; nickname: string }): Promise<GuestbookEntry> {
    const id = globalThis.crypto?.randomUUID?.()
    if (!id) throw new GuestbookSaveFailure('network')
    const body = { id, nickname: input.nickname, message: input.message, color: input.color, client_id: this.clientId() }
    let response: Response
    try {
      response = await this.request(TABLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new GuestbookSaveFailure('network')
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      if (text.includes('GUESTBOOK_TOO_FAST')) throw new GuestbookSaveFailure('too-fast')
      if (text.includes('GUESTBOOK_BUSY')) throw new GuestbookSaveFailure('busy')
      throw new GuestbookSaveFailure(response.status === 400 ? 'invalid' : 'network')
    }
    this.rememberMine(id)
    // 저장 시각은 서버가 정하지만, 화면에는 바로 붙여야 하므로 지금 시각을 쓴다 (다음 입장 때 서버 값으로 맞춰짐)
    return { id, nickname: input.nickname, message: input.message, color: input.color, createdAt: new Date().toISOString() }
  }

  /** 이 브라우저에서 쓴 글인지 (삭제 버튼 표시용) */
  isMine(entryId: string): boolean {
    return this.myEntries().includes(entryId)
  }

  /** 내가 쓴 글을 지운다. 실제로 지워졌으면 true. */
  async delete(entryId: string): Promise<boolean> {
    try {
      const response = await this.request(`${TABLE_URL}?id=eq.${encodeURIComponent(entryId)}&select=id`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation', 'x-guestbook-client': this.clientId() },
      })
      if (!response.ok) return false
      const rows: unknown = await response.json()
      const deleted = Array.isArray(rows) && rows.length > 0
      if (deleted) this.saveMine(this.myEntries().filter((id) => id !== entryId))
      return deleted
    } catch {
      return false
    }
  }

  private myEntries(): string[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(MY_ENTRIES_KEY) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  }

  private rememberMine(entryId: string): void {
    this.saveMine([...this.myEntries(), entryId].slice(-100))
  }

  private saveMine(ids: string[]): void {
    try { window.localStorage.setItem(MY_ENTRIES_KEY, JSON.stringify(ids)) } catch { /* 삭제 버튼만 안 보일 뿐 */ }
  }

  private request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    return fetch(url, {
      ...init,
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, ...(init.headers ?? {}) },
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timer))
  }

  /** 같은 브라우저를 구분하는 임의의 번호 (도배 방지용, 다른 사람에게는 보이지 않음) */
  private clientId(): string {
    try {
      const stored = window.localStorage.getItem(CLIENT_ID_KEY)
      if (stored) return stored
      const created = globalThis.crypto.randomUUID()
      window.localStorage.setItem(CLIENT_ID_KEY, created)
      return created
    } catch {
      return globalThis.crypto.randomUUID()
    }
  }

  private readonly isRow = (value: unknown): value is EntryRow => {
    if (!value || typeof value !== 'object') return false
    const row = value as Partial<EntryRow>
    return typeof row.id === 'string' && typeof row.nickname === 'string' && typeof row.message === 'string'
      && typeof row.created_at === 'string' && GUESTBOOK_COLORS.includes(row.color as GuestbookColor)
  }

  private readonly toEntry = (row: EntryRow): GuestbookEntry => ({
    id: row.id,
    nickname: row.nickname,
    message: row.message,
    color: row.color as GuestbookColor,
    createdAt: row.created_at,
  })
}
