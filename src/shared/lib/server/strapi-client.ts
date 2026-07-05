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
  heroImage?: { url: string; alt: string };
  /** Markdown crudo tal cual viene de Strapi. Renderizar en la superficie que lo use. */
  descriptionRaw?: string;
  registrationUrl?: string;
  registrationDeadline?: Date;
  modalities: RaceModality[];
  categories: RaceAgeCategory[];
}

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
