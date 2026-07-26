/**
 * content/events.ts — capa de datos de carreras (Sanity, fuente única de verdad).
 *
 * Sucesora de la Content Collection local (`src/content/events/*.json` +
 * `content.config.ts`, retirados en este mismo cambio) y, antes de eso, de
 * `server/strapi-client.ts` (parked, ver ese archivo): la MISMA costura
 * `RaceEvent`/`getEvents()`/`getEvent()`/`getNextRace()`, ahora servida con un
 * fetch GROQ a Sanity Studio en vez de leer JSON del repo. Patrón Ports &
 * Adapters: Sanity es el nuevo puerto de autoría; `mapRace` es la capa
 * anti-corrupción que traduce el schema del Studio (campos en inglés, alt
 * anidado en cada imagen, `terms` adentro de `shirt`/`medal`) al vocabulario en
 * español de `RaceEvent`.
 *
 * Firmas idénticas a las versiones anteriores a propósito: ningún consumidor
 * cambia su lógica ni su import path (18 consumidores, ver design ADR-1).
 */
import { createClient } from '@sanity/client';
import { z } from 'zod';
import { upcomingRaces } from '@shared/lib/race-date';

// --- Cliente Sanity ----------------------------------------------------------
// Dataset público (plan free), sin token de lectura: `projectId`/`dataset` son
// constantes públicas en código, no secretos — no hace falta env var.

const SANITY_PROJECT_ID = '34shscw3';
const SANITY_DATASET = 'production';
// Pineada a una fecha fija: fija la forma de la API contra futuros cambios de
// default en Sanity, para que este adaptador no se rompa por una actualización
// silenciosa del lado del proveedor.
const SANITY_API_VERSION = '2024-01-01';

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  // NO NEGOCIABLE: el CDN de Sanity tiene ~10 min de retraso tras un publish en
  // Studio. Un build disparado por el webhook de Sanity justo después de
  // publicar tiene que leer el estado YA publicado, no una copia vieja cacheada
  // — reintroducir ese retraso es exactamente el problema de staleness que este
  // cambio vino a resolver (ver `useCdn: false` en design ADR).
  useCdn: false,
});

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
  /** Markdown crudo tal cual viene de Sanity. Renderizar en la superficie que lo use. */
  contentRaw: string;
  /** Orden editorial declarado en Sanity. Si falta, el bloque se ubica al final. */
  order?: number;
  files: InfoBlockFile[];
}

/** Un auspiciador de ESTA carrera (nombre + logo). */
export interface RaceSponsor {
  name: string;
  logo: ImageMetadata;
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
  /** País. Hoy todas las carreras son de Bolivia, pero el schema ya lo declara
      (organizador multi-país a futuro). */
  country?: string;
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
  /** Huso de la carrera ("-04:00"). Sin él, `startTime` es una hora sin lugar: el
      countdown y el `startDate` del JSON-LD no pueden fijar el instante real. */
  timezoneOffset: string;
  /** Hora de concentración ("07:00"). El corredor la necesita tanto como la largada:
      es a la que tiene que estar ahí. Estaba en el contenido y no llegaba a la vista. */
  gatheringTime?: string;
  /** Titular y párrafo del recorrido, más el mapa. */
  courseTitle?: string;
  courseDescription?: string;
  routeMap?: ImageMetadata;
  routeMapAlt: string;
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
  heroImageAlt: string;
  /** Variante apaisada del hero para pantallas anchas. Si falta, desktop reusa
      `heroImage`. Es art direction: no es la misma foto más grande, es otra toma. */
  heroImageDesktop?: ImageMetadata;
  /** Afiche oficial. Solo para el detalle, que muestra la imagen contenida y sin
      texto encima. Si falta, el detalle reusa `heroImage`. */
  poster?: ImageMetadata;
  posterAlt: string;
  /** Álbum de fotos de la carrera (hoy, Facebook). Solo las carreras que de verdad
      tienen fotos lo traen: gobierna si su tarjeta de recap es clickeable. */
  photosUrl?: string;
  /** Foto de la vitrina "Así se vivió". Cae a `heroImage` si falta. */
  recapImage?: ImageMetadata;
  recapImageAlt: string;
  /** `object-position` de la foto del recap. Default "50% 40%". */
  recapImageFocus?: string;
  /** Polera oficial del evento (foto de merch). Opcional: no todos los eventos la tienen. */
  shirt?: ImageMetadata;
  shirtAlt: string;
  /** Condición para llevarse la polera. Sin ella la pieza no se muestra. */
  shirtTerms?: string;
  /** Medalla finisher del evento (foto). Opcional: no todos los eventos la tienen. */
  medal?: ImageMetadata;
  medalAlt: string;
  /** Condición para llevarse la medalla. Sin ella la pieza no se muestra. */
  medalTerms?: string;
  /** Markdown crudo tal cual viene de Sanity. Renderizar en la superficie que lo use. */
  descriptionRaw?: string;
  registrationUrl?: string;
  registrationDeadline?: Date;
  modalities: RaceModality[];
  categories: RaceAgeCategory[];
  /** Bloques de "Información del evento" (reglamento, convocatoria…), ya ordenados. */
  infoBlocks: InfoBlock[];
  /** Auspiciadores de ESTA carrera. Si viene vacío, la tira no se muestra. */
  sponsors: RaceSponsor[];
}

