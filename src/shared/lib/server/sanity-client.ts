/**
 * sanity-client.ts — cliente Sanity compartido (server-only por convención).
 *
 * Extraído de `content/events.ts` cuando apareció el segundo consumidor
 * (`surfaces/public/features/tienda/products.ts`): duplicar
 * projectId/dataset/apiVersion/useCdn en dos archivos invita a que uno se
 * actualice y el otro no.
 *
 * Ojo: a diferencia de sus vecinos (`backend-client.ts`, `strapi-client.ts`),
 * este módulo NO importa `astro:env/server` — no hay secreto que proteger, el
 * dataset es público. Eso significa que NO hay un error de build automático si
 * alguien lo importa desde un bundle de cliente: la regla server-only acá es
 * convención, no barrera. Usar solo desde frontmatter .astro o rutas API.
 */
import { createClient } from '@sanity/client';

// Dataset público (plan free), sin token de lectura: `projectId`/`dataset` son
// constantes públicas en código, no secretos — no hace falta env var.
export const SANITY_PROJECT_ID = '34shscw3';
export const SANITY_DATASET = 'production';
// Pineada a una fecha fija: fija la forma de la API contra futuros cambios de
// default en Sanity, para que los adaptadores no se rompan por una
// actualización silenciosa del lado del proveedor.
export const SANITY_API_VERSION = '2024-01-01';

export const sanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: SANITY_API_VERSION,
  // NO NEGOCIABLE: el CDN de Sanity tiene ~10 min de retraso tras un publish en
  // Studio. Un build disparado por el webhook de Sanity justo después de
  // publicar tiene que leer el estado YA publicado, no una copia vieja cacheada
  // — reintroducir ese retraso es exactamente el problema de staleness que el
  // cambio `sanity-integration` vino a resolver.
  useCdn: false,
});
