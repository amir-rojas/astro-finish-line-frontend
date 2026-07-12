/**
 * content/events.ts — capa de datos de carreras (local, Content Collection).
 *
 * Sucesora de `server/strapi-client.ts` (parked, ver ese archivo): la MISMA
 * costura `RaceEvent`/`getEvents()`/`getEvent()`/`getNextRace()`, pero servida
 * desde `src/content/events/*.json` vía `getCollection('events')` en vez de un
 * fetch a Strapi. Patrón Ports & Adapters: la colección es el nuevo puerto de
 * autoría; `toRaceEvent` es la capa anti-corrupción que traduce el schema
 * local (campos en inglés/mixto) al vocabulario en español de `RaceEvent`.
 *
 * Firmas idénticas a `strapi-client.ts` a propósito: ningún consumidor cambia
 * su lógica, solo el import path (ver design ADR-1).
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { upcomingRaces } from '@shared/lib/race-date';

// --- Tipos limpios expuestos al resto de la app -----------------------------

export interface RaceModality {
  distance: string;
  label: string;
  price: number;
  status: 'abierto' | 'ultimos_cupos' | 'agotado';
}

export interface RaceAgeCategory {
  name: string;
  range: string;
}

/** Un archivo adjunto a un bloque de información (típicamente un PDF). */
export interface InfoBlockFile {
  url: string;
  name: string;
  /** Tamaño en KB — formatear con `formatFileSize()`. */
  sizeKb: number;
  mime: string;
  ext?: string;
}

/** Un bloque de "Información del evento" (reglamento, convocatoria, etc.). */
export interface InfoBlock {
  title: string;
  /** Markdown crudo tal cual viene del JSON. Renderizar en la superficie que lo use. */
  contentRaw: string;
  /** Orden editorial declarado en el JSON. Si falta, el bloque se ubica al final. */
  order?: number;
  files: InfoBlockFile[];
}

export interface RaceEvent {
  slug: string;
  title: string;
  date: Date;
  location: string;
  /** Distancias derivadas de `modalities[].distance` (si hay modalidades) o del legacy `distances[]`. */
  distances: string[];
  /** Titular display multilínea del hero. Si falta, el hero cae al `title`. */
  tagline?: string;
  /** Altitud en metros s.n.m. (hilo conductor visual del hero). */
  altitudeM?: number;
  /** Nota de altitud, p.ej. "La ciudad más alta del mundo". */
  altitudeNote?: string;
  /** Hora de largada normalizada a "HH:mm". Alimenta el countdown junto con `date`. */
  startTime?: string;
  /** Estado de la carrera (chip del hero). */
  status?: 'proximo' | 'inscripciones_abiertas' | 'cerrado' | 'finalizado';
  /** Co-organizador, p.ej. "Alcaldía de La Paz" (chip del hero). */
  coorganizer?: string;
  /** Serie Run Tour vs carrera suelta — alimenta el tag de la agenda de la home. */
  isRunTour: boolean;
  heroImage?: ImageMetadata;
  heroImageAlt?: string;
  /** Polera oficial del evento (foto de merch). Opcional: no todos los eventos la tienen. */
  shirt?: ImageMetadata;
  shirtAlt?: string;
  /** Medalla finisher del evento (foto). Opcional: no todos los eventos la tienen. */
  medal?: ImageMetadata;
  medalAlt?: string;
  /** Markdown crudo tal cual viene del JSON. Renderizar en la superficie que lo use. */
  descriptionRaw?: string;
  registrationUrl?: string;
  registrationDeadline?: Date;
  modalities: RaceModality[];
  categories: RaceAgeCategory[];
  /** Bloques de "Información del evento" (reglamento, convocatoria…), ya ordenados. */
  infoBlocks: InfoBlock[];
}

// --- Alias de la superficie de calendario/detalle ---------------------------
// El calendario y el detalle son otra VISTA de la misma carrera: consumen la
// MISMA capa de datos. `RaceEvent` es el tipo canónico; estos alias dejan que
// el feature `calendar/` lea el mismo dato con su vocabulario.
export type CalendarEvent = RaceEvent;
export type CalendarModality = RaceModality;
export type CalendarAgeCategory = RaceAgeCategory;

// --- Adaptador: entrada de colección -> RaceEvent ---------------------------

type EventEntry = CollectionEntry<'events'>;

const STATUS_MAP: Record<'upcoming' | 'open' | 'closed' | 'finished', NonNullable<RaceEvent['status']>> = {
  upcoming: 'proximo',
  open: 'inscripciones_abiertas',
  closed: 'cerrado',
  finished: 'finalizado',
};

/**
 * Mapea `infoBlocks` y los ordena por `order` ascendente. Los bloques sin
 * `order` (undefined) van AL FINAL, en el orden en que llegaron entre ellos —
 * de ahí el índice como tiebreak (sort estable manual, mismo criterio que
 * `strapi-client.ts`).
 */
