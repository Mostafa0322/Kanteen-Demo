import type { AppNotification, Allergen, Category } from '@/mock-api';
import type { I18n } from '@/i18n/I18nProvider';
import { reasonText } from '@/components/domain';

export interface NotificationText {
  title: string;
  body: string;
  tone: 'success' | 'error' | 'info' | 'warning';
}

export function notificationText(i: I18n, x: AppNotification, child: string): NotificationText {
  const { t, money } = i;
  const p = x.params ?? {};
  const items = String((i.lang === 'ar' ? p.itemsAr : p.items) ?? '');
  const item = String((i.lang === 'ar' ? p.itemAr : p.item) ?? items);
  switch (x.kind) {
    case 'purchase':
      return { tone: 'info', title: t('notif.purchase.title', { child }), body: t('notif.purchase.body', { items, amount: money(x.amount ?? 0) }) };
    case 'blocked':
      return {
        tone: 'error',
        title: t('notif.blocked.title'),
        body: t('notif.blocked.body', {
          child,
          item,
          reason: reasonText(i, x.reason, { allergen: p.allergen as Allergen | undefined, category: p.category as Category | undefined }, item),
        }),
      };
    case 'declined':
      return {
        tone: 'warning',
        title: t('notif.declined.title'),
        body: t('notif.declined.body', { child, amount: money(x.amount ?? 0), reason: reasonText(i, x.reason, { limit: Number(p.limit ?? 0) }) }),
      };
    case 'low_balance':
      return { tone: 'warning', title: t('notif.low.title'), body: t('notif.low.body', { child, amount: money(x.amount ?? 0), threshold: money(Number(p.threshold ?? 0)) }) };
    case 'topup':
      return { tone: 'success', title: t('notif.topup.title'), body: t('notif.topup.body', { child, amount: money(x.amount ?? 0) }) };
    case 'refund':
      return { tone: 'success', title: t('notif.refund.title'), body: t('notif.refund.body', { child, amount: money(x.amount ?? 0), note: String(p.note ?? '') }) };
    case 'frozen':
      return p.frozen
        ? { tone: 'warning', title: t('notif.frozen.title'), body: t('notif.frozen.body', { child }) }
        : { tone: 'success', title: t('notif.unfrozen.title'), body: t('notif.unfrozen.body', { child }) };
    case 'bracelet':
      return { tone: 'info', title: t('notif.bracelet.title'), body: t('notif.bracelet.body', { child, bracelet: String(p.bracelet ?? '') }) };
  }
}
