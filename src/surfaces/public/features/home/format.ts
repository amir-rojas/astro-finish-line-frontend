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
  const offers = event.registrationUrl
    ? {
        '@type': 'Offer',
        url: event.registrationUrl,
        availability: AVAILABILITY[event.status],
        ...(event.price && {
          price: event.price.amount,
          priceCurrency: CURRENCY_ISO[event.price.currency] ?? event.price.currency,
        }),
        ...(event.registrationDeadline && {
          validThrough: event.registrationDeadline.toISOString(),
        }),
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
    location: {
      '@type': 'Place',
      name: event.location,
      address: {
        '@type': 'PostalAddress',
        ...(event.location && { streetAddress: event.location }),
        ...(event.city && { addressLocality: event.city }),
        ...(event.country && { addressCountry: event.country }),
      },
    },
    ...(offers && { offers }),
    ...(event.organizer && {
      organizer: { '@type': 'Organization', name: event.organizer, url: organizerUrl },
    }),
  };
}