// --- Alias de la superficie de calendario/detalle ---------------------------
// El calendario y el detalle son otra VISTA de la misma carrera: consumen la
// MISMA capa de datos. `RaceEvent` es el tipo canónico; estos alias dejan que
// el feature `calendar/` lea el mismo dato con su vocabulario.
export type CalendarEvent = RaceEvent;
export type CalendarModality = RaceModality;
export type CalendarAgeCategory = RaceAgeCategory;

// --- Schemas Sanity (forma cruda del payload GROQ) --------------------------
// Cualquier campo ausente en un documento Sanity vuelve `null` explícito bajo
// una proyección GROQ (`{campo, ...}`) — nunca `undefined`/omitido como en un
// `getCollection` local. De ahí el `.nullable()` en TODOS los campos opcionales
// (mismo motivo, forma distinta, que el `.nullable()` de `strapi-client.ts`).

/** Convierte un array GROQ potencialmente `null` (campo ausente) a `[]`. */
function nullableArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(item)
    .nullable()
    .optional()
    .transform((v) => v ?? []);
}

const imageAssetSchema = z.object({
  url: z.string(),
  extension: z.string(),
  metadata: z.object({
    dimensions: z.object({ width: z.number(), height: z.number() }),
  }),
});

// `raceImage` (heroImage, heroImageDesktop, poster, recapImage, routeMap): sin
// `alt` editable en el Studio — el texto alternativo lo fija `mapRace` con una
// descripción fija por campo, no un dato que venga del payload.
const raceImageSchema = z
  .object({
    asset: imageAssetSchema.nullable().optional(),
  })
  .nullable()
  .optional();

// `rewardImage` (shirt, medal): trae `terms` DENTRO del objeto — corrección
// confirmada contra el schema real del Studio. Nunca leer un
// `shirtTerms`/`medalTerms` top-level: ese campo no existe. Sin `alt` editable,
// mismo criterio que `raceImageSchema`.
const rewardImageSchema = z
  .object({
    terms: z.string().nullable().optional(),
    asset: imageAssetSchema.nullable().optional(),
  })
  .nullable()
  .optional();

const modalitySchema = z.object({
  distance: z.string(),
  label: z.string().nullable().optional(),
  price: z.number(),
  status: z.enum(['abierto', 'ultimos_cupos', 'agotado']),
});

const ageCategorySchema = z.object({ name: z.string(), ages: z.string() });

const registrationOptionSchema = z.object({
  label: z.string(),
  price: z.object({ amount: z.number(), currency: z.string().default('Bs') }),
  url: z.string().url(),
  featured: z.boolean().nullable().optional(),
});

// `infoFile`: el nombre visible es el campo editorial `name` directo — NUNCA
// `asset->originalFilename` (corrección confirmada: el Studio lo modela como un
// campo propio, no derivado del archivo subido).
const infoFileSchema = z.object({
  url: z.string(),
  name: z.string(),
  sizeKb: z.number(),
  mime: z.string(),
  ext: z.string().nullable().optional(),
});

