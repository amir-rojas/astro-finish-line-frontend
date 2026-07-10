/**
 * strapi-client.ts — capa de datos de carreras (server-only, compartida).
 *
 * Es la costura única Astro→Strapi para el contenido de carreras. Nace para la
 * home (módulos "próxima carrera" y agenda), y está pensada para que cualquier
 * superficie futura (calendario, detalle) consuma la MISMA capa en vez de
 * duplicar fetch ni schema.
 *
 * Importa STRAPI_URL / STRAPI_TOKEN desde `astro:env/server`, lo que convierte
 * a este módulo en server-only por construcción: Astro falla el build si
 * termina en un bundle de cliente. Nunca importar desde <script> ni desde
 * componentes con directiva `client:*`.
 *
 * Fetch en build (SSG), one-shot, sin i18n. Zod es la única frontera de
 * validación: si Strapi no responde o el payload no calza con el schema,
 * este módulo hace throw y el build se corta (fail-fast intencional). Mientras
 * ninguna página llame a getEvents(), este módulo es inerte y no toca la red.
 *
 * Contrato Strapi v5: payload PLANO (atributos en la raíz de cada item),
 * SIN `data.attributes` de v4. Solo contenido publicado (Draft & Publish ON).
 */
import { z } from 'zod';
import { STRAPI_URL, STRAPI_TOKEN } from 'astro:env/server';
import { upcomingRaces } from '@shared/lib/race-date';

// --- Schemas Strapi (forma cruda, nombres de campo en español) ------------

const modalitySchema = z.object({
  distancia: z.string(),
  // Opcional en Strapi: si el editor no carga un label descriptivo, no se
  // rompe el build. En el mapeo se hace fallback a `distancia`.
  label: z.string().nullable().optional(),
  precio: z.number().int(),
  estado: z.enum(['abierto', 'ultimos_cupos', 'agotado']),
});

const ageCategorySchema = z.object({
  nombre: z.string(),
  rango: z.string(),
});

const heroImageSchema = z
  .object({
    url: z.string(),
    alternativeText: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

const raceSchema = z.object({
  documentId: z.string(),
  nombre: z.string(),
  slug: z.string(),
  fecha: z.coerce.date(),
  ubicacion: z.string(),
  heroImage: heroImageSchema,
  descripcion: z.string().nullable().optional(),
  urlEventrid: z.string().nullable().optional(),
  cierreInscripcion: z.coerce.date().nullable().optional(),
  modalidades: z.array(modalitySchema).default([]),
  categoriasEdad: z.array(ageCategorySchema).default([]),
  // Campos net-new para el hero de la home (Strapi los devuelve null hasta que
  // el editor los carga). Todos opcionales: el hero degrada elegante sin ellos.
  tagline: z.string().nullable().optional(),
  altitud: z.number().int().nullable().optional(),
  altitudNota: z.string().nullable().optional(),
  // Strapi `time` → "HH:mm:ss.SSS". Alimenta el countdown junto con `fecha`.
  horaLargada: z.string().nullable().optional(),
  estado: z
    .enum(['proximo', 'inscripciones_abiertas', 'cerrado', 'finalizado'])
    .nullable()
    .optional(),
  coorganizador: z.string().nullable().optional(),
  // serie Run Tour vs carrera suelta — tag de la agenda
  esRunTour: z.boolean().nullable().optional(),
});

const strapiListResponseSchema = z.object({
  data: z.array(raceSchema),
});

type RawRace = z.infer<typeof raceSchema>;

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

export interface RaceEvent {
  slug: string;
  title: string;
  date: Date;
  location: string;
  /** Distancias derivadas de `modalidades[].distancia` (no hay campo propio en Strapi). */
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
  heroImage?: { url: string; alt: string };
  /** Markdown crudo tal cual viene de Strapi. Renderizar en la superficie que lo use. */
  descriptionRaw?: string;
  registrationUrl?: string;
  registrationDeadline?: Date;
  modalities: RaceModality[];
  categories: RaceAgeCategory[];
}

// --- Alias de la superficie de calendario/detalle ---------------------------
// El calendario y el detalle son otra VISTA de la misma carrera: consumen la
// MISMA capa de datos (una carrera = un registro, sin duplicar). `RaceEvent` es
// el tipo canónico (superset con los campos del hero); estos alias dejan que el
// feature `calendar/` lea el mismo dato con su vocabulario, sin un segundo fetch
// ni un schema paralelo.
export type CalendarEvent = RaceEvent;
export type CalendarModality = RaceModality;
export type CalendarAgeCategory = RaceAgeCategory;

// --- Config / fail-fast ------------------------------------------------------

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `strapi-client: falta la variable de entorno "${name}". Definila en .env ` +
        `(ver .env.example) antes de correr "pnpm dev" o "pnpm build". El build ` +
        `se corta acá a propósito (fail-fast) para no publicar carreras con datos rotos.`,
    );
  }
  return value;
}

