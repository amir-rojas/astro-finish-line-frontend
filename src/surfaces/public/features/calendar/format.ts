// Helpers de formato para el calendario público de carreras.
//
// PR 1 (capa de datos): render de markdown, formato de precio y mapeo de
// estado por modalidad.
// detalle-info-evento (Unit 1): `formatFileSize()` — tamaño de los adjuntos
// de los bloques de "Información del evento".
// PR 3 (listado): `dayMonth()` (bloque de fecha de cada fila) y `raceStatus()`
// (estado agregado por carrera — ver engram `sdd/strapi-content-connection/
// list-status-badge`).
// PR 4 (detalle): `heroDate()` (fecha larga del hero) y `calendarEventJsonLd()`
// (JSON-LD SportsEvent de la página de detalle).
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { CalendarEvent, CalendarModality } from '@shared/lib/content/events';

marked.setOptions({ async: false });

// Moneda hardcodeada en el front (sin selector de moneda en v1). Se muestra como
// "Bs", que es como se escribe el boliviano acá y como está cargado el contenido;
// "BOB" es el código ISO y solo tiene sentido para máquinas — vive en el JSON-LD
// (`priceCurrency`), donde schema.org lo exige.
const CURRENCY = 'Bs';

/**
 * Convierte el markdown de `descripcion` (Strapi) a HTML sanitizado, listo
 * para `set:html` en un componente Astro. Única frontera de sanitización:
 * nunca renderizar `descripcion` cruda con `set:html`.
 */
export function renderMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li',
      'h2', 'h3', 'h4', 'blockquote', 'code', 'pre',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}

/**
 * "200 BOB" — precio de una modalidad, moneda fija (BOB). Precio 0 = carrera
 * gratis (la alcaldía cubre el costo): se muestra "GRATIS" en vez de "0 BOB",
 * misma convención `amount === 0` que la landing (ver Price.astro).
 */
export function formatPrice(amount: number): string {
  return amount === 0 ? 'GRATIS' : `${amount} ${CURRENCY}`;
}

/**
 * Carrera gratis: tiene modalidades y todas cuestan 0. Deriva el "gratis" del
 * dato real (no un flag inventado), igual que la landing. Gobierna el copy del
 * CTA de inscripción del detalle.
 */
export function isFreeEvent(modalities: CalendarModality[]): boolean {
  return modalities.length > 0 && modalities.every((m) => m.price === 0);
}

export interface StatusMeta {
  label: string;
  /** Tono semántico; PR 3/4 lo mapean a clases de color (no es una clase en sí). */
  tone: 'open' | 'warning' | 'closed';
}

/** Estado de una modalidad -> label en español + tono para el badge. */
export const STATUS_META: Record<CalendarModality['status'], StatusMeta> = {
  abierto: { label: 'Inscripciones abiertas', tone: 'open' },
  ultimos_cupos: { label: 'Últimos cupos', tone: 'warning' },
  agotado: { label: 'Agotado', tone: 'closed' },
};

/** Atajo: estado de una modalidad -> su StatusMeta. */
export function modalityStatus(status: CalendarModality['status']): StatusMeta {
  return STATUS_META[status];
}

const MONTHS_ES = [
  'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
  'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
] as const;

/**
 * Bloque de fecha de una fila del listado ("12 / SEP"). Usa los getters UTC
 * porque `date` viene de `z.coerce.date()` sobre una fecha sin hora (Strapi) —
 * leerla en horario local podría correr el día un día para atrás/adelante
 * según el timezone del que hace build.
 */
export function dayMonth(date: Date): { day: string; month: string } {
  return {
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: MONTHS_ES[date.getUTCMonth()],
  };
}

export interface RaceStatus {
  label: string;
  tone: 'open' | 'warning' | 'closed';
}

/**
 * Estado agregado de una carrera a partir del estado real de sus modalidades
 * (Strapi no tiene un campo de estado a nivel carrera). Precedencia: si
 * alguna modalidad está abierta, la carrera se muestra "Abiertas" aunque el
 * resto esté agotado (se prioriza la mejor disponibilidad real). Decisión de
 * Amir — ver engram `sdd/strapi-content-connection/list-status-badge`.
 */
export function raceStatus(modalities: CalendarModality[]): RaceStatus | null {
  if (modalities.length === 0) return null;
  if (modalities.some((m) => m.status === 'abierto')) {
    return { label: 'Abiertas', tone: 'open' };
  }
  if (modalities.some((m) => m.status === 'ultimos_cupos')) {
    return { label: 'Últimos cupos', tone: 'warning' };
  }
  return { label: 'Agotado', tone: 'closed' };
}

/**
 * Fecha larga del hero del detalle ("12 / JUL / 2026"). Igual que `dayMonth()`
 * usa los getters UTC porque `date` viene de una fecha sin hora de Strapi:
 * leerla en horario local podría correr el día según el timezone del build.
 */
export function heroDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTHS_ES[date.getUTCMonth()];
  return `${day} / ${month} / ${date.getUTCFullYear()}`;
}

/**
 * Fecha de cierre de inscripción en formato legible ("31 de Agosto, 2026") para
 * el sidebar del detalle. UTC por el mismo motivo que `heroDate()`.
 */
const MONTHS_ES_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export function longDate(date: Date): string {
  return `${date.getUTCDate()} de ${MONTHS_ES_LONG[date.getUTCMonth()]}, ${date.getUTCFullYear()}`;
}

/**
 * Tamaño de un archivo adjunto ("240 KB" / "1.3 MB") para el texto accesible
 * del link de descarga de cada bloque de información. Strapi entrega `size`
 * en KB (float); por debajo de 1024 KB se muestra redondeado en KB, si no en
 * MB con un decimal.
 */
export function formatFileSize(kb: number): string {
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * JSON-LD `SportsEvent` para la página de detalle. Builder propio del calendario
 * (no reusa el de la home, acoplado a `EventData`). Solo incluye campos con dato
 * real: sin `heroImage`/`description`/`registrationUrl`, esas claves se omiten.
 * `offers` deriva de las modalidades (una oferta por modalidad con su precio).
 * `pageUrl` debe ser la URL canónica absoluta de la página (la resuelve el caller
 * con `Astro.url`/`Astro.site`).
 */
export function calendarEventJsonLd(event: CalendarEvent, pageUrl: string): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    startDate: event.date.toISOString().slice(0, 10),
    eventStatus: 'https://schema.org/EventScheduled',
    url: pageUrl,
    location: {
      '@type': 'Place',
      name: event.location,
      address: event.location,
    },
    sport: 'Running',
  };

  if (event.heroImage) jsonLd.image = event.heroImage.src;
  if (event.descriptionRaw) jsonLd.description = event.descriptionRaw;

  if (event.modalities.length > 0) {
    jsonLd.offers = event.modalities.map((m) => ({
      '@type': 'Offer',
      name: m.label,
      price: m.price,
      priceCurrency: 'BOB',
      availability:
        m.status === 'agotado'
          ? 'https://schema.org/SoldOut'
          : 'https://schema.org/InStock',
      ...(event.registrationUrl ? { url: event.registrationUrl } : {}),
    }));
  }

  return jsonLd;
}
