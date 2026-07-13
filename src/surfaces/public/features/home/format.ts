// Helpers de formato para la home pública. Locale es-BO, fechas en UTC para
// evitar corrimientos de día (las fechas del evento son fechas civiles, no
// instantes). El countdown sí usa el offset real del evento.
import type { CollectionEntry } from 'astro:content';
import type { RaceEvent } from '@shared/lib/content/events';
import { upcomingRaces } from '@shared/lib/race-date';
// Las primitivas (locale es-BO, UTC) y la fecha larga (`weekdayDate`) viven en
// `shared`: las comparten la home y el detalle del calendario. Antes la fecha
// larga era `heroDate()` y vivía acá, y el detalle se colgaba de este feature
// para usarla.
import { capitalize as cap, datePart as part, startDateTimeISO } from '@shared/lib/date-format';

export type EventData = CollectionEntry<'events'>['data'];

/** "Dom 12 Jul" */
export function shortDate(date: Date): string {
  const wd = cap(part(date, { weekday: 'short' }).replace('.', ''));
  const day = part(date, { day: 'numeric' });
  const mon = cap(part(date, { month: 'short' }).replace('.', ''));
  return `${wd} ${day} ${mon}`;
}

/** "Julio 2026 · La Paz" — el sello de una carrera ya corrida. Sin día: a la
 *  distancia de un recap, el mes y el lugar es lo que ubica al lector; el día
 *  exacto es precisión que ya no le sirve a nadie. La ciudad se omite si falta. */
export function recapDate(date: Date, city?: string): string {
  const mon = cap(part(date, { month: 'long' }));
  return [`${mon} ${date.getUTCFullYear()}`, city].filter(Boolean).join(' · ');
}

/** "01 Jul" */
export function dayMonth(date: Date): string {
  const day = part(date, { day: '2-digit' });
  const mon = cap(part(date, { month: 'short' }).replace('.', ''));
  return `${day} ${mon}`;
}

/** { month:"Agosto", year:"2026" } — capitalizado es-BO, UTC (fecha civil).
 *  El año va separado para que el componente lo estilice muted. */
export function monthYearParts(date: Date): { month: string; year: string } {
  return { month: cap(part(date, { month: 'long' })), year: String(date.getUTCFullYear()) };
}

/** Grupo de carreras futuras de un mes, para la agenda de la home. */
export interface AgendaMonth {
  /** "2026-08" — clave estable para el loop keyed de Astro. */
  key: string;
  month: string;
  year: string;
  races: RaceEvent[];
}

/** Agrupa las carreras que TODAVÍA NO SE CORRIERON, por mes, en orden cronológico.
 *  - Quién ya se corrió lo decide `upcomingRaces`/`hasRaced` (`race-date.ts`), la
 *    regla ÚNICA que comparten la home, /calendario y el hero. Antes esta función
 *    filtraba solo por fecha, con un `<` que dejaba pasar la carrera de HOY y que
 *    era ciego al `status: finalizado`: la agenda anunciaba como "próxima" una
 *    carrera ya corrida mientras el hero, que sí miraba el estado, la salteaba.
 *  - Asume `events` ya ordenado `fecha:asc` (lo garantiza `getEvents`); preserva
 *    ese orden dentro de cada mes y entre meses. */
export function upcomingByMonth(events: RaceEvent[], now: Date = new Date()): AgendaMonth[] {
  const months = new Map<string, AgendaMonth>();
  for (const race of upcomingRaces(events, now)) {
    const y = race.date.getUTCFullYear();
    const m = race.date.getUTCMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    let bucket = months.get(key);
    if (!bucket) {
      const { month, year } = monthYearParts(race.date);
      bucket = { key, month, year, races: [] };
      months.set(key, bucket);
    }
    bucket.races.push(race);
  }

  return [...months.values()];
}

/** ISO con offset para el countdown. A diferencia del `startDateTimeISO` que usa el
 *  JSON-LD, el countdown SIEMPRE necesita un instante: sin hora de largada cae a
 *  medianoche, porque una cuenta regresiva a una fecha pelada no se puede calcular. */
export function countdownISOFrom(date: Date, startTime?: string, tz = '-04:00'): string {
  return startDateTimeISO(date, startTime ?? '00:00', tz);
}

/** ISO del countdown a partir de un evento de la colección local. */
export function countdownISO(event: EventData): string {
  return countdownISOFrom(event.date, event.startTime, event.timezoneOffset);
}

/** Ubicación corta: "La Paz, Bolivia" */
export function placeLine(event: EventData): string {
  return [event.city, event.country].filter(Boolean).join(', ');
}

