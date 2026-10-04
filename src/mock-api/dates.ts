/** Local-time date helpers. Day keys are YYYY-MM-DD in the browser's timezone. */

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(input: Date | string = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/** Week starts on Sunday (Egyptian school week runs Sunday–Thursday). */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

/** Friday and Saturday are the weekend in Egypt. */
export function isSchoolDay(d: Date): boolean {
  const wd = d.getDay();
  return wd !== 5 && wd !== 6;
}
