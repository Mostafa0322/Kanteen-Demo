/**
 * The scripted live demo. Every step goes through the public API exactly like
 * the real UIs do, so all open tabs/iframes update in real time.
 */
import { api, DEMO_STUDENT_ID, DEMO_VENDOR_ID, type ChargeResult } from '@/mock-api';
import type { MessageKey } from '@/i18n/en';
import type { I18n } from '@/i18n/I18nProvider';
import { reasonText } from '@/components/domain';

export interface StepLog {
  tone: 'info' | 'success' | 'danger' | 'warning';
  text: (i: I18n) => string;
}

export interface DemoStep {
  id: number;
  title: MessageKey;
  description: MessageKey;
  run: () => Promise<StepLog[]>;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NUT_ITEM = 'itm_pb_cookie';
const FIRST_ITEM = 'itm_koshari';
const SECOND_ITEM = 'itm_chips';

function chargeLog(res: ChargeResult): StepLog {
  const line = res.transaction?.lines?.[0];
  const item = (i: I18n) => (line ? i.n(line) : '');
  if (res.outcome === 'approved')
    return { tone: 'success', text: (i) => i.t('demo.log.approved', { item: item(i), amount: i.money(res.total), balance: i.money(res.balanceAfter ?? 0) }) };
  return {
    tone: res.outcome === 'blocked' ? 'danger' : 'warning',
    text: (i) => i.t(res.outcome === 'blocked' ? 'demo.log.blocked' : 'demo.log.declined', { item: item(i), reason: reasonText(i, res.reason, res.reasonDetail, item(i)) }),
  };
}

async function chargeDemoChild(itemId: string) {
  const s = await api.getStudent(DEMO_STUDENT_ID);
  if (!s.braceletId) throw new Error('Demo student has no bracelet');
  return api.charge({ braceletId: s.braceletId, vendorId: DEMO_VENDOR_ID, lines: [{ itemId, qty: 1 }] });
}

/** Put the demo child back to a clean state without wiping history. */
export async function resetScenario(): Promise<StepLog[]> {
  const s = await api.getStudent(DEMO_STUDENT_ID);
  await api.updateControls(DEMO_STUDENT_ID, {
    allergies: s.allergies.filter((a) => a !== 'nuts'),
    dailyLimit: null,
    frozen: false,
    blockedItemIds: [],
    blockedCategories: [],
  });
  return [{ tone: 'info', text: (i) => i.t('demo.log.scenarioReset') }];
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    title: 'demo.step1.title',
    description: 'demo.step1.desc',
    run: async () => {
      const before = await api.getStudent(DEMO_STUDENT_ID);
      const tx = await api.topUp({ studentId: DEMO_STUDENT_ID, amount: 200, method: 'card' });
      return [{ tone: 'success', text: (i) => i.t('demo.log.toppedUp', { amount: i.money(tx.amount), before: i.money(before.balance), after: i.money(tx.balanceAfter ?? 0) }) }];
    },
  },
  {
    id: 2,
    title: 'demo.step2.title',
    description: 'demo.step2.desc',
    run: async () => {
      const s = await api.getStudent(DEMO_STUDENT_ID);
      if (!s.allergies.includes('nuts')) await api.updateControls(DEMO_STUDENT_ID, { allergies: [...s.allergies, 'nuts'] });
      const logs: StepLog[] = [{ tone: 'info', text: (i) => i.t('demo.log.nutsBlocked') }];
      await pause(900);
      logs.push(chargeLog(await chargeDemoChild(NUT_ITEM)));
      logs.push({ tone: 'info', text: (i) => i.t('demo.log.parentNotified') });
      return logs;
    },
  },
  {
    id: 3,
    title: 'demo.step3.title',
    description: 'demo.step3.desc',
    run: async () => {
      await api.updateControls(DEMO_STUDENT_ID, { dailyLimit: 50 });
      const logs: StepLog[] = [{ tone: 'info', text: (i) => i.t('demo.log.limitSet', { limit: i.money(50) }) }];
      await pause(900);
      logs.push(chargeLog(await chargeDemoChild(FIRST_ITEM)));
      await pause(2200);
      logs.push(chargeLog(await chargeDemoChild(SECOND_ITEM)));
      return logs;
    },
  },
  {
    id: 4,
    title: 'demo.step4.title',
    description: 'demo.step4.desc',
    run: async () => {
      const s = await api.getStudent(DEMO_STUDENT_ID);
      const o = await api.getOverview(s.schoolId);
      return [{ tone: 'success', text: (i) => i.t('demo.log.dashboard', { sales: i.money(o.sales), topups: i.money(o.topups), blocked: o.blockedCount, declined: o.declinedCount }) }];
    },
  },
];
