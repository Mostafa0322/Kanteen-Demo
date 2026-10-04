import { ChevronRight, LogOut } from 'lucide-react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Avatar } from '@/ui/Misc';
import { ErrorState, LoadingBlock } from '@/ui/States';
import { Button } from '@/ui/Button';
import { useParentSession } from './session';

export function ChildPicker() {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const { parentId, selectChild, logout } = useParentSession();
  const parent = useApi(() => api.getParent(parentId!), [parentId]);
  const kids = useApi(() => api.getChildren(parentId!), [parentId]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pt-8 pb-6">
      <p className="text-sm text-slate-600">{t('picker.hello', { name: parent.data ? n(parent.data) : '' })}</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{t('picker.title')}</h1>
      <div className="mt-6 flex-1 space-y-3">
        {kids.loading && <LoadingBlock rows={2} />}
        {kids.error != null && <ErrorState error={kids.error} onRetry={kids.reload} />}
        {kids.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selectChild(c.id)}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-brand-300 hover:shadow"
          >
            <Avatar name={c.name} color={c.avatarColor} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-slate-900">{n(c)}</span>
              <span className="block text-sm text-slate-600">{t('common.grade', { grade: c.grade })}</span>
              <span className="mt-1 block text-sm font-semibold text-brand-700">{money(c.balance)}</span>
            </span>
            <ChevronRight className="size-5 text-slate-400 rtl:rotate-180" aria-hidden="true" />
          </button>
        ))}
      </div>
      <Button variant="ghost" icon={<LogOut className="size-4 rtl:rotate-180" />} onClick={logout}>
        {t('parent.logout')}
      </Button>
    </div>
  );
}
