/**
 * Mock API. Every function is async and returns plain JSON-compatible data, so
 * this module can be replaced by an HTTP client with the same signatures.
 */
import type {
  AppNotification,
  AuditEntry,
  Bracelet,
  ChargeRequest,
  ChargeResult,
  ClosingReport,
  Database,
  DeclineReason,
  ID,
  MenuItem,
  MenuItemView,
  OverviewStats,
  Parent,
  School,
  Settings,
  Student,
  StudentControls,
  TopUpRequest,
  Transaction,
  TxFilter,
  Vendor,
  WeeklyReport,
  CheckoutRequest,
  Offering,
  OfferingView,
  Order,
  OrderStatus,
} from './types';
import { broadcast, getDb, mutate, replaceDb, subscribe } from './store';
import { addDays, dayKey, parseDayKey, startOfWeek } from './dates';
import { evaluateCharge, menuViewFor, round2, spentOnDay } from './engine';
import { generateSeed } from './seed';

export class ApiError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/* ---------- helpers ---------- */

function latency(factor = 1): Promise<void> {
  const base = getDb().settings.latencyMs * factor;
  if (base <= 0) return Promise.resolve();
  const ms = base * (0.6 + Math.random() * 0.8);
  return new Promise((r) => setTimeout(r, ms));
}
const read = <T,>(fn: () => T) => latency(0.4).then(fn);
const write = <T,>(fn: () => T) => latency(1).then(fn);