function mapInfoBlocks(raw: EventEntry['data']['infoBlocks']): InfoBlock[] {
  return raw
    .map((block, index) => ({ block, index }))
    .sort((a, b) => {
      const orderA = a.block.order ?? Number.POSITIVE_INFINITY;
      const orderB = b.block.order ?? Number.POSITIVE_INFINITY;
      return orderA === orderB ? a.index - b.index : orderA - orderB;
    })
    .map(({ block }) => ({
      title: block.title,
      contentRaw: block.content,
      order: block.order,
      files: block.files.map((f) => ({
        url: f.url,
        name: f.name,
        sizeKb: f.sizeKb,
        mime: f.mime,
        ext: f.ext,
      })),
    }));
}

/** Adapta una entrada cruda de la colección `events` al contrato `RaceEvent`. */
export function toRaceEvent(entry: EventEntry): RaceEvent {
  const data = entry.data;
  return {
    slug: entry.id,
    title: data.title,
    date: data.date,
    location: data.location,
    // Si hay modalidades reales, las distancias se derivan de ahí (misma regla
    // que Strapi); si no, cae al legacy `distances[]` (compat con contenido viejo).
    distances: data.modalities.length > 0 ? data.modalities.map((m) => m.distance) : data.distances,
    tagline: data.tagline,
    altitudeM: data.altitudeM,
    altitudeNote: data.altitudeNote,
    startTime: data.startTime,
    status: STATUS_MAP[data.status],
    coorganizer: data.coorganizer,
    isRunTour: data.isRunTour,
    heroImage: data.heroImage,
    heroImageAlt: data.heroImageAlt ?? data.title,
    shirt: data.shirt,
    shirtAlt: data.shirtAlt ?? `Polera oficial de ${data.title}`,
    medal: data.medal,
    medalAlt: data.medalAlt ?? `Medalla finisher de ${data.title}`,
    descriptionRaw: data.description,
    // El CTA del detalle usa una sola URL. Si el JSON no trae `registrationUrl`
    // top-level, se deriva de la vía destacada de `registrationOptions` (o la
    // primera): así el botón de inscripción funciona con el modelo multi-vía.
    registrationUrl:
      data.registrationUrl ??
      data.registrationOptions.find((o) => o.featured)?.url ??
      data.registrationOptions[0]?.url,
    registrationDeadline: data.registrationDeadline,
    modalities: data.modalities.map((m) => ({
      distance: m.distance,
      // Fallback a la distancia si no hay label descriptivo.
      label: m.label ?? m.distance,
      price: m.price,
      status: m.status,
    })),
    categories: data.categories.map((c) => ({ name: c.name, range: c.ages })),
    infoBlocks: mapInfoBlocks(data.infoBlocks),
  };
}

// --- Lectura -----------------------------------------------------------------

/**
 * Lista de carreras, ordenadas por fecha ascendente. `getCollection` NO
 * garantiza orden: el sort explícito restaura el invariante `fecha:asc` que
 * `upcomingByMonth`/`SiteFooter`/`getNextRace` asumen (antes lo daba
 * `sort=fecha:asc` en el fetch a Strapi).
 */
export async function getEvents(): Promise<RaceEvent[]> {
  const entries = await getCollection('events');
  const events = entries.map(toRaceEvent);
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

/**
 * Carrera puntual por slug. El caller es responsable de devolver 404 cuando
 * el resultado es null.
 */
export async function getEvent(slug: string): Promise<RaceEvent | null> {
  const events = await getEvents();
  return events.find((event) => event.slug === slug) ?? null;
}

/**
 * La "próxima carrera" para el hero de la home: la primera que todavía no
 * pasó (la lista viene ordenada por fecha asc). Si no hay ninguna futura, cae
 * a la más reciente (última). Devuelve null solo si no hay carreras.
 *
 * Usa `upcomingRaces` —la misma regla que la agenda y /calendario— a
 * granularidad de día en La Paz (ver `race-date.ts`).
 */
export async function getNextRace(): Promise<RaceEvent | null> {
  const events = await getEvents();
  if (events.length === 0) return null;
  // Una carrera ya corrida (`finalizado`) NO es "la próxima", aunque su día en
  // Bolivia todavía no haya terminado (el hero anunciaría una carrera pasada).
  // Se excluye del pool; si no queda ninguna viva, se cae al set completo para
  // no dejar el hero vacío. `/calendario` sigue usando `upcomingRaces` directo,
  // así que este filtro no afecta al listado del calendario.
  const live = events.filter((event) => event.status !== 'finalizado');
  const pool = live.length > 0 ? live : events;
  return upcomingRaces(pool)[0] ?? pool[pool.length - 1];
}
