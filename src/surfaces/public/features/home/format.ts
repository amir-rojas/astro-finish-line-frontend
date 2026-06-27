// Helpers de formato para la home pública. Locale es-BO, fechas en UTC para
// evitar corrimientos de día (las fechas del evento son fechas civiles, no
// instantes). El countdown sí usa el offset real del evento.
import type { CollectionEntry } from 'astro:content';

export type EventData = CollectionEntry<'events'>['data'];

const LOCALE = 'es-BO';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function part(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: 'UTC' }).format(date);
}

/** "Domingo 12 / Jul / 2026" */
export function heroDate(date: Date): string {
  const wd = cap(part(date, { weekday: 'long' }));
  const day = part(date, { day: 'numeric' });
  const mon = cap(part(date, { month: 'short' }).replace('.', ''));
  return `${wd} ${day} / ${mon} / ${date.getUTCFullYear()}`;
}

/** "Dom 12 Jul" */
export function shortDate(date: Date): string {
  const wd = cap(part(date, { weekday: 'short' }).replace('.', ''));
  const day = part(date, { day: 'numeric' });
  const mon = cap(part(date, { month: 'short' }).replace('.', ''));
  return `${wd} ${day} ${mon}`;
}

/** "01 Jul" */
export function dayMonth(date: Date): string {
  const day = part(date, { day: '2-digit' });
  const mon = cap(part(date, { month: 'short' }).replace('.', ''));
  return `${day} ${mon}`;
}

/** ISO con offset del evento, p.ej. "2026-07-12T08:00:00-04:00" para el countdown. */
export function countdownISO(event: EventData): string {
  const ymd = event.date.toISOString().slice(0, 10);
  const time = event.startTime ?? '00:00';
  const tz = event.timezoneOffset ?? '-04:00';
  return `${ymd}T${time}:00${tz}`;
}

/** Ubicación corta: "La Paz, Bolivia" */
export function placeLine(event: EventData): string {
  return [event.city, event.country].filter(Boolean).join(', ');
}