const infoBlockSchema = z.object({
  title: z.string(),
  content: z.string(),
  order: z.number().nullable().optional(),
  files: nullableArray(infoFileSchema),
});

// El logo va como `image` plano (no `raceImage`): un auspiciador no necesita
// un alt propio, la tira usa `name` para eso.
const sponsorSchema = z.object({
  name: z.string(),
  logo: z.object({ asset: imageAssetSchema.nullable().optional() }).nullable().optional(),
});

const raceSchema = z.object({
  slug: z.string(),
  title: z.string(),
  date: z.coerce.date(),
  location: z.string().nullable().optional(),
  finishLocation: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  distances: nullableArray(z.string()),
  tagline: z.string().nullable().optional(),
  altitudeM: z.number().nullable().optional(),
  altitudeNote: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  timezoneOffset: z.string().nullable().optional(),
  gatheringTime: z.string().nullable().optional(),
  courseTitle: z.string().nullable().optional(),
  courseDescription: z.string().nullable().optional(),
  routeMap: raceImageSchema,
  status: z.enum(['upcoming', 'open', 'closed', 'finished']),
  coorganizer: z.string().nullable().optional(),
  isRunTour: z.boolean().nullable().optional(),
  runTourStage: z.number().nullable().optional(),
  heroImage: raceImageSchema,
  heroImageDesktop: raceImageSchema,
  poster: raceImageSchema,
  photosUrl: z.string().url().nullable().optional(),
  recapImage: raceImageSchema,
  recapImageFocus: z.string().nullable().optional(),
  shirt: rewardImageSchema,
  medal: rewardImageSchema,
  description: z.string().nullable().optional(),
  registrationUrl: z.string().url().nullable().optional(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  modalities: nullableArray(modalitySchema),
  categories: nullableArray(ageCategorySchema),
  registrationOptions: nullableArray(registrationOptionSchema),
  infoBlocks: nullableArray(infoBlockSchema),
  sponsors: nullableArray(sponsorSchema),
});

const raceListResponseSchema = z.array(raceSchema);

type RawRace = z.infer<typeof raceSchema>;
type RawRaceImage = z.infer<typeof raceImageSchema>;

// --- GROQ ---------------------------------------------------------------
// Una sola query, todas las carreras. `"slug":slug.current` usa el campo
// explícito del Studio como identidad (nunca el `_id` interno del documento).

const RACE_IMAGE_PROJECTION = `{
    asset->{ url, extension, metadata{ dimensions{ width, height } } }
  }`;

const REWARD_IMAGE_PROJECTION = `{
    "terms": terms,
    asset->{ url, extension, metadata{ dimensions{ width, height } } }
  }`;

const RACES_QUERY = `*[_type == "race"]{
  "slug": slug.current,
  title,
  date,
  location,
  finishLocation,
  city,
  country,
  distances,
  tagline,
  altitudeM,
  altitudeNote,
  startTime,
  timezoneOffset,
  gatheringTime,
  courseTitle,
  courseDescription,
  routeMap ${RACE_IMAGE_PROJECTION},
  status,
  coorganizer,
  isRunTour,
  runTourStage,
  heroImage ${RACE_IMAGE_PROJECTION},
  heroImageDesktop ${RACE_IMAGE_PROJECTION},
  poster ${RACE_IMAGE_PROJECTION},
  photosUrl,
  recapImage ${RACE_IMAGE_PROJECTION},
  recapImageFocus,
  shirt ${REWARD_IMAGE_PROJECTION},
  medal ${REWARD_IMAGE_PROJECTION},
  description,
  registrationUrl,
  registrationDeadline,
  modalities[]{ distance, label, price, status },
  categories[]{ name, ages },
  registrationOptions[]{ label, price, url, featured },
  infoBlocks[]{
    title,
    content,
    order,
    files[]{
      "url": asset->url,
      "name": name,
      "sizeKb": round(asset->size / 1024),
      "mime": asset->mimeType,
      "ext": asset->extension
    }
  },
  sponsors[]{
    name,
    logo{ asset->{ url, extension, metadata{ dimensions{ width, height } } } }
  }
}`;

// --- Adaptador: payload Sanity -> RaceEvent ----------------------------------

const STATUS_MAP: Record<'upcoming' | 'open' | 'closed' | 'finished', NonNullable<RaceEvent['status']>> = {
  upcoming: 'proximo',
  open: 'inscripciones_abiertas',
  closed: 'cerrado',
  finished: 'finalizado',
};

/**
 * Fabrica un `ImageMetadata` a partir del asset de Sanity, para que los 12
 * sitios `<Image>`/`getImage()` de la app sigan pasando el campo entero sin
 * cambios (ADR "Imágenes", design). `undefined` cuando no hay asset (imagen
 * opcional sin cargar).
 */
function sanityImage(raw: RawRaceImage): ImageMetadata | undefined {
  if (!raw?.asset) return undefined;
  return {
    src: raw.asset.url,
    width: raw.asset.metadata.dimensions.width,
    height: raw.asset.metadata.dimensions.height,
    format: raw.asset.extension as ImageMetadata['format'],
  };
}

/**
 * Mapea `infoBlocks` y los ordena por `order` ascendente. Los bloques sin
 * `order` (undefined) van AL FINAL, en el orden en que llegaron entre ellos —
 * de ahí el índice como tiebreak (sort estable manual, mismo criterio que
 * `strapi-client.ts`).
 */
function mapInfoBlocks(raw: RawRace['infoBlocks']): InfoBlock[] {
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
      order: block.order ?? undefined,
      files: block.files.map((f) => ({
        url: f.url,
        name: f.name,
        sizeKb: f.sizeKb,
        mime: f.mime,
        ext: f.ext ?? undefined,
      })),
    }));
}

