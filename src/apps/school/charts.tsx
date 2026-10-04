import { useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Chart tokens. Single-series charts use the brand hue; multi-series charts
 * take categorical slots in fixed order (validated for CVD separation).
 */
export const CHART = {
  single: '#0f806e',
  series: ['#2a78d6', '#eb6834'] as const,
  grid: '#e2e8f0',
  axis: '#64748b',
  cursor: '#f1f5f9',
};

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: CHART.axis, fontSize: 12 },
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

/** Shared tooltip: values in text ink, a colour swatch carries identity. */
export function ChartTooltip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TooltipEntry[]; label?: string | number; format: (v: number) => string; labelFormat?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-slate-900">{labelFormat && label != null ? labelFormat(label) : label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-slate-700">
          {payload.length > 1 && <span className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} aria-hidden="true" />}
          {payload.length > 1 && <span>{p.name}</span>}
          <span className="ms-auto font-semibold text-slate-900 tabular-nums">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-slate-700">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Wraps a chart with a chart/table toggle so data is never colour- or hover-only. */
export function ChartFrame({ chart, columns, rows, legend }: { chart: ReactNode; columns: string[]; rows: ReactNode[][]; legend?: ReactNode }) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>{legend}</div>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          aria-pressed={table}
        >
          {table ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {table ? t('chart.showChart') : t('chart.showTable')}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600">
              <tr>
                {columns.map((c, i) => (
                  <th key={c} className={i === 0 ? 'px-3 py-2 text-start font-semibold' : 'px-3 py-2 text-end font-semibold'}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci} className={ci === 0 ? 'px-3 py-1.5' : 'px-3 py-1.5 text-end tabular-nums'}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div dir="ltr">{chart}</div>
      )}
    </div>
  );
}
