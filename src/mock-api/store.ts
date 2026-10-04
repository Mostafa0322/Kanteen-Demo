/**
 * In-memory database persisted to localStorage and synchronised across tabs
 * (and same-origin iframes) with BroadcastChannel.
 *
 * Only the mock API should touch this module; the UI goes through `api`.
 */
import type { Database } from './types';
import { DB_VERSION, generateSeed } from './seed';

const STORAGE_KEY = 'kanteen.db.v' + DB_VERSION;
const CHANNEL_NAME = 'kanteen-sync';

export type ChangeEvent =
  | { type: 'db-changed'; rev: number; origin: string; topic?: string }
  | { type: 'pos-display'; vendorId: string; txId: string; origin: string };

type Listener = (e: ChangeEvent) => void;

const tabId = Math.random().toString(36).slice(2);
let db: Database = load();
let rev = 0;
const listeners = new Set<Listener>();

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

/**
 * The snapshot travels inside the message: localStorage is synced between
 * renderer processes asynchronously, so re-reading it on receipt can return
 * stale data (and a later write would then clobber the other tab's change).
 */
type WireEvent = ChangeEvent | (Extract<ChangeEvent, { type: 'db-changed' }> & { db: Database });

channel?.addEventListener('message', (msg: MessageEvent<WireEvent>) => {
  const e = msg.data;
  if (!e || e.origin === tabId) return;
  if (e.type === 'db-changed') {
    const incoming = 'db' in e ? e.db : load();
    if ((incoming.updatedAt ?? 0) < (db.updatedAt ?? 0)) return; // out-of-order, older snapshot
    db = incoming;
    rev++;
    emit({ type: 'db-changed', rev, origin: e.origin, topic: e.topic });
    return;
  }
  emit(e);
});

// Fallback for browsers without BroadcastChannel: the storage event fires in other tabs.
if (typeof window !== 'undefined' && !channel) {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    db = load();
    rev++;
    emit({ type: 'db-changed', rev, origin: 'storage' });
  });
}

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // Corrupt or unavailable storage: fall through to a fresh seed.
  }
  const fresh = generateSeed();
  persist(fresh);
  return fresh;
}

function persist(data: Database) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[kanteen] could not persist database', err);
  }
}

function emit(e: ChangeEvent) {
  for (const l of listeners) l(e);
}

/** Read-only access to the current snapshot. */
export function getDb(): Readonly<Database> {
  return db;
}

export function getRevision(): number {
  return rev;
}

/** Apply a mutation, persist it and notify this tab and every other tab. */
export function mutate<T>(fn: (draft: Database) => T, topic?: string): T {
  const draft = structuredClone(db);
  const result = fn(draft);
  draft.updatedAt = Math.max(Date.now(), (db.updatedAt ?? 0) + 1);
  db = draft;
  rev++;
  persist(db);
  const e: ChangeEvent = { type: 'db-changed', rev, origin: tabId, topic };
  emit(e);
  channel?.postMessage({ ...e, db } satisfies WireEvent);
  return result;
}

export function replaceDb(next: Database) {
  mutate((draft) => {
    Object.assign(draft, next);
  }, 'reset');
}

/** Fire-and-forget event to every tab (used to drive the POS customer display). */
export function broadcast(e: Omit<Extract<ChangeEvent, { type: 'pos-display' }>, 'origin'>) {
  const full = { ...e, origin: tabId } as ChangeEvent;
  emit(full);
  channel?.postMessage(full);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