/** Adapta un documento crudo de Sanity (tipo `race`) al contrato `RaceEvent`. */
function mapRace(raw: RawRace): RaceEvent {
  return {
    slug: raw.slug,
    title: raw.title,
    date: raw.date,
    location: raw.location ?? undefined,
    finishLocation: raw.finishLocation ?? undefined,
    city: raw.city ?? undefined,
    country: raw.country ?? undefined,
    // Si hay modalidades reales, las distancias se derivan de ahí (misma regla
    // que antes de Sanity); si no, cae al legacy `distances[]`.
    distances: raw.modalities.length > 0 ? raw.modalities.map((m) => m.distance) : raw.distances,
    tagline: raw.tagline ?? undefined,
    altitudeM: raw.altitudeM ?? undefined,
    altitudeNote: raw.altitudeNote ?? undefined,
    startTime: raw.startTime ?? undefined,
    timezoneOffset: raw.timezoneOffset ?? '-04:00',
    gatheringTime: raw.gatheringTime ?? undefined,
    courseTitle: raw.courseTitle ?? undefined,
    courseDescription: raw.courseDescription ?? undefined,
    routeMap: sanityImage(raw.routeMap),
    // Ya sabemos que acá siempre va un mapa de recorrido: alt fijo, no editable en Studio.
    routeMapAlt: `Mapa del recorrido de la carrera ${raw.title}`,
    status: STATUS_MAP[raw.status],
    coorganizer: raw.coorganizer ?? undefined,
    isRunTour: raw.isRunTour ?? false,
    runTourStage: raw.runTourStage ?? undefined,
    heroImage: sanityImage(raw.heroImage),
    // Foto de acción de la carrera, siempre: alt fijo, no editable en Studio.
    heroImageAlt: `Foto de acción de la carrera ${raw.title}`,
    heroImageDesktop: sanityImage(raw.heroImageDesktop),
    poster: sanityImage(raw.poster),
    posterAlt: `Afiche oficial de la carrera ${raw.title}`,
    photosUrl: raw.photosUrl ?? undefined,
    // La foto del recap cae a la del hero: casi siempre es la misma carrera vista
    // desde la misma cámara, y obligar a cargar dos veces la misma imagen sería
    // trabajo de autoría sin ganancia.
    recapImage: sanityImage(raw.recapImage) ?? sanityImage(raw.heroImage),
    recapImageAlt: `Foto de cómo se vivió la carrera ${raw.title}`,
    recapImageFocus: raw.recapImageFocus ?? '50% 40%',
    shirt: sanityImage(raw.shirt),
    shirtAlt: `Polera oficial de ${raw.title}`,
    // `terms` vive DENTRO del objeto `shirt`, no en un campo `shirtTerms` aparte.
    shirtTerms: raw.shirt?.terms ?? undefined,
    medal: sanityImage(raw.medal),
    medalAlt: `Medalla finisher de ${raw.title}`,
    // Mismo caso que `shirt.terms`: anidado, no top-level.
    medalTerms: raw.medal?.terms ?? undefined,
    descriptionRaw: raw.description ?? undefined,
    // El CTA del detalle usa una sola URL. Si el documento no trae
    // `registrationUrl` explícito, se deriva de la vía destacada de
    // `registrationOptions` (o la primera): así el botón de inscripción
    // funciona con el modelo multi-vía.
    registrationUrl:
      raw.registrationUrl ??
      raw.registrationOptions.find((o) => o.featured)?.url ??
      raw.registrationOptions[0]?.url,
    registrationDeadline: raw.registrationDeadline ?? undefined,
    modalities: raw.modalities.map((m) => ({
      distance: m.distance,
      // Fallback a la distancia si no hay label descriptivo.
      label: m.label ?? m.distance,
      price: m.price,
      status: m.status,
    })),
    categories: raw.categories.map((c) => ({ name: c.name, range: c.ages })),
    infoBlocks: mapInfoBlocks(raw.infoBlocks),
    // Un auspiciador sin logo subido no se muestra: un nombre suelto en la tira
    // no aporta nada (es una tira de MARCAS, no de texto).
    sponsors: raw.sponsors
      .map((s) => ({ name: s.name, logo: sanityImage(s.logo) }))
      .filter((s): s is RaceSponsor => s.logo !== undefined),
  };
}

