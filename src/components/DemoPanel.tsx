import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Columns3, ExternalLink, Play, PlayCircle, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Spinner, errorMessage } from '@/ui/States';
import { Select } from '@/ui/Form';
import { DEMO_STEPS, resetScenario, type StepLog } from '@/demo/script';

type StepState = 'idle' | 'running' | 'done' | 'error';

const toneClass: Record<StepLog['tone'], string> = {
  info: 'text-slate-700',
  success: 'text-emerald-800',
  danger: 'text-red-700 font-semibold',
  warning: 'text-amber-800 font-semibold',
};

export function DemoPanel({ defaultOpen = false, docked = false }: { defaultOpen?: boolean; docked?: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [open, setOpen] = useState(defaultOpen);
  const [states, setStates] = useState<Record<number, StepState>>({});
  const [logs, setLogs] = useState<Record<number, StepLog[]>>({});
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const settings = useApi(() => api.getSettings(), []);

  const runStep = async (id: number) => {
    const step = DEMO_STEPS.find((s) => s.id === id)!;
    setStates((s) => ({ ...s, [id]: 'running' }));
    try {
      const out = await step.run();
      setLogs((l) => ({ ...l, [id]: out }));
      setStates((s) => ({ ...s, [id]: 'done' }));
      return true;
    } catch (e) {
      setLogs((l) => ({ ...l, [id]: [{ tone: 'danger', text: (i) => errorMessage(e, i.t) }] }));
      setStates((s) => ({ ...s, [id]: 'error' }));
      return false;
    }
  };

  const guard = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const runAll = () =>
    guard(async () => {
      await resetScenario();
      setStates({});
      setLogs({});
      for (const s of DEMO_STEPS) {
        if (!(await runStep(s.id))) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    });

  const doResetScenario = () =>
    guard(async () => {
      const out = await resetScenario();
      setStates({});
      setLogs({ 0: out });
    });

  const doResetAll = () =>
    guard(async () => {
      await api.resetDemoData();
      setConfirmReset(false);
      setStates({});
      setLogs({});
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('demo.open')}
        // On phones it sits above bottom tab bars and shrinks to an icon.
        className="fixed bottom-20 end-3 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 p-3 text-sm font-semibold text-white shadow-xl ring-2 ring-amber-400 hover:bg-slate-800 sm:bottom-4 sm:end-4 sm:px-4"
      >
        <Sparkles className="size-5 text-amber-400 sm:size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t('demo.open')}</span>
      </button>
    );
  }

  return (
    <aside
      aria-label={t('demo.title')}
      className={cx(
        'z-50 flex flex-col overflow-hidden bg-white',
        docked ? 'h-full w-full' : 'fixed inset-x-3 bottom-3 max-h-[80vh] rounded-2xl shadow-2xl ring-1 ring-slate-200 animate-slide-up sm:inset-x-auto sm:end-4 sm:bottom-4 sm:w-[400px]',
      )}
    >
      <header className="flex items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-400" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">{t('demo.title')}</h2>
            <p className="text-xs text-slate-300">{t('demo.subtitle')}</p>
          </div>
        </div>
        {!docked && (
          <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X className="size-5" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        <Button block size="lg" icon={<PlayCircle className="size-5" />} onClick={runAll} loading={busy && Object.values(states).includes('running')} disabled={busy}>
          {t('demo.runAll')}
        </Button>

        <ol className="space-y-2">
          {DEMO_STEPS.map((step) => {
            const st = states[step.id] ?? 'idle';
            return (
              <li key={step.id} className={cx('rounded-xl border p-3', st === 'done' ? 'border-emerald-200 bg-emerald-50/50' : st === 'error' ? 'border-red-200 bg-red-50/50' : 'border-slate-200')}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0" aria-hidden="true">
                    {st === 'running' ? <Spinner className="size-5 text-brand-700" /> : st === 'done' ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-slate-300" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {step.id}. {t(step.title)}
                    </p>
                    <p className="text-sm text-slate-600">{t(step.description)}</p>
                    {logs[step.id] && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {logs[step.id].map((l, i) => (
                          <li key={i} className={toneClass[l.tone]}>
                            • {l.text(i18n)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.id === 4 && st === 'done' && !docked && (
                      <a href="/school" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                        {t('demo.openDashboard')} <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" icon={<Play className="size-3.5" />} onClick={() => guard(() => runStep(step.id))} disabled={busy} aria-label={`${t('demo.run')} ${step.id}`}>
                    {t('demo.run')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>

        {logs[0] && <p className="text-sm text-slate-600">{logs[0][0].text(i18n)}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={doResetScenario} disabled={busy}>
            {t('demo.resetScenario')}
          </Button>
          {confirmReset ? (
            <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={doResetAll} loading={busy}>
              {t('demo.confirmReset')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setConfirmReset(true)} disabled={busy}>
              {t('demo.resetAll')}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <label htmlFor="latency" className="text-sm font-medium text-slate-700">
            {t('demo.latency')}
          </label>
          <Select
            id="latency"
            className="!w-36"
            value={String(settings.data?.latencyMs ?? 250)}
            onChange={(e) => api.updateSettings({ latencyMs: Number(e.target.value) }, 'Demo')}
          >
            <option value="0">{t('demo.latency.instant')}</option>
            <option value="250">{t('demo.latency.normal')}</option>
            <option value="900">{t('demo.latency.slow')}</option>
          </Select>
        </div>

        {!docked && (
          <div className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
            <Link to="/demo" className="flex items-center gap-2 font-semibold text-brand-700 hover:underline">
              <Columns3 className="size-4" /> {t('demo.splitScreen')}
            </Link>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {(['parent', 'pos', 'school'] as const).map((r) => (
                <a key={r} href={`/${r}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-700 hover:text-brand-700 hover:underline">
                  {t(`nav.${r}`)} <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
