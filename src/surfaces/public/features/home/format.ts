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
import { capitalize as cap, datePart as part } from '@shared/lib/date-format';

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

/** ISO con offset, p.ej. "2026-07-12T08:00:00-04:00" para el countdown.
 *  Decoplado de EventData para que también lo use el hero data-driven (RaceEvent). */
export function countdownISOFrom(date: Date, startTime?: string, tz = '-04:00'): string {
  const ymd = date.toISOString().slice(0, 10);
  const time = startTime ?? '00:00';
  return `${ymd}T${time}:00${tz}`;
}

/** ISO del countdown a partir de un evento de la colección local. */
export function countdownISO(event: EventData): string {
  return countdownISOFrom(event.date, event.startTime, event.timezoneOffset);
}

/** Ubicación corta: "La Paz, Bolivia" */
export function placeLine(event: EventData): string {
  return [event.city, event.country].filter(Boolean).join(', ');
}

/** Título SEO con año, p.ej. "La Paz 10K 2026". El brand lo añade el layout. */
export function seoTitle(event: EventData): string {
  return `${event.title} ${event.date.getUTCFullYear()}`;
}

// --- SEO: datos estructurados ---------------------------------------------

// Moneda mostrada (p.ej. "Bs") -> código ISO 4217 para schema.org/Offer.
const CURRENCY_ISO: Record<string, string> = { Bs: 'BOB' };

// Estado del evento -> disponibilidad de la oferta (schema.org/ItemAvailability).
const AVAILABILITY: Record<EventData['status'], string> = {
  upcoming: 'https://schema.org/PreOrder',
  open: 'https://schema.org/InStock',
  closed: 'https://schema.org/SoldOut',
  finished: 'https://schema.org/SoldOut',
};

/**
 * JSON-LD `SportsEvent` para rich results de Google (listados de eventos).
 * `image` y `url` deben ser absolutas; el llamador las construye con Astro.site.
 */
export function eventJsonLd(
  event: EventData,
  { url, image, organizerUrl }: { url: string; image?: string; organizerUrl: string },
): Record<string, unknown> {
  // `offers` refleja las vías de inscripción reales: si hay varias
  // (registrationOptions: gratis + pago) se emite un array de ofertas; si no,
  // cae al modelo legacy de precio único. schema.org acepta ambas formas.
  const validThrough = event.registrationDeadline?.toISOString();
  const offers =
    event.registrationOptions.length > 0
      ? event.registrationOptions.map((o) => ({
          '@type': 'Offer',
          url: o.url,
          availability: AVAILABILITY[event.status],
          price: o.price.amount,
          priceCurrency: CURRENCY_ISO[o.price.currency] ?? o.price.currency,
          ...(validThrough && { validThrough }),
        }))
      : event.registrationUrl
        ? {
            '@type': 'Offer',
            url: event.registrationUrl,
            availability: AVAILABILITY[event.status],
            ...(event.price && {
              price: event.price.amount,
              priceCurrency: CURRENCY_ISO[event.price.currency] ?? event.price.currency,
            }),
            ...(validThrough && { validThrough }),
          }
        : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    sport: 'Running',
    startDate: countdownISO(event),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url,
    ...(event.description && { description: event.description }),
    ...(image && { image: [image] }),
    // `location` es opcional: se cae a la ciudad. Sin ninguno de los dos, el Place
    // se omite entero — declararle a Google un lugar con `name: undefined` es peor
    // que no declarar lugar.
    ...((event.location ?? event.city) && {
      location: {
        '@type': 'Place',
        name: event.location ?? event.city,
        address: {
          '@type': 'PostalAddress',
          ...(event.location && { streetAddress: event.location }),
          ...(event.city && { addressLocality: event.city }),
          ...(event.country && { addressCountry: event.country }),
        },
      },
    }),
    ...(offers && { offers }),
    ...(event.organizer && {
      organizer: { '@type': 'Organization', name: event.organizer, url: organizerUrl },
    }),
  };
}
