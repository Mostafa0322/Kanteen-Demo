/**
 * Pure payment rules. Shared by the mock API (authoritative) and by the POS
 * terminal when it is offline and must authorise against a cached snapshot.
 */
import type {
  Allergen,
  Bracelet,
  CartLine,
  Category,
  ChargeOutcome,
  DeclineReason,
  MenuItem,
  MenuItemView,
  Student,
  Transaction,
} from './types';
import { dayKey } from './dates';

export interface BlockReason {
  reason: Extract<DeclineReason, 'blocked_allergy' | 'blocked_item' | 'blocked_category'>;
  allergen?: Allergen;
  category?: Category;
}

export function blockReasonsFor(student: Pick<Student, 'allergies' | 'blockedItemIds' | 'blockedCategories'>, item: MenuItem): BlockReason[] {
  const reasons: BlockReason[] = [];
  for (const a of item.allergens) {
    if (student.allergies.includes(a)) reasons.push({ reason: 'blocked_allergy', allergen: a });
  }
  if (student.blockedItemIds.includes(item.id)) reasons.push({ reason: 'blocked_item' });
  if (student.blockedCategories.includes(item.category)) reasons.push({ reason: 'blocked_category', category: item.category });
  return reasons;
}

export function menuViewFor(student: Student, menu: MenuItem[]): MenuItemView[] {
  return menu.map((item) => {
    const blockReasons = blockReasonsFor(student, item);
    return { ...item, blocked: blockReasons.length > 0, blockReasons };
  });
}

/** Sum of approved purchases on a given day, net of refunds that day. */
export function spentOnDay(transactions: Transaction[], studentId: string, day: string): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.studentId !== studentId || tx.status !== 'approved') continue;
    if (dayKey(tx.createdAt) !== day) continue;
    if (tx.type === 'purchase') total += tx.amount;
  }
  return round2(total);
}

export function cartTotal(lines: CartLine[], menu: MenuItem[]): number {
  return round2(
    lines.reduce((sum, l) => {
      const item = menu.find((m) => m.id === l.itemId);
      return sum + (item ? item.price * l.qty : 0);
    }, 0),
  );
}

export interface Evaluation {
  outcome: ChargeOutcome;
  reason?: DeclineReason;
  reasonDetail?: Transaction['reasonDetail'];
  total: number;
}

/**
 * Order of checks (first failure wins):
 *   bracelet valid → not frozen → items available → parent/allergy blocks →
 *   sufficient balance → within daily limit.
 */
export function evaluateCharge(args: {
  bracelet: Bracelet | undefined;
  student: Student | undefined;
  menu: MenuItem[];
  lines: CartLine[];
  spentToday: number;
}): Evaluation {
  const { bracelet, student, menu, lines, spentToday } = args;
  const total = cartTotal(lines, menu);

  if (!bracelet || !student) return { outcome: 'declined', reason: 'unknown_bracelet', total };
  if (bracelet.status !== 'active' || student.braceletId !== bracelet.id) {
    return { outcome: 'declined', reason: 'inactive_bracelet', total };
  }
  if (student.frozen) return { outcome: 'declined', reason: 'frozen', total };

  for (const line of lines) {
    const item = menu.find((m) => m.id === line.itemId);
    if (!item || !item.available) return { outcome: 'declined', reason: 'item_unavailable', reasonDetail: { itemId: line.itemId }, total };
  }

  for (const line of lines) {
    const item = menu.find((m) => m.id === line.itemId)!;
    const [first] = blockReasonsFor(student, item);
    if (first) {
      return {
        outcome: 'blocked',
        reason: first.reason,
        reasonDetail: { itemId: item.id, allergen: first.allergen, category: first.category },
        total,
      };
    }
  }

  if (student.balance < total) return { outcome: 'declined', reason: 'insufficient_balance', total };

  if (student.dailyLimit != null && spentToday + total > student.dailyLimit) {
    return {
      outcome: 'declined',
      reason: 'daily_limit',
      reasonDetail: { limit: student.dailyLimit, spent: spentToday },
      total,
    };
  }

  return { outcome: 'approved', total };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
