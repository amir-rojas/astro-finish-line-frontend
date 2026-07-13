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
  /** Punto de partida ("Plaza Avaroa"). Es el DÓNDE fino del detalle. Opcional:
      una carrera vieja que solo vive como recap puede no tenerlo. */
  location?: string;
  /** Punto de llegada. Si coincide con `location`, la sección del recorrido lo dice
      como "salida y llegada" en vez de repetir el mismo lugar dos veces. */
  finishLocation?: string;
  /** Ciudad. Es el DÓNDE grueso: lo que sirve para escanear una lista de carreras
      de un organizador que corre en todo el país. */
  city?: string;
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
  /** Hora de concentración ("07:00"). El corredor la necesita tanto como la largada:
      es a la que tiene que estar ahí. Estaba en el contenido y no llegaba a la vista. */
  gatheringTime?: string;
  /** Titular y párrafo del recorrido, más el mapa. */
  courseTitle?: string;
  courseDescription?: string;
  routeMap?: ImageMetadata;
  routeMapAlt?: string;
  /** Estado de la carrera (chip del hero). */
  status?: 'proximo' | 'inscripciones_abiertas' | 'cerrado' | 'finalizado';
  /** Co-organizador, p.ej. "Alcaldía de La Paz" (chip del hero). */
  coorganizer?: string;
  /** Serie Run Tour vs carrera suelta — alimenta el tag de la agenda de la home. */
  isRunTour: boolean;
  /** Etapa dentro del Run Tour (1, 2, 3…). Solo con `isRunTour`. El hero la muestra
      junto al nombre de la serie; sin ella, el lockup degrada al nombre a secas. */
  runTourStage?: number;
  heroImage?: ImageMetadata;
  heroImageAlt?: string;
  /** Variante apaisada del hero para pantallas anchas. Si falta, desktop reusa
      `heroImage`. Es art direction: no es la misma foto más grande, es otra toma. */
  heroImageDesktop?: ImageMetadata;
  /** Afiche oficial. Solo para el detalle, que muestra la imagen contenida y sin
      texto encima. Si falta, el detalle reusa `heroImage`. */
  poster?: ImageMetadata;
  posterAlt?: string;
  /** Álbum de fotos de la carrera (hoy, Facebook). Solo las carreras que de verdad
      tienen fotos lo traen: gobierna si su tarjeta de recap es clickeable. */
  photosUrl?: string;
  /** Foto de la vitrina "Así se vivió". Cae a `heroImage` si falta. */
  recapImage?: ImageMetadata;
  recapImageAlt?: string;
  /** `object-position` de la foto del recap. Default "50% 40%". */
  recapImageFocus?: string;
  /** Polera oficial del evento (foto de merch). Opcional: no todos los eventos la tienen. */
  shirt?: ImageMetadata;
  shirtAlt?: string;
  /** Condición para llevarse la polera. Sin ella la pieza no se muestra. */
  shirtTerms?: string;
  /** Medalla finisher del evento (foto). Opcional: no todos los eventos la tienen. */
  medal?: ImageMetadata;
  medalAlt?: string;
  /** Condición para llevarse la medalla. Sin ella la pieza no se muestra. */
  medalTerms?: string;
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
    finishLocation: data.finishLocation,
    city: data.city,
    // Si hay modalidades reales, las distancias se derivan de ahí (misma regla
    // que Strapi); si no, cae al legacy `distances[]` (compat con contenido viejo).
    distances: data.modalities.length > 0 ? data.modalities.map((m) => m.distance) : data.distances,
    tagline: data.tagline,
    altitudeM: data.altitudeM,
    altitudeNote: data.altitudeNote,
    startTime: data.startTime,
    gatheringTime: data.gatheringTime,
    courseTitle: data.courseTitle,
    courseDescription: data.courseDescription,
    routeMap: data.routeMap,
    routeMapAlt: data.routeMapAlt,
    status: STATUS_MAP[data.status],
    coorganizer: data.coorganizer,
    isRunTour: data.isRunTour,
    runTourStage: data.runTourStage,
    heroImage: data.heroImage,
    heroImageAlt: data.heroImageAlt ?? data.title,
    heroImageDesktop: data.heroImageDesktop,
    poster: data.poster,
    posterAlt: data.posterAlt,
    photosUrl: data.photosUrl,
    // La foto del recap cae a la del hero: casi siempre es la misma carrera vista
    // desde la misma cámara, y obligar a cargar dos veces la misma imagen sería
    // trabajo de autoría sin ganancia.
    recapImage: data.recapImage ?? data.heroImage,
    recapImageAlt: data.recapImageAlt ?? data.heroImageAlt ?? data.title,
    recapImageFocus: data.recapImageFocus ?? '50% 40%',
    shirt: data.shirt,
    shirtAlt: data.shirtAlt ?? `Polera oficial de ${data.title}`,
    shirtTerms: data.shirtTerms,
    medal: data.medal,
    medalAlt: data.medalAlt ?? `Medalla finisher de ${data.title}`,
    medalTerms: data.medalTerms,
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
 * La "próxima carrera" para el hero de la home: la primera que todavía no se
 * corrió (la lista viene ordenada por fecha asc). Si no queda ninguna, cae a la
 * más reciente (última) para no dejar el hero vacío. Null solo si no hay carreras.
 *
 * El "ya se corrió" lo decide `upcomingRaces`/`hasRaced` (`race-date.ts`), que es
 * la MISMA regla que usan la agenda de la home y /calendario. Antes esta función
 * tenía su propio filtro de `finalizado` y las otras dos no: por eso el hero
 * salteaba correctamente la carrera corrida mientras la agenda la anunciaba.
 */
export async function getNextRace(): Promise<RaceEvent | null> {
  const events = await getEvents();
  if (events.length === 0) return null;
  return upcomingRaces(events)[0] ?? events[events.length - 1];
}
