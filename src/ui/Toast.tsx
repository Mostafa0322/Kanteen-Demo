import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, ShieldAlert, XCircle, X } from 'lucide-react';
import { cx } from '@/lib/cx';

type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const ToastContext = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="size-5 text-emerald-600" />,
  error: <XCircle className="size-5 text-red-600" />,
  warning: <ShieldAlert className="size-5 text-amber-600" />,
  info: <Info className="size-5 text-sky-600" />,
};

/** Toasts render inside the provider's own box, so a phone frame keeps them on-screen. */
export function ToastProvider({ children, position = 'fixed' }: { children: ReactNode; position?: 'fixed' | 'absolute' }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = nextId.current++;
    setItems((cur) => [...cur.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className={cx(position, 'pointer-events-none inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3')}>
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur animate-slide-up">
            <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.body && <p className="text-sm text-slate-600">{t.body}</p>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-slate-700">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
