import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Gauge, HeartPulse, ShieldBan, Snowflake, X } from 'lucide-react';
import { ALLERGENS, CATEGORIES, api, blockReasonsFor, type Allergen, type Category, type StudentControls } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Chip, Field, Input, Switch } from '@/ui/Form';
import { Modal } from '@/ui/Modal';
import { ErrorState, LoadingBlock, errorMessage } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { ALLERGEN_EMOJI, CATEGORY_EMOJI } from '@/components/domain';

const LIMIT_PRESETS = [30, 50, 100, 150];
const ALERT_PRESETS = [25, 50, 100, 200];

export function ControlsScreen({ studentId }: { studentId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const toast = useToast();
  const student = useApi(() => api.getStudent(studentId), [studentId]);
  const menu = useApi(() => api.listMenu(), []);
  const [limitOn, setLimitOn] = useState(false);
  const [limit, setLimit] = useState('');
  const [threshold, setThreshold] = useState('');
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const s = student.data;

  // Sync local form state when the student (or the data behind it) changes.
  useEffect(() => {
    if (!s) return;
    setLimitOn(s.dailyLimit != null);
    setLimit(s.dailyLimit != null ? String(s.dailyLimit) : '50');
    setThreshold(String(s.lowBalanceThreshold));
  }, [s?.id, s?.dailyLimit, s?.lowBalanceThreshold]);

  if (student.error) return <ErrorState className="m-4" error={student.error} onRetry={student.reload} />;
  if (!s) return <LoadingBlock className="p-4" rows={5} />;

  const save = async (key: string, patch: Partial<StudentControls>, okMsg: string) => {
    setSaving(key);
    try {
      await api.updateControls(studentId, patch);
      toast({ tone: 'success', title: okMsg });
    } catch (e) {
      toast({ tone: 'error', title: t('common.errorTitle'), body: errorMessage(e, t) });
    } finally {
      setSaving(null);
    }
  };

  const toggleAllergen = (a: Allergen) => {
    const next = s.allergies.includes(a) ? s.allergies.filter((x) => x !== a) : [...s.allergies, a];
    void save('allergy', { allergies: next }, s.allergies.includes(a) ? t('controls.allergyRemoved', { allergen: t(`allergen.${a}`) }) : t('controls.allergyAdded', { allergen: t(`allergen.${a}`) }));
  };
  const toggleCategory = (c: Category) => {
    const next = s.blockedCategories.includes(c) ? s.blockedCategories.filter((x) => x !== c) : [...s.blockedCategories, c];
    void save('category', { blockedCategories: next }, t('controls.saved'));
  };

  const limitNum = Number(limit);
  const limitValid = !limitOn || (Number.isFinite(limitNum) && limitNum > 0 && limitNum <= 10000);
  const limitDirty = limitOn !== (s.dailyLimit != null) || (limitOn && limitNum !== s.dailyLimit);
  const thresholdNum = Number(threshold);
  const thresholdDirty = thresholdNum !== s.lowBalanceThreshold;
  const autoBlocked = menu.data?.filter((m) => blockReasonsFor({ allergies: s.allergies, blockedItemIds: [], blockedCategories: [] }, m).length > 0) ?? [];
  const blockedItems = menu.data?.filter((m) => s.blockedItemIds.includes(m.id)) ?? [];

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{t('controls.title')}</h1>
        <p className="text-sm text-slate-600">{t('controls.subtitle', { name: n(s) })}</p>
      </div>

      {/* Freeze */}
      <Card className={s.frozen ? 'border-red-300 bg-red-50/50 p-4' : 'p-4'}>
        <Switch
          checked={s.frozen}
          tone="danger"
          disabled={saving === 'freeze'}
          onChange={(v) => (v ? setConfirmFreeze(true) : save('freeze', { frozen: false }, t('controls.unfrozenToast')))}
          label={
            <span className="flex items-center gap-2">
              <Snowflake className="size-5 text-sky-600" /> {t('controls.freeze')}
            </span>
          }
          description={s.frozen ? t('controls.freezeOn') : t('controls.freezeOff')}
        />
      </Card>

      {/* Daily limit */}
      <Card className="p-4">
        <Switch
          checked={limitOn}
          onChange={setLimitOn}
          label={
            <span className="flex items-center gap-2">
              <Gauge className="size-5 text-brand-700" /> {t('controls.dailyLimit')}
            </span>
          }
          description={s.dailyLimit != null ? t('controls.limitCurrent', { limit: money(s.dailyLimit) }) : t('controls.limitNone')}
        />
        {limitOn && (
          <div className="mt-3 space-y-3 animate-fade">
            <div className="flex flex-wrap gap-2">
              {LIMIT_PRESETS.map((p) => (
                <Chip key={p} selected={limitNum === p} onClick={() => setLimit(String(p))}>
                  {money(p)}
                </Chip>
              ))}
            </div>
            <Field label={t('controls.customLimit')} error={!limitValid ? t('controls.limitInvalid') : undefined}>
              {(id) => <Input id={id} type="number" inputMode="decimal" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />}
            </Field>
          </div>
        )}
        {limitDirty && (
          <Button
            className="mt-3"
            block
            disabled={!limitValid}
            loading={saving === 'limit'}
            onClick={() => save('limit', { dailyLimit: limitOn ? limitNum : null }, limitOn ? t('controls.limitSaved', { limit: money(limitNum) }) : t('controls.limitRemoved'))}
          >
            {t('controls.saveLimit')}
          </Button>
        )}
      </Card>

      {/* Allergies */}
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <HeartPulse className="size-5 text-red-600" /> {t('controls.allergies')}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">{t('controls.allergiesHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip key={a} tone="danger" selected={s.allergies.includes(a)} disabled={saving === 'allergy'} onClick={() => toggleAllergen(a)} icon={<span aria-hidden="true">{ALLERGEN_EMOJI[a]}</span>}>
              {t(`allergen.${a}`)}
            </Chip>
          ))}
        </div>
        {s.allergies.length > 0 && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            {t('controls.autoBlocked', { count: autoBlocked.length })}{' '}
            <Link to="/parent/menu?filter=blocked" className="font-semibold underline">
              {t('controls.viewMenu')}
            </Link>
          </p>
        )}
      </Card>

      {/* Category & item blocks */}
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <ShieldBan className="size-5 text-violet-700" /> {t('controls.blockCategories')}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">{t('controls.blockCategoriesHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c} selected={s.blockedCategories.includes(c)} disabled={saving === 'category'} onClick={() => toggleCategory(c)} icon={<span aria-hidden="true">{CATEGORY_EMOJI[c]}</span>}>
              {t(`category.${c}`)}
            </Chip>
          ))}
        </div>
        <h3 className="mt-5 text-sm font-semibold text-slate-800">{t('controls.blockedItems')}</h3>
        {blockedItems.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">
            {t('controls.noBlockedItems')}{' '}
            <Link to="/parent/menu" className="font-semibold text-brand-700 underline">
              {t('controls.browseMenu')}
            </Link>
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {blockedItems.map((m) => (
              <li key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 py-1 ps-3 pe-1 text-sm text-violet-900 ring-1 ring-violet-200">
                <span aria-hidden="true">{m.emoji}</span> {n(m)}
                <button
                  type="button"
                  aria-label={t('controls.unblockItem', { item: n(m) })}
                  onClick={() => save('items', { blockedItemIds: s.blockedItemIds.filter((x) => x !== m.id) }, t('controls.saved'))}
                  className="rounded-full p-1 hover:bg-violet-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Low balance alert */}
      <Card className="p-4">
        <h2 className="flex items-center gap-2 font-medium text-slate-900">
          <Bell className="size-5 text-amber-600" /> {t('controls.lowBalance')}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">{t('controls.lowBalanceHint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALERT_PRESETS.map((p) => (
            <Chip key={p} selected={thresholdNum === p} onClick={() => setThreshold(String(p))}>
              {money(p)}
            </Chip>
          ))}
        </div>
        {thresholdDirty && (
          <Button
            className="mt-3"
            block
            disabled={!(thresholdNum >= 0)}
            loading={saving === 'threshold'}
            onClick={() => save('threshold', { lowBalanceThreshold: thresholdNum }, t('controls.thresholdSaved', { amount: money(thresholdNum) }))}
          >
            {t('common.save')}
          </Button>
        )}
      </Card>

      <Modal
        open={confirmFreeze}
        onClose={() => setConfirmFreeze(false)}
        title={t('controls.freezeConfirmTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmFreeze(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={<Snowflake className="size-4" />}
              onClick={async () => {
                setConfirmFreeze(false);
                await save('freeze', { frozen: true }, t('controls.frozenToast'));
              }}
            >
              {t('controls.freezeConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-slate-700">{t('controls.freezeConfirmBody', { name: n(s) })}</p>
      </Modal>
    </div>
  );
}
