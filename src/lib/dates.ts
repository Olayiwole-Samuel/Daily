import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type { ISODate, Weekday } from '../types';

// We always store dates as 'YYYY-MM-DD' strings in LOCAL time.
// toISOString() would use UTC and shift the date near midnight, so we use format().
export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

// parseISO('2026-11-09') gives local midnight, which is what we want.
export function fromISODate(iso: ISODate): Date {
  return parseISO(iso);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  return toISODate(addDays(fromISODate(iso), days));
}

// Monday of the week containing this date.
export function weekStart(iso: ISODate): ISODate {
  return toISODate(startOfWeek(fromISODate(iso), { weekStartsOn: 1 }));
}

// The 7 dates of the week starting at weekStartIso (Mon..Sun).
export function weekDays(weekStartIso: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartIso, i));
}

// JS getDay() is 0 = Sunday. Our Weekday is 0 = Monday, so shift by 6 and wrap.
export function weekdayIndex(iso: ISODate): Weekday {
  return ((fromISODate(iso).getDay() + 6) % 7) as Weekday;
}

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function formatLong(iso: ISODate): string {
  return format(fromISODate(iso), 'EEEE, d MMM');
}

// '9–15 Nov' or '29 Dec – 4 Jan' when the week spans two months.
export function formatWeekRange(weekStartIso: ISODate): string {
  const start = fromISODate(weekStartIso);
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'd')}–${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
}

// Simple unique id. crypto.randomUUID exists in all modern browsers.
export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
