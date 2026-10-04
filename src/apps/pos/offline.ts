/**
 * Terminal-local offline support. While offline the terminal authorises
 * against a cached snapshot and queues approved charges; on reconnect it
 * replays them through the API, which re-validates each one.
 *
 * This state is deliberately kept outside the shared database: an offline
 * terminal cannot reach the "server".
 */
import { api, evaluateCharge, type ChargeRequest, type ChargeResult } from '@/mock-api';

export type PosSnapshot = Awaited<ReturnType<typeof api.getPosSnapshot>>;

export interface QueuedCharge {
  id: string;
  request: ChargeRequest;
  total: number;
  studentName: string;
  studentNameAr: string;
}

export interface SyncReport {
  synced: number;
  conflicts: { item: QueuedCharge; result: ChargeResult }[];
}

const K = {
  offline: 'kanteen.pos.offline',
  queue: 'kanteen.pos.queue',
  snapshot: 'kanteen.pos.snapshot',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const offlineStore = {
  isOffline: () => readJson<boolean>(K.offline, false),
  setOffline: (v: boolean) => writeJson(K.offline, v),
  queue: () => readJson<QueuedCharge[]>(K.queue, []),
  setQueue: (q: QueuedCharge[]) => writeJson(K.queue, q),
  snapshot: () => readJson<PosSnapshot | null>(K.snapshot, null),
  setSnapshot: (s: PosSnapshot) => writeJson(K.snapshot, s),
};

/** Authorise locally against the snapshot. Mutates the snapshot on approval. */
export function chargeOffline(snapshot: PosSnapshot, req: ChargeRequest): { result: ChargeResult; queued?: QueuedCharge } {
  const bracelet = snapshot.bracelets.find((b) => b.id === req.braceletId);
  const student = bracelet?.studentId ? snapshot.students.find((s) => s.id === bracelet.studentId) : undefined;
  const spentToday = student ? (snapshot.spentToday[student.id] ?? 0) : 0;
  const ev = evaluateCharge({ bracelet, student, menu: snapshot.menu, lines: req.lines, spentToday });
  const result: ChargeResult = { outcome: ev.outcome, reason: ev.reason, reasonDetail: ev.reasonDetail, total: ev.total, student, spentToday };
  if (ev.outcome !== 'approved' || !student) return { result };

  student.balance = Math.round((student.balance - ev.total) * 100) / 100;
  snapshot.spentToday[student.id] = spentToday + ev.total;
  result.balanceAfter = student.balance;
  result.spentToday = spentToday + ev.total;
  const queued: QueuedCharge = {
    id: `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    request: { ...req, at: new Date().toISOString(), offline: true },
    total: ev.total,
    studentName: student.name,
    studentNameAr: student.nameAr,
  };
  return { result, queued };
}

/** Replay queued charges in order. Server-side rules have the final word. */
export async function syncQueue(queue: QueuedCharge[], onProgress?: (done: number) => void): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, conflicts: [] };
  let i = 0;
  for (const item of queue) {
    const result = await api.charge(item.request);
    if (result.outcome === 'approved') report.synced++;
    else report.conflicts.push({ item, result });
    onProgress?.(++i);
  }
  return report;
}
