export interface FontesDateRange {
  start: string | undefined;
  end: string | undefined;
}

const DATE = String.raw`[12]\d{3}(?:-(?:1[0-2]|0[1-9])(?:-(?:3[01]|[12]\d|0[1-9]))?)?`;
const SINGLE = new RegExp(`^(${DATE})\\??$`);
const INTERVAL = new RegExp(`^(${DATE})?/(${DATE})?$`);
const IMPRECISE = /^[12]\d[X\d]X$/;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const existsInCalendar = (date: string) =>
  date.length < 10 ||
  Number(date.slice(8)) <=
    daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));

const firstDay = (date: string) =>
  date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date;

const lastDay = (date: string) =>
  date.length === 4
    ? `${date}-12-31`
    : date.length === 7
      ? `${date}-${daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5)))}`
      : date;

export function parseFontesDate(text: string): FontesDateRange | undefined {
  const value = text.trim();

  if (IMPRECISE.test(value)) {
    const known = value.replace(/X/g, "");
    return {
      start: `${(known + "000").slice(0, 4)}-01-01`,
      end: `${(known + "999").slice(0, 4)}-12-31`
    };
  }

  const single = SINGLE.exec(value);
  if (single) {
    const [, date] = single;
    if (!existsInCalendar(date)) return undefined;
    return { start: firstDay(date), end: lastDay(date) };
  }

  const interval = INTERVAL.exec(value);
  if (!interval) return undefined;
  const [, from, to] = interval;
  if (!from && !to) return undefined;
  if ((from && !existsInCalendar(from)) || (to && !existsInCalendar(to)))
    return undefined;
  if (from && to && firstDay(to) <= firstDay(from)) return undefined;
  return {
    start: from ? firstDay(from) : undefined,
    end: to ? lastDay(to) : undefined
  };
}