// --- Fetch -------------------------------------------------------------------

// Memoizado a nivel de módulo: un solo fetch GROQ por proceso de build, aunque
// getEvents()/getEvent() se llamen desde varias páginas o secciones (home,
// calendario, 4 detalles). Mismo guard que `strapi-client.ts`.
let cachedEvents: Promise<RaceEvent[]> | null = null;

async function fetchEvents(): Promise<RaceEvent[]> {
  let raw: unknown;
  try {
    raw = await client.fetch(RACES_QUERY);
  } catch (cause) {
    throw new Error(
      `events (Sanity): no se pudo conectar al proyecto "${SANITY_PROJECT_ID}" ` +
        `(dataset "${SANITY_DATASET}"). ¿Hay red, o el proyecto/dataset son ` +
        `correctos? (${(cause as Error).message})`,
      { cause },
    );
  }

  const parsed = raceListResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `events (Sanity): el payload de la query GROQ (tipo "race") no calza con ` +
        `el schema esperado. Detalle: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }

  const events = parsed.data.map(mapRace);
  // `getCollection`/GROQ no garantizan orden: el sort explícito restaura el
  // invariante `fecha:asc` que `upcomingByMonth`/`SiteFooter`/`getNextRace` asumen.
  events.sort((a, b) => a.date.getTime() - b.date.getTime());
  return events;
}

/** Lista de carreras, ordenadas por fecha ascendente. */
export function getEvents(): Promise<RaceEvent[]> {
  if (!cachedEvents) {
    cachedEvents = fetchEvents();
  }
  return cachedEvents;
}

/**
 * Carrera puntual por slug. NO hace un fetch aparte: reusa `getEvents()`
 * (fetch único memoizado) y filtra en memoria. El caller es responsable de
 * devolver 404 cuando el resultado es null.
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
 * la MISMA regla que usan la agenda de la home y /calendario.
 *
 * Nota (staleness SSG, fuera de alcance de este cambio): se resuelve en build.
 * Cuando pase la fecha de la carrera elegida, el hero queda viejo hasta el
 * próximo rebuild — mitigado por el webhook Sanity → Vercel Deploy Hook.
 */
export async function getNextRace(): Promise<RaceEvent | null> {
  const events = await getEvents();
  if (events.length === 0) return null;
  return upcomingRaces(events)[0] ?? events[events.length - 1];
}