function toAbsoluteUrl(url: string, base: string): string {
  return /^https?:\/\//i.test(url) ? url : new URL(url, base).toString();
}

function mapRace(raw: RawRace, strapiUrl: string): RaceEvent {
  return {
    slug: raw.slug,
    title: raw.nombre,
    date: raw.fecha,
    location: raw.ubicacion,
    distances: raw.modalidades.map((m) => m.distancia),
    tagline: raw.tagline ?? undefined,
    altitudeM: raw.altitud ?? undefined,
    altitudeNote: raw.altitudNota ?? undefined,
    // "08:00:00.000" → "08:00" (el countdown solo necesita hora y minuto).
    startTime: raw.horaLargada ? raw.horaLargada.slice(0, 5) : undefined,
    status: raw.estado ?? undefined,
    coorganizer: raw.coorganizador ?? undefined,
    isRunTour: raw.esRunTour ?? false,
    heroImage: raw.heroImage
      ? {
          url: toAbsoluteUrl(raw.heroImage.url, strapiUrl),
          alt: raw.heroImage.alternativeText ?? raw.nombre,
        }
      : undefined,
    descriptionRaw: raw.descripcion ?? undefined,
    registrationUrl: raw.urlEventrid ?? undefined,
    registrationDeadline: raw.cierreInscripcion ?? undefined,
    modalities: raw.modalidades.map((m) => ({
      distance: m.distancia,
      // Fallback a la distancia si no hay label descriptivo en Strapi.
      label: m.label ?? m.distancia,
      price: m.precio,
      status: m.estado,
    })),
    categories: raw.categoriasEdad.map((c) => ({ name: c.nombre, range: c.rango })),
  };
}

// --- Fetch -------------------------------------------------------------------

// Memoizado a nivel de módulo: un solo fetch por proceso de build, aunque
// getEvents()/getEvent() se llamen desde varias páginas o secciones.
let cachedEvents: Promise<RaceEvent[]> | null = null;

async function fetchEvents(): Promise<RaceEvent[]> {
  const strapiUrl = requireEnv('STRAPI_URL', STRAPI_URL);
  const strapiToken = requireEnv('STRAPI_TOKEN', STRAPI_TOKEN);

  const query = [
    'status=published',
    'sort=fecha:asc',
    'populate[0]=heroImage',
    'populate[1]=modalidades',
    'populate[2]=categoriasEdad',
  ].join('&');

  const endpoint = new URL(`/api/carreras?${query}`, strapiUrl).toString();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${strapiToken}` },
    });
  } catch (cause) {
    throw new Error(
      `strapi-client: no se pudo conectar a Strapi en "${strapiUrl}". ¿Está corriendo? (${(cause as Error).message})`,
      { cause },
    );
  }

  if (!response.ok) {
    throw new Error(
      `strapi-client: Strapi respondió ${response.status} ${response.statusText} en "${endpoint}".`,
    );
  }

  const json = await response.json();
  const parsed = strapiListResponseSchema.safeParse(json);

  if (!parsed.success) {
    throw new Error(
      `strapi-client: el payload de "${endpoint}" no calza con el schema esperado (Strapi v5, colección carreras). ` +
        `Detalle: ${parsed.error.message}`,
      { cause: parsed.error },
    );
  }

  return parsed.data.data.map((raw) => mapRace(raw, strapiUrl));
}

/** Lista de carreras publicadas, ordenadas por fecha ascendente. */
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
 * La "próxima carrera" para el hero de la home: la primera que todavía no pasó
 * (la lista viene ordenada por fecha asc). Si no hay ninguna futura, cae a la
 * más reciente (última). Devuelve null solo si no hay carreras publicadas.
 *
 * Usa `upcomingRaces` —la misma regla que la agenda y /calendario— y no una
 * comparación por instante: `fecha` es un `date` de Strapi sin hora, así que
 * llega como medianoche UTC, o sea las 20:00 del día ANTERIOR en La Paz. Con
 * `date.getTime() >= Date.now()` el hero soltaba la carrera la víspera a las
 * 20:00 y saltaba a la siguiente, mientras la agenda seguía anunciándola.
 *
 * Nota (staleness SSG): se resuelve en build. Cuando pase la fecha de la carrera
 * elegida, el hero queda viejo hasta el próximo rebuild — pendiente conocido.
 */
export async function getNextRace(): Promise<RaceEvent | null> {
  const events = await getEvents();
  if (events.length === 0) return null;
  return upcomingRaces(events)[0] ?? events[events.length - 1];
}