let seq = Date.now() % 1_000_000;
const newId = (prefix: string) => `${prefix}_${(++seq).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const clone = <T,>(v: T): T => structuredClone(v);

function findStudent(db: Database, id: ID): Student {
  const s = db.students.find((x) => x.id === id);
  if (!s) throw new ApiError('not_found', `Student ${id} not found`);
  return s;
}

function notify(db: Database, student: Student, n: Omit<AppNotification, 'id' | 'parentId' | 'studentId' | 'read' | 'createdAt'> & { createdAt?: string }) {
  if (!student.parentId) return;
  db.notifications.unshift({
    id: newId('ntf'),
    parentId: student.parentId,
    studentId: student.id,
    read: false,
    createdAt: n.createdAt ?? new Date().toISOString(),
    ...n,
  });
  // Keep storage bounded.
  if (db.notifications.length > 600) db.notifications.length = 600;
}

function itemParams(tx: Transaction) {
  return tx.lines ? { items: tx.lines.map((l) => l.name).join(', '), itemsAr: tx.lines.map((l) => l.nameAr).join('، ') } : undefined;
}

/** Signed effect of a transaction on the wallet balance. */
function balanceDelta(tx: Transaction): number {
  if (tx.status !== 'approved') return 0;
  if (tx.type === 'purchase') return -tx.amount;
  if (tx.type === 'topup') return tx.amount;
  // Shop payments/refunds only touch the wallet when the wallet balance was used.
  if (tx.type === 'order') return tx.method === 'balance' ? -tx.amount : 0;
  if (tx.type === 'refund') return tx.method && tx.method !== 'balance' ? 0 : tx.amount;
  return 0;
}

function matchesFilter(tx: Transaction, f: TxFilter, db: Database): boolean {
  if (f.schoolId && tx.schoolId !== f.schoolId) return false;
  if (f.studentId && tx.studentId !== f.studentId) return false;
  if (f.vendorId && tx.vendorId !== f.vendorId) return false;
  if (f.type && f.type !== 'all' && tx.type !== f.type) return false;
  if (f.status && f.status !== 'all') {
    if (f.status === 'not_approved') {
      if (tx.status === 'approved') return false;
    } else if (tx.status !== f.status) return false;
  }
  if (f.from || f.to) {
    const k = dayKey(tx.createdAt);
    if (f.from && k < f.from) return false;
    if (f.to && k > f.to) return false;
  }
  if (f.query) {
    const q = f.query.trim().toLowerCase();
    if (q) {
      const s = db.students.find((x) => x.id === tx.studentId);
      const hay = [tx.id, s?.name, s?.nameAr, tx.braceletId, tx.note, ...(tx.lines ?? []).flatMap((l) => [l.name, l.nameAr])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
  }
  return true;
}

/* ---------- shop helpers ---------- */

/** Units sold (paid or collected, not refunded). */
function soldFor(db: Database, offeringId: ID): number {
  return db.orders.filter((o) => o.offeringId === offeringId && o.status !== 'refunded').reduce((a, o) => a + o.qty, 0);
}

function availability(db: Database, o: Offering) {
  const sold = soldFor(db, o.id);
  const limit = o.kind === 'event' ? o.capacity : o.stock;
  const remaining = limit == null ? null : Math.max(0, limit - sold);
  const now = new Date().toISOString();
  const pastDeadline = o.kind === 'event' && ((o.deadline != null && o.deadline < now) || (o.eventDate != null && o.eventDate < now));
  return { sold, remaining, closed: pastDeadline || remaining === 0 };
}

export type OfferingAdminView = Offering & { sold: number; remaining: number | null; closed: boolean; revenue: number; orderCount: number };

/* ---------- API ---------- */

export const api = {
  /** Real-time updates. A real backend would back this with websockets/SSE. */
  subscribe,

  /* ----- meta ----- */

  getSettings: (): Promise<Settings> => read(() => clone(getDb().settings)),

  updateSettings: (patch: Partial<Settings>, actor = 'School Admin'): Promise<Settings> =>
    write(() =>
      mutate((db) => {
        Object.assign(db.settings, patch);
        for (const s of db.schools)
          db.audit.unshift({ id: newId('aud'), schoolId: s.id, at: new Date().toISOString(), actor, action: 'settings_updated', detail: JSON.stringify(patch) });
        return clone(db.settings);
      }, 'settings'),
    ),

  resetDemoData: (): Promise<void> =>
    write(() => {
      replaceDb(generateSeed());
    }),

  listSchools: (): Promise<School[]> => read(() => clone(getDb().schools)),
  listVendors: (schoolId?: ID): Promise<Vendor[]> => read(() => clone(getDb().vendors.filter((v) => !schoolId || v.schoolId === schoolId))),

  /* ----- auth (fake) ----- */

  listDemoParents: (): Promise<Pick<Parent, 'id' | 'name' | 'nameAr' | 'email'>[]> =>
    read(() => getDb().parents.map(({ id, name, nameAr, email }) => ({ id, name, nameAr, email }))),

  login: (email: string, password: string): Promise<Parent> =>
    write(() => {
      const p = getDb().parents.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!p || !password) throw new ApiError('invalid_credentials');
      return clone(p);
    }),

  /* ----- parent app ----- */

  getParent: (parentId: ID): Promise<Parent> =>
    read(() => {
      const p = getDb().parents.find((x) => x.id === parentId);
      if (!p) throw new ApiError('not_found');
      return clone(p);
    }),

  getChildren: (parentId: ID): Promise<(Student & { spentToday: number })[]> =>
    read(() => {
      const db = getDb();
      const today = dayKey();
      return db.students.filter((s) => s.parentId === parentId).map((s) => ({ ...clone(s), spentToday: spentOnDay(db.transactions, s.id, today) }));
    }),

  getStudent: (studentId: ID): Promise<Student & { spentToday: number; school: School; bracelet: Bracelet | null }> =>
    read(() => {
      const db = getDb();
      const s = findStudent(db, studentId);
      return {
        ...clone(s),
        spentToday: spentOnDay(db.transactions, s.id, dayKey()),
        school: clone(db.schools.find((x) => x.id === s.schoolId)!),
        bracelet: clone(db.bracelets.find((b) => b.id === s.braceletId) ?? null),
      };
    }),

  topUp: (req: TopUpRequest): Promise<Transaction> =>
    latency(2.5).then(() => {
      if (!(req.amount >= 10 && req.amount <= 5000)) throw new ApiError('invalid_amount');
      return mutate((db) => {
        const s = findStudent(db, req.studentId);
        const tx: Transaction = {
          id: newId('tx'),
          type: 'topup',
          status: req.simulateFailure ? 'failed' : 'approved',
          studentId: s.id,
          schoolId: s.schoolId,
          amount: round2(req.amount),
          method: req.method,
          createdAt: new Date().toISOString(),
        };
        if (req.simulateFailure) {
          tx.reason = 'payment_failed';
          db.transactions.push(tx);
          return tx;
        }
        s.balance = round2(s.balance + tx.amount);
        tx.balanceAfter = s.balance;
        db.transactions.push(tx);
        notify(db, s, { kind: 'topup', txId: tx.id, amount: tx.amount, params: { method: req.method } });
        return clone(tx);
      }, 'topup');
    }).then((tx) => {
      if (tx.status === 'failed') throw new ApiError('payment_failed');
      return tx;
    }),

  updateControls: (studentId: ID, patch: Partial<StudentControls>): Promise<Student> =>
    write(() =>
      mutate((db) => {
        const s = findStudent(db, studentId);
        if (patch.dailyLimit != null && (patch.dailyLimit < 0 || patch.dailyLimit > 10000)) throw new ApiError('invalid_limit');
        const wasFrozen = s.frozen;
        Object.assign(s, patch);
        if (patch.frozen !== undefined && patch.frozen !== wasFrozen) {
          notify(db, s, { kind: 'frozen', params: { frozen: patch.frozen ? 1 : 0 } });
        }
        return clone(s);
      }, 'controls'),
    ),

  listTransactions: (f: TxFilter): Promise<Transaction[]> =>
    read(() => {
      const db = getDb();
      const out: Transaction[] = [];
      for (let i = db.transactions.length - 1; i >= 0; i--) {
        const tx = db.transactions[i];
        if (matchesFilter(tx, f, db)) out.push(tx);
        if (f.limit && out.length >= f.limit) break;
      }
      return clone(out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }),

  listNotifications: (parentId: ID, limit = 60): Promise<AppNotification[]> =>
    read(() => clone(getDb().notifications.filter((n) => n.parentId === parentId).slice(0, limit))),

  markNotificationsRead: (parentId: ID): Promise<void> =>
    write(() => {
      mutate((db) => {
        for (const n of db.notifications) if (n.parentId === parentId) n.read = true;
      }, 'notifications');
    }),

  getMenuForStudent: (studentId: ID): Promise<MenuItemView[]> =>
    read(() => {
      const db = getDb();
      return clone(menuViewFor(findStudent(db, studentId), db.menu));
    }),

  /* ----- POS ----- */

  listMenu: (): Promise<MenuItem[]> => read(() => clone(getDb().menu)),

  listBracelets: (schoolId: ID): Promise<(Bracelet & { student: Pick<Student, 'id' | 'name' | 'nameAr' | 'grade'> | null })[]> =>
    read(() => {
      const db = getDb();
      return db.bracelets
        .filter((b) => b.schoolId === schoolId && b.studentId)
        .map((b) => {
          const s = db.students.find((x) => x.id === b.studentId);
          return { ...clone(b), student: s ? { id: s.id, name: s.name, nameAr: s.nameAr, grade: s.grade } : null };
        })
        .sort((a, b) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === 'active' ? -1 : 1));
    }),

  /** Data a terminal caches so it can keep authorising while offline. */
  getPosSnapshot: (schoolId: ID) =>
    read(() => {
      const db = getDb();
      const today = dayKey();
      const students = db.students.filter((s) => s.schoolId === schoolId);
      return clone({
        takenAt: new Date().toISOString(),
        menu: db.menu,
        bracelets: db.bracelets.filter((b) => b.schoolId === schoolId),
        students,
        spentToday: Object.fromEntries(students.map((s) => [s.id, spentOnDay(db.transactions, s.id, today)])) as Record<ID, number>,
      });
    }),

  charge: (req: ChargeRequest): Promise<ChargeResult> =>
    latency(req.offline ? 0.3 : 1.2).then(() =>
      mutate((db) => {
        const at = req.at ?? new Date().toISOString();
        const bracelet = db.bracelets.find((b) => b.id === req.braceletId);
        const student = bracelet?.studentId ? db.students.find((s) => s.id === bracelet.studentId) : undefined;
        const vendor = db.vendors.find((v) => v.id === req.vendorId);
        const spentToday = student ? spentOnDay(db.transactions, student.id, dayKey(at)) : 0;
        const ev = evaluateCharge({ bracelet, student, menu: db.menu, lines: req.lines, spentToday });

        if (!student || !bracelet) return { outcome: ev.outcome, reason: ev.reason, total: ev.total } satisfies ChargeResult;

        const lines = req.lines.map((l) => {
          const m = db.menu.find((x) => x.id === l.itemId);
          return { itemId: l.itemId, name: m?.name ?? l.itemId, nameAr: m?.nameAr ?? l.itemId, price: m?.price ?? 0, qty: l.qty };
        });
        const tx: Transaction = {
          id: newId('tx'),
          type: 'purchase',
          status: ev.outcome === 'approved' ? 'approved' : ev.outcome === 'blocked' ? 'blocked' : 'declined',
          studentId: student.id,
          schoolId: student.schoolId,
          vendorId: vendor?.id ?? req.vendorId,
          braceletId: bracelet.id,
          amount: ev.total,
          lines,
          reason: ev.reason,
          reasonDetail: ev.reasonDetail,
          offline: req.offline || undefined,
          syncedAt: req.offline ? new Date().toISOString() : undefined,
          createdAt: at,
        };

        const before = student.balance;
        if (ev.outcome === 'approved') {
          student.balance = round2(student.balance - ev.total);
          tx.balanceAfter = student.balance;
        }
        db.transactions.push(tx);
        if (req.offline) db.transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        // Parent notifications
        if (ev.outcome === 'approved') {
          notify(db, student, { kind: 'purchase', txId: tx.id, amount: tx.amount, params: itemParams(tx), createdAt: at });
          if (before >= student.lowBalanceThreshold && student.balance < student.lowBalanceThreshold) {
            notify(db, student, { kind: 'low_balance', amount: student.balance, params: { threshold: student.lowBalanceThreshold } });
          }
        } else {
          const blockedItem = ev.reasonDetail?.itemId ? db.menu.find((m) => m.id === ev.reasonDetail!.itemId) : undefined;
          notify(db, student, {
            kind: ev.outcome === 'blocked' ? 'blocked' : 'declined',
            txId: tx.id,
            amount: tx.amount,
            reason: ev.reason,
            params: {
              ...itemParams(tx),
              ...(blockedItem ? { item: blockedItem.name, itemAr: blockedItem.nameAr } : {}),
              ...(ev.reasonDetail?.allergen ? { allergen: ev.reasonDetail.allergen } : {}),
              ...(ev.reasonDetail?.category ? { category: ev.reasonDetail.category } : {}),
              ...(ev.reasonDetail?.limit != null ? { limit: ev.reasonDetail.limit } : {}),
            },
            createdAt: at,
          });
        }

        return {
          outcome: ev.outcome,
          reason: ev.reason,
          reasonDetail: ev.reasonDetail,
          transaction: clone(tx),
          student: clone(student),
          total: ev.total,
          balanceAfter: student.balance,
          spentToday: ev.outcome === 'approved' ? round2(spentToday + ev.total) : spentToday,
        } satisfies ChargeResult;
      }, 'charge'),
    ).then((res) => {
      if (res.transaction) broadcast({ type: 'pos-display', vendorId: req.vendorId, txId: res.transaction.id });
      return res;
    }),

  /* ----- school dashboard ----- */

  listStudents: (schoolId: ID, query = ''): Promise<(Student & { bracelet: Bracelet | null; parent: Pick<Parent, 'name' | 'nameAr'> | null; lastActivity: string | null })[]> =>
    read(() => {
      const db = getDb();
      const q = query.trim().toLowerCase();
      const last = new Map<string, string>();
      for (const tx of db.transactions) if (tx.schoolId === schoolId) last.set(tx.studentId, tx.createdAt);
      return db.students
        .filter((s) => s.schoolId === schoolId)
        .filter((s) => !q || [s.name, s.nameAr, s.braceletId ?? '', s.id, `grade ${s.grade}`].join(' ').toLowerCase().includes(q))
        .map((s) => {
          const p = db.parents.find((x) => x.id === s.parentId);
          return {
            ...clone(s),
            bracelet: clone(db.bracelets.find((b) => b.id === s.braceletId) ?? null),
            parent: p ? { name: p.name, nameAr: p.nameAr } : null,
            lastActivity: last.get(s.id) ?? null,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    }),

  listSpareBracelets: (schoolId: ID): Promise<Bracelet[]> =>
    read(() => clone(getDb().bracelets.filter((b) => b.schoolId === schoolId && b.status === 'unassigned'))),

  assignBracelet: (studentId: ID, braceletId: ID, actor = 'School Admin'): Promise<Student> =>
    write(() =>
      mutate((db) => {
        const s = findStudent(db, studentId);
        const b = db.bracelets.find((x) => x.id === braceletId);
        if (!b || b.status !== 'unassigned' || b.schoolId !== s.schoolId) throw new ApiError('bracelet_unavailable');
        if (s.braceletId) throw new ApiError('already_assigned');
        b.status = 'active';
        b.studentId = s.id;
        b.issuedAt = new Date().toISOString();
        s.braceletId = b.id;
        db.audit.unshift({ id: newId('aud'), schoolId: s.schoolId, at: b.issuedAt, actor, action: 'bracelet_assigned', studentId: s.id, detail: `Assigned ${b.id}` });
        notify(db, s, { kind: 'bracelet', params: { bracelet: b.id } });
        return clone(s);
      }, 'bracelet'),
    ),

  /** Lost/damaged bracelet: deactivate old, issue a spare, carry the balance over. */
  replaceBracelet: (studentId: ID, reason: string, actor = 'School Admin'): Promise<{ oldId: ID | null; newId: ID; balance: number }> =>
    latency(1.5).then(() =>
      mutate((db) => {
        const s = findStudent(db, studentId);
        const now = new Date().toISOString();
        const old = db.bracelets.find((b) => b.id === s.braceletId);
        let spare = db.bracelets.find((b) => b.schoolId === s.schoolId && b.status === 'unassigned');
        if (!spare) {
          const school = db.schools.find((x) => x.id === s.schoolId)!;
          spare = { id: `BR-${school.shortCode}-${Math.floor(200000 + Math.random() * 99999)}`, schoolId: s.schoolId, studentId: null, status: 'unassigned', issuedAt: null };
          db.bracelets.push(spare);
        }
        if (old) {
          old.status = 'deactivated';
          old.deactivatedAt = now;
          old.deactivationReason = reason;
        }
        spare.status = 'active';
        spare.studentId = s.id;
        spare.issuedAt = now;
        s.braceletId = spare.id;
        db.transactions.push({
          id: newId('tx'),
          type: 'transfer',
          status: 'approved',
          studentId: s.id,
          schoolId: s.schoolId,
          braceletId: spare.id,
          amount: s.balance,
          balanceAfter: s.balance,
          note: `Balance carried from ${old?.id ?? '—'} to ${spare.id}`,
          createdAt: now,
        });
        db.audit.unshift({
          id: newId('aud'),
          schoolId: s.schoolId,
          at: now,
          actor,
          action: 'bracelet_replaced',
          studentId: s.id,
          amount: s.balance,
          detail: `${old?.id ?? '—'} → ${spare.id} (${reason})`,
        });
        notify(db, s, { kind: 'bracelet', params: { bracelet: spare.id, old: old?.id ?? '' } });
        return { oldId: old?.id ?? null, newId: spare.id, balance: s.balance };
      }, 'bracelet'),
    ),

  refund: (args: { studentId: ID; amount: number; reason: string; txId?: ID; actor?: string }): Promise<Transaction> =>
    write(() =>
      mutate((db) => {
        const s = findStudent(db, args.studentId);
        const amount = round2(args.amount);
        if (!(amount > 0)) throw new ApiError('invalid_amount');
        if (!args.reason.trim()) throw new ApiError('reason_required');
        if (args.txId) {
          const orig = db.transactions.find((t) => t.id === args.txId);
          if (!orig || orig.type !== 'purchase' || orig.status !== 'approved') throw new ApiError('not_refundable');
          const already = db.transactions.filter((t) => t.type === 'refund' && t.note?.includes(`ref ${orig.id}`)).reduce((a, t) => a + t.amount, 0);
          if (amount > round2(orig.amount - already)) throw new ApiError('exceeds_original');
        }
        s.balance = round2(s.balance + amount);
        const tx: Transaction = {
          id: newId('tx'),
          type: 'refund',
          status: 'approved',
          studentId: s.id,
          schoolId: s.schoolId,
          amount,
          balanceAfter: s.balance,
          note: args.txId ? `${args.reason.trim()} (ref ${args.txId})` : args.reason.trim(),
          createdAt: new Date().toISOString(),
        };
        db.transactions.push(tx);
        db.audit.unshift({
          id: newId('aud'),
          schoolId: s.schoolId,
          at: tx.createdAt,
          actor: args.actor ?? 'School Admin',
          action: 'refund',
          studentId: s.id,
          txId: tx.id,
          amount,
          detail: args.reason.trim(),
        });
        notify(db, s, { kind: 'refund', txId: tx.id, amount, params: { note: args.reason.trim() } });
        return clone(tx);
      }, 'refund'),
    ),

  listAudit: (schoolId: ID): Promise<AuditEntry[]> => read(() => clone(getDb().audit.filter((a) => a.schoolId === schoolId))),

  upsertMenuItem: (item: Omit<MenuItem, 'id'> & { id?: ID }, actor = 'School Admin'): Promise<MenuItem> =>
    write(() =>
      mutate((db) => {
        if (!item.name.trim() || !(item.price > 0)) throw new ApiError('invalid_item');
        const now = new Date().toISOString();
        const existing = item.id ? db.menu.find((m) => m.id === item.id) : undefined;
        let saved: MenuItem;
        if (existing) {
          Object.assign(existing, item);
          saved = existing;
        } else {
          saved = { ...item, id: newId('itm') } as MenuItem;
          db.menu.push(saved);
        }
        for (const s of db.schools)
          db.audit.unshift({ id: newId('aud'), schoolId: s.id, at: now, actor, action: existing ? 'menu_updated' : 'menu_created', detail: `${saved.name} @ ${saved.price}` });
        return clone(saved);
      }, 'menu'),
    ),

  getOverview: (schoolId: ID, date = dayKey()): Promise<OverviewStats> =>
    read(() => {
      const db = getDb();
      const yesterday = dayKey(addDays(parseDayKey(date), -1));
      const weekAgo = dayKey(addDays(parseDayKey(date), -7));
      const byHour = Array.from({ length: 24 }, (_, i) => ({ hour: i, sales: 0, count: 0 }));
      const items = new Map<string, { itemId: ID; name: string; nameAr: string; qty: number; revenue: number }>();
      let sales = 0, salesCount = 0, topups = 0, topupCount = 0, refunds = 0, blocked = 0, declined = 0, yesterdaySales = 0;
      const active = new Set<string>();
      let hadYesterday = false;

      for (const tx of db.transactions) {
        if (tx.schoolId !== schoolId) continue;
        const k = dayKey(tx.createdAt);
        if (k > weekAgo && k <= date && tx.status === 'approved') active.add(tx.studentId);
        if (k === yesterday && tx.type === 'purchase' && tx.status === 'approved') {
          yesterdaySales += tx.amount;
          hadYesterday = true;
        }
        if (k !== date) continue;
        if (tx.type === 'purchase') {
          if (tx.status === 'blocked') blocked++;
          else if (tx.status === 'declined') declined++;
          else if (tx.status === 'approved') {
            sales += tx.amount;
            salesCount++;
            const h = new Date(tx.createdAt).getHours();
            const bucket = byHour.find((b) => b.hour === h);
            if (bucket) {
              bucket.sales = round2(bucket.sales + tx.amount);
              bucket.count++;
            }
            for (const l of tx.lines ?? []) {
              const cur = items.get(l.itemId) ?? { itemId: l.itemId, name: l.name, nameAr: l.nameAr, qty: 0, revenue: 0 };
              cur.qty += l.qty;
              cur.revenue = round2(cur.revenue + l.price * l.qty);
              items.set(l.itemId, cur);
            }
          }
        } else if (tx.type === 'topup' && tx.status === 'approved') {
          topups += tx.amount;
          topupCount++;
        } else if (tx.type === 'refund') refunds += tx.amount;
      }
      const students = db.students.filter((s) => s.schoolId === schoolId);
      return {
        date,
        sales: round2(sales),
        salesCount,
        topups: round2(topups),
        topupCount,
        refunds: round2(refunds),
        activeWallets: active.size,
        totalStudents: students.length,
        outstandingBalance: round2(students.reduce((a, s) => a + s.balance, 0)),
        blockedCount: blocked,
        declinedCount: declined,
        // School hours 07–17, widened if anything sold outside them (e.g. evening demos).
        salesByHour: byHour.filter((b, _, all) => {
          const used = all.filter((x) => x.count > 0).map((x) => x.hour);
          return b.hour >= Math.min(7, ...used) && b.hour <= Math.max(17, ...used);
        }),
        topItems: [...items.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
        salesVsYesterday: hadYesterday && yesterdaySales > 0 ? (sales - yesterdaySales) / yesterdaySales : null,
      };
    }),

  getClosingReport: (schoolId: ID, date: string): Promise<ClosingReport> =>
    read(() => {
      const db = getDb();
      const vendors = db.vendors.filter((v) => v.schoolId === schoolId);
      const byVendor = new Map(vendors.map((v) => [v.id, { vendorId: v.id, name: v.name, nameAr: v.nameAr, sales: 0, count: 0 }]));
      const byCategory = new Map<string, { category: MenuItem['category']; sales: number; qty: number }>();
      const methods = new Map<string, { method: string; amount: number; count: number }>();
      let gross = 0, refunds = 0, topups = 0, declined = 0, blocked = 0, offlineSynced = 0, dayNet = 0, afterNet = 0, shopSales = 0, shopFromWallet = 0;
      for (const tx of db.transactions) {
        if (tx.schoolId !== schoolId) continue;
        const k = dayKey(tx.createdAt);
        if (k > date) {
          afterNet += balanceDelta(tx);
          continue;
        }
        if (k !== date) continue;
        dayNet += balanceDelta(tx);
        if (tx.offline) offlineSynced++;
        if (tx.type === 'purchase') {
          if (tx.status === 'declined') declined++;
          if (tx.status === 'blocked') blocked++;
          if (tx.status !== 'approved') continue;
          gross += tx.amount;
          const v = tx.vendorId ? byVendor.get(tx.vendorId) : undefined;
          if (v) {
            v.sales = round2(v.sales + tx.amount);
            v.count++;
          }
          for (const l of tx.lines ?? []) {
            const cat = db.menu.find((m) => m.id === l.itemId)?.category ?? 'snacks';
            const c = byCategory.get(cat) ?? { category: cat, sales: 0, qty: 0 };
            c.sales = round2(c.sales + l.price * l.qty);
            c.qty += l.qty;
            byCategory.set(cat, c);
          }
        } else if (tx.type === 'refund') {
          if (balanceDelta(tx) > 0) refunds += tx.amount;
        } else if (tx.type === 'order' && tx.status === 'approved') {
          shopSales += tx.amount;
          if (tx.method === 'balance') shopFromWallet += tx.amount;
        } else if (tx.type === 'topup' && tx.status === 'approved') {
          topups += tx.amount;
          const m = methods.get(tx.method ?? 'card') ?? { method: tx.method ?? 'card', amount: 0, count: 0 };
          m.amount = round2(m.amount + tx.amount);
          m.count++;
          methods.set(m.method, m);
        }
      }
      const currentFloat = db.students.filter((s) => s.schoolId === schoolId).reduce((a, s) => a + s.balance, 0);
      const closingFloat = round2(currentFloat - afterNet);
      return {
        date,
        schoolId,
        byVendor: [...byVendor.values()],
        byCategory: [...byCategory.values()].sort((a, b) => b.sales - a.sales),
        grossSales: round2(gross),
        refunds: round2(refunds),
        netSales: round2(gross - refunds),
        topups: round2(topups),
        topupsByMethod: [...methods.values()],
        declined,
        blocked,
        offlineSynced,
        shopSales: round2(shopSales),
        shopFromWallet: round2(shopFromWallet),
        openingFloat: round2(closingFloat - dayNet),
        closingFloat,
      };
    }),

  /* ----- school shop: events & store ----- */

  /** Dashboard view of every offering, including hidden ones. */
  listOfferings: (schoolId: ID): Promise<OfferingAdminView[]> =>
    read(() => {
      const db = getDb();
      return clone(
        db.offerings
          .filter((o) => o.schoolId === schoolId)
          .map((o) => {
            const paid = db.orders.filter((r) => r.offeringId === o.id && r.status !== 'refunded');
            return { ...o, ...availability(db, o), revenue: round2(paid.reduce((a, r) => a + r.total, 0)), orderCount: paid.length };
          })
          .sort((a, b) => (a.kind === b.kind ? (a.eventDate ?? a.createdAt).localeCompare(b.eventDate ?? b.createdAt) : a.kind === 'event' ? -1 : 1)),
      );
    }),

  /** What a parent can buy for one child. */
  listOfferingsForStudent: (studentId: ID): Promise<OfferingView[]> =>
    read(() => {
      const db = getDb();
      const s = findStudent(db, studentId);
      return clone(
        db.offerings
          .filter((o) => o.schoolId === s.schoolId && o.active)
          .map((o) => ({
            ...o,
            ...availability(db, o),
            eligible: o.grades.length === 0 || o.grades.includes(s.grade),
            registered: o.kind === 'event' && db.orders.some((r) => r.offeringId === o.id && r.studentId === s.id && r.status !== 'refunded'),
          }))
          .sort((a, b) => (a.kind === b.kind ? (a.eventDate ?? '').localeCompare(b.eventDate ?? '') : a.kind === 'event' ? -1 : 1)),
      );
    }),

  checkout: (req: CheckoutRequest): Promise<Order> =>
    latency(req.method === 'balance' ? 1.2 : 2.5)
      .then(() =>
        mutate((db) => {
          const o = db.offerings.find((x) => x.id === req.offeringId);
          const s = findStudent(db, req.studentId);
          if (!o || !o.active || o.schoolId !== s.schoolId) throw new ApiError('not_found');
          const qty = o.kind === 'event' ? 1 : Math.floor(req.qty);
          if (!(qty >= 1 && qty <= 10)) throw new ApiError('invalid_qty');
          if (o.grades.length && !o.grades.includes(s.grade)) throw new ApiError('not_eligible');
          const av = availability(db, o);
          if (av.closed) throw new ApiError(av.remaining === 0 ? 'sold_out' : 'registration_closed');
          if (av.remaining != null && qty > av.remaining) throw new ApiError('sold_out');
          if (o.sizes?.length && !(req.size && o.sizes.includes(req.size))) throw new ApiError('size_required');
          if (o.kind === 'event' && db.orders.some((r) => r.offeringId === o.id && r.studentId === s.id && r.status !== 'refunded'))
            throw new ApiError('already_registered');

          const total = round2(o.price * qty);
          const now = new Date().toISOString();
          const tx: Transaction = {
            id: newId('tx'),
            type: 'order',
            status: 'approved',
            studentId: s.id,
            schoolId: s.schoolId,
            amount: total,
            method: req.method,
            lines: [{ itemId: o.id, name: o.name + (req.size ? ` (${req.size})` : ''), nameAr: o.nameAr + (req.size ? ` (${req.size})` : ''), price: o.price, qty }],
            createdAt: now,
          };
          if (req.method === 'balance') {
            if (s.balance < total) throw new ApiError('insufficient_balance');
          } else if (req.simulateFailure) {
            tx.status = 'failed';
            tx.reason = 'payment_failed';
            db.transactions.push(tx);
            return null;
          }
          const before = s.balance;
          if (req.method === 'balance') {
            s.balance = round2(s.balance - total);
            tx.balanceAfter = s.balance;
          }
          db.transactions.push(tx);
          const order: Order = {
            id: newId('ord'),
            schoolId: s.schoolId,
            offeringId: o.id,
            kind: o.kind,
            name: o.name,
            nameAr: o.nameAr,
            parentId: req.parentId,
            studentId: s.id,
            qty,
            size: req.size,
            unitPrice: o.price,
            total,
            method: req.method,
            status: 'paid',
            txId: tx.id,
            createdAt: now,
          };
          db.orders.unshift(order);
          notify(db, s, { kind: 'order', txId: tx.id, amount: total, params: { item: o.name, itemAr: o.nameAr, kind: o.kind, method: req.method } });
          if (req.method === 'balance' && before >= s.lowBalanceThreshold && s.balance < s.lowBalanceThreshold) {
            notify(db, s, { kind: 'low_balance', amount: s.balance, params: { threshold: s.lowBalanceThreshold } });
          }
          return clone(order);
        }, 'shop'),
      )
      .then((order) => {
        if (!order) throw new ApiError('payment_failed');
        return order;
      }),

  listOrders: (f: { schoolId?: ID; parentId?: ID; studentId?: ID; offeringId?: ID; status?: OrderStatus | 'all' }): Promise<Order[]> =>
    read(() =>
      clone(
        getDb().orders.filter(
          (o) =>
            (!f.schoolId || o.schoolId === f.schoolId) &&
            (!f.parentId || o.parentId === f.parentId) &&
            (!f.studentId || o.studentId === f.studentId) &&
            (!f.offeringId || o.offeringId === f.offeringId) &&
            (!f.status || f.status === 'all' || o.status === f.status),
        ),
      ),
    ),

  upsertOffering: (input: Omit<Offering, 'id' | 'createdAt'> & { id?: ID }, actor = 'School Admin'): Promise<Offering> =>
    write(() =>
      mutate((db) => {
        if (!input.name.trim() || !input.nameAr.trim() || !(input.price > 0)) throw new ApiError('invalid_item');
        if (input.kind === 'event' && (!input.eventDate || !input.deadline)) throw new ApiError('dates_required');
        if (input.kind === 'event' && input.deadline! > input.eventDate!) throw new ApiError('deadline_after_event');
        const now = new Date().toISOString();
        const existing = input.id ? db.offerings.find((o) => o.id === input.id) : undefined;
        const wasVisible = existing?.active ?? false;
        let saved: Offering;
        if (existing) {
          Object.assign(existing, input);
          saved = existing;
        } else {
          saved = { ...input, id: newId('off'), createdAt: now } as Offering;
          db.offerings.push(saved);
        }
        db.audit.unshift({
          id: newId('aud'),
          schoolId: saved.schoolId,
          at: now,
          actor,
          action: existing ? 'offering_updated' : 'offering_created',
          detail: `${saved.name} @ ${saved.price}${saved.active ? '' : ' (hidden)'}`,
        });
        // Publishing an event tells the parents of every eligible child.
        if (saved.kind === 'event' && saved.active && !wasVisible) {
          for (const s of db.students) {
            if (s.schoolId !== saved.schoolId || !s.parentId) continue;
            if (saved.grades.length && !saved.grades.includes(s.grade)) continue;
            notify(db, s, { kind: 'announcement', amount: saved.price, params: { item: saved.name, itemAr: saved.nameAr, deadline: saved.deadline ?? '' } });
          }
        }
        return clone(saved);
      }, 'shop'),
    ),

  fulfillOrder: (orderId: ID, actor = 'School Admin'): Promise<Order> =>
    write(() =>
      mutate((db) => {
        const o = db.orders.find((x) => x.id === orderId);
        if (!o) throw new ApiError('not_found');
        if (o.status !== 'paid') throw new ApiError('invalid_status');
        o.status = 'fulfilled';
        o.fulfilledAt = new Date().toISOString();
        db.audit.unshift({ id: newId('aud'), schoolId: o.schoolId, at: o.fulfilledAt, actor, action: 'order_fulfilled', studentId: o.studentId, detail: o.name + (o.size ? ` (${o.size})` : '') });
        return clone(o);
      }, 'shop'),
    ),

  /** Refunds go back to the original payment method (wallet balance or card/transfer). */
  refundOrder: (orderId: ID, reason: string, actor = 'School Admin'): Promise<Order> =>
    write(() =>
      mutate((db) => {
        const o = db.orders.find((x) => x.id === orderId);
        if (!o) throw new ApiError('not_found');
        if (o.status === 'refunded') throw new ApiError('invalid_status');
        if (!reason.trim()) throw new ApiError('reason_required');
        const s = findStudent(db, o.studentId);
        const now = new Date().toISOString();
        o.status = 'refunded';
        o.refundedAt = now;
        o.refundReason = reason.trim();
        const tx: Transaction = {
          id: newId('tx'),
          type: 'refund',
          status: 'approved',
          studentId: s.id,
          schoolId: s.schoolId,
          amount: o.total,
          method: o.method,
          note: `${o.name}: ${reason.trim()}`,
          lines: [{ itemId: o.offeringId, name: o.name, nameAr: o.nameAr, price: o.unitPrice, qty: o.qty }],
          createdAt: now,
        };
        if (o.method === 'balance') {
          s.balance = round2(s.balance + o.total);
          tx.balanceAfter = s.balance;
        }
        db.transactions.push(tx);
        db.audit.unshift({ id: newId('aud'), schoolId: o.schoolId, at: now, actor, action: 'order_refunded', studentId: s.id, txId: tx.id, amount: o.total, detail: `${o.name} — ${reason.trim()}` });
        notify(db, s, { kind: 'order_refunded', txId: tx.id, amount: o.total, params: { item: o.name, itemAr: o.nameAr, method: o.method, note: reason.trim() } });
        return clone(o);
      }, 'shop'),
    ),

  getWeeklyReport: (schoolId: ID): Promise<WeeklyReport> =>
    read(() => {
      const db = getDb();
      const thisWeek = startOfWeek(new Date());
      const weeks = Array.from({ length: 4 }, (_, i) => ({
        weekStart: dayKey(addDays(thisWeek, -7 * (3 - i))),
        sales: 0,
        topups: 0,
        refunds: 0,
        blocked: 0,
        declined: 0,
      }));
      const reasons = new Map<DeclineReason, number>();
      const daily = new Map<string, Set<string>>();
      const cut14 = dayKey(addDays(new Date(), -13));
      const cut7 = dayKey(addDays(new Date(), -6));
      const active7 = new Set<string>();
      for (const tx of db.transactions) {
        if (tx.schoolId !== schoolId) continue;
        const k = dayKey(tx.createdAt);
        const ws = dayKey(startOfWeek(new Date(tx.createdAt)));
        const w = weeks.find((x) => x.weekStart === ws);
        if (tx.type === 'purchase' && tx.status === 'approved') {
          if (k >= cut14) {
            if (!daily.has(k)) daily.set(k, new Set());
            daily.get(k)!.add(tx.studentId);
          }
          if (k >= cut7) active7.add(tx.studentId);
        }
        if (tx.reason && tx.type === 'purchase') reasons.set(tx.reason, (reasons.get(tx.reason) ?? 0) + 1);
        if (!w) continue;
        if (tx.type === 'purchase') {
          if (tx.status === 'approved') w.sales = round2(w.sales + tx.amount);
          else if (tx.status === 'blocked') w.blocked++;
          else if (tx.status === 'declined') w.declined++;
        } else if (tx.type === 'topup' && tx.status === 'approved') w.topups = round2(w.topups + tx.amount);
        else if (tx.type === 'refund') w.refunds = round2(w.refunds + tx.amount);
      }
      const students = db.students.filter((s) => s.schoolId === schoolId);
      const dailyActive: WeeklyReport['dailyActive'] = [];
      for (let d = parseDayKey(cut14); dayKey(d) <= dayKey(); d = addDays(d, 1)) {
        const k = dayKey(d);
        if (daily.has(k)) dailyActive.push({ date: k, active: daily.get(k)!.size });
      }
      return {
        weeks,
        blockedByReason: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
        adoption: {
          total: students.length,
          withBracelet: students.filter((s) => s.braceletId).length,
          activeLast7: active7.size,
          parentsLinked: students.filter((s) => s.parentId).length,
        },
        dailyActive,
      };
    }),
};

export type Api = typeof api;
