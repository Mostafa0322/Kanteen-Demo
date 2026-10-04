import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ALLERGENS, CATEGORIES, api, type MenuItem } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip, Field, Input, Select, Switch } from '@/ui/Form';
import { PageTitle } from '@/ui/Misc';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock, errorMessage } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { ALLERGEN_EMOJI, AllergenBadge } from '@/components/domain';

type Draft = Omit<MenuItem, 'id'> & { id?: string };
const EMPTY: Draft = { name: '', nameAr: '', price: 20, category: 'snacks', allergens: [], available: true, emoji: '🍽️' };

export function MenuManagement() {
  const { t, n, money } = useI18n();
  const toast = useToast();
  const menu = useApi(() => api.listMenu(), []);
  const [editing, setEditing] = useState<Draft | null>(null);

  const toggleAvailable = async (m: MenuItem) => {
    await api.upsertMenuItem({ ...m, available: !m.available });
    toast({ tone: 'success', title: t(m.available ? 'menuMgmt.markedOut' : 'menuMgmt.markedIn', { item: n(m) }) });
  };

  return (
    <>
      <PageTitle
        title={t('menuMgmt.title')}
        subtitle={t('menuMgmt.subtitle', { count: menu.data?.length ?? 0 })}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing({ ...EMPTY })}>
            {t('menuMgmt.add')}
          </Button>
        }
      />
      {menu.loading ? (
        <LoadingBlock rows={6} />
      ) : menu.error ? (
        <ErrorState error={menu.error} onRetry={menu.reload} />
      ) : !menu.data!.length ? (
        <EmptyState title={t('menu.empty')} />
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((c) => {
            const items = menu.data!.filter((m) => m.category === c);
            if (!items.length) return null;
            return (
              <section key={c}>
                <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-600 uppercase">{t(`category.${c}`)}</h2>
                <Card className="divide-y divide-slate-100">
                  {items.map((m) => (
                    <div key={m.id} className={cx('flex flex-wrap items-center gap-4 px-4 py-3', !m.available && 'bg-slate-50')}>
                      <span className="text-3xl" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <div className="min-w-48 flex-1">
                        <p className="font-semibold">{n(m)}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.allergens.length ? m.allergens.map((a) => <AllergenBadge key={a} allergen={a} />) : <span className="text-xs text-slate-500">{t('menu.noAllergens')}</span>}
                        </div>
                      </div>
                      <span className="w-24 text-end font-bold tabular-nums">{money(m.price)}</span>
                      <div className="w-44">
                        <Switch checked={m.available} onChange={() => toggleAvailable(m)} label={<span className="text-sm">{m.available ? t('menuMgmt.available') : t('menu.unavailable')}</span>} />
                      </div>
                      <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing({ ...m })}>
                        {t('common.edit')}
                      </Button>
                    </div>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
      {editing && <EditItem draft={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditItem({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [d, setD] = useState<Draft>(draft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = d.name.trim() && d.nameAr.trim() && d.price > 0;

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      await api.upsertMenuItem(d);
      toast({ tone: 'success', title: t('menuMgmt.saved') });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={d.id ? t('menuMgmt.editTitle') : t('menuMgmt.addTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={pending} disabled={!valid} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('menuMgmt.nameEn')}>{(id) => <Input id={id} dir="ltr" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <Field label={t('menuMgmt.nameAr')}>{(id) => <Input id={id} dir="rtl" value={d.nameAr} onChange={(e) => setD({ ...d, nameAr: e.target.value })} />}</Field>
        <Field label={t('menuMgmt.price')} error={d.price > 0 ? undefined : t('menuMgmt.priceInvalid')}>
          {(id) => <Input id={id} type="number" min={1} step={0.5} value={d.price} onChange={(e) => setD({ ...d, price: Number(e.target.value) })} />}
        </Field>
        <Field label={t('menuMgmt.emoji')}>{(id) => <Input id={id} value={d.emoji} maxLength={4} onChange={(e) => setD({ ...d, emoji: e.target.value })} />}</Field>
        <Field className="col-span-2" label={t('menuMgmt.category')}>
          {(id) => (
            <Select id={id} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Draft['category'] })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="col-span-2">
          <p className="mb-1.5 text-sm font-medium text-slate-800">{t('menuMgmt.allergens')}</p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip
                key={a}
                tone="danger"
                selected={d.allergens.includes(a)}
                onClick={() => setD({ ...d, allergens: d.allergens.includes(a) ? d.allergens.filter((x) => x !== a) : [...d.allergens, a] })}
                icon={<span aria-hidden="true">{ALLERGEN_EMOJI[a]}</span>}
              >
                {t(`allergen.${a}`)}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-600">{t('menuMgmt.allergensHint')}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-slate-50 p-3">
          <Switch checked={d.available} onChange={(v) => setD({ ...d, available: v })} label={t('menuMgmt.available')} />
        </div>
        {error != null && (
          <p role="alert" className="col-span-2 text-sm text-red-700">
            {errorMessage(error, t)}
          </p>
        )}
      </div>
    </Modal>
  );
}
