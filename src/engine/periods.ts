function lastSunday(year: number, monthIndex: number): number {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}

function parts(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return [y, mo, d];
}

export function isValidDate(date: string): boolean {
  return parts(date) !== null;
}

/** GB settlement periods in a local day: 46 on the spring clock change, 50 in autumn, else 48. */
export function expectedPeriods(date: string): number {
  const p = parts(date);
  if (!p) return 48;
  const [y, mo, d] = p;
  if (mo === 3 && d === lastSunday(y, 2)) return 46;
  if (mo === 10 && d === lastSunday(y, 9)) return 50;
  return 48;
}

function bstAtLocalMidnight(y: number, mo: number, d: number): boolean {
  const day = Date.UTC(y, mo - 1, d);
  const start = Date.UTC(y, 2, lastSunday(y, 2));
  const end = Date.UTC(y, 9, lastSunday(y, 9));
  return day > start && day <= end;
}

export function periodStartUtc(date: string, sp: number): Date {
  const p = parts(date);
  if (!p) return new Date(NaN);
  const [y, mo, d] = p;
  const midnight = Date.UTC(y, mo - 1, d) - (bstAtLocalMidnight(y, mo, d) ? 3600_000 : 0);
  return new Date(midnight + (sp - 1) * 1800_000);
}

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

export function periodLabel(date: string, sp: number): string {
  const t = periodStartUtc(date, sp);
  if (Number.isNaN(t.getTime())) return `SP ${sp}`;
  return `SP ${sp} · ${fmt.format(t)}`;
}
