/**
 * products.ts — capa de datos de la Tienda pública.
 *
 * Sucesora del array placeholder hardcodeado: ahora lee del tipo `producto` en
 * Sanity vía GROQ + zod + `mapProducto()`, siguiendo el mismo patrón que
 * `mapRace()` en `content/events.ts` (fetch → validar → adaptar → cachear).
 *
 * DIVERGENCIA DELIBERADA respecto de `events.ts`: si el fetch o la validación
 * fallan, `getProducts()` NO tira — degrada a `[]` con un `console.error`. Con
 * `output: 'static'`, todas las páginas se construyen en un solo proceso; la
 * tienda está deslinkeada y con `noindex`, y no se ganó el derecho de tumbar la
 * home, `/calendario` o `/inscripcion` por un producto mal cargado.
 *
 * Omisiones deliberadas, espejo de `RaceEvent`:
 *  - Sin campo `status`: "agotado" se DERIVA de `stock.remaining === 0`, igual
 *    que `raceStatus()` deriva el estado de una carrera de sus modalidades, no
 *    de un flag redundante que podría desincronizarse del stock real.
 *  - `featured` SÍ es un flag propio (no derivable de nada): es una decisión
 *    editorial, igual que `isRunTour` en `events.ts`.
 *  - `sizes: []` en vez de `undefined` cuando no aplica (medalla, morral):
 *    mismo criterio "array vacío, no ausente" que el resto del content layer.
 *  - `async` — el caller nunca supo si esto era síncrono o no.
 */
import { z } from 'zod';
import { sanityClient } from '@shared/lib/server/sanity-client';

export type ProductCategory = 'poleras' | 'medallas' | 'accesorios';

export interface ProductSize {
  label: string;
  available: boolean;
}

export interface ProductStock {
  remaining: number;
  total: number;
}

export interface Product {
  slug: string;
  name: string;
  category: ProductCategory;
  /** Precio en Bs, entero. Sin descuentos en v1: no hay precio anterior que tachar. */
  price: number;
  /** "Edición La Paz 10K 2025" — opcional, no todos los productos son de una carrera puntual. */
  edition?: string;
  description?: string;
  /** Opcional en Sanity — sin foto todavía, `ProductPlaceholder` dibuja el bloque de color en su lugar. */
  image?: ImageMetadata;
  /** Calculado, no editable — mismo criterio que el alt fijo de `mapRace()` (ver
      memoria `race-image-alt-fixed-in-front`): nunca un campo de texto libre. */
  imageAlt: string;
  placeholder: 'block-a' | 'block-b' | 'block-c';
  /** `[]` cuando la talla no aplica (medalla, morral). */
  sizes: ProductSize[];
  stock: ProductStock;
  /** Editorial: cuál producto va en la posición grande de la grilla. */
  featured: boolean;
  /** "Se agotó en 6 días" — solo en el agotado, contexto sin prometer reposición. */
  soldOutNote?: string;
}

// --- Query GROQ ---------------------------------------------------------------
// `image` es la única dereferencia `->`: `producto.image` reusa el tipo `raceImage`
// del Studio (asset opcional, sin `alt` editable — mismo criterio que `content/events.ts`).

const PRODUCT_IMAGE_PROJECTION = `{
    asset->{ url, extension, metadata{ dimensions{ width, height } } }
  }`;

const PRODUCTS_QUERY = `*[_type == "producto"]{
  "slug": slug.current,
  name,
  category,
  price,
  edition,
  description,
  image ${PRODUCT_IMAGE_PROJECTION},
  sizes[]{ label, available },
  stock{ remaining, total },
  featured,
  soldOutNote
}`;

// --- Validación zod ------------------------------------------------------------
// GROQ devuelve `null` explícito para campos ausentes, nunca `undefined` — mismo
// criterio `.nullable().optional()` que `content/events.ts`.

function nullableArray<T extends z.ZodTypeAny>(item: T) {
  return z
    .array(item)
    .nullable()
    .optional()
    .transform((v) => v ?? []);
}

const sizeSchema = z.object({
  label: z.string(),
  // `initialValue: true` en el Studio, pero un documento viejo puede no traerlo.
  available: z.boolean().nullable().optional(),
});

// Mismo shape que `raceImageSchema` en `content/events.ts`: sin `alt` editable.
const imageAssetSchema = z.object({
  url: z.string(),
  extension: z.string(),
  metadata: z.object({
    dimensions: z.object({ width: z.number(), height: z.number() }),
  }),
});

const productImageSchema = z
  .object({
    asset: imageAssetSchema.nullable().optional(),
  })
  .nullable()
  .optional();

const productoSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.enum(['poleras', 'medallas', 'accesorios']),
  price: z.number(),
  edition: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image: productImageSchema,
  sizes: nullableArray(sizeSchema),
  // `stock` y sus dos campos son `.required()` en el Studio: se validan duros,
  // igual que `raceSchema` no afloja los campos requeridos de `race`.
  stock: z.object({ remaining: z.number(), total: z.number() }),
  featured: z.boolean().nullable().optional(),
  soldOutNote: z.string().nullable().optional(),
});

const productListResponseSchema = z.array(productoSchema);
type RawProducto = z.infer<typeof productoSchema>;
type RawProductImage = RawProducto['image'];

/**
 * Fabrica un `ImageMetadata` a partir del asset de Sanity — mismo `sanityImage()`
 * que `content/events.ts`. `undefined` cuando no hay asset (foto opcional sin
 * cargar): `ProductPlaceholder` dibuja el bloque de color en ese caso.
 */
function sanityImage(raw: RawProductImage): ImageMetadata | undefined {
  if (!raw?.asset) return undefined;
  return {
    src: raw.asset.url,
    width: raw.asset.metadata.dimensions.width,
    height: raw.asset.metadata.dimensions.height,
    format: raw.asset.extension as ImageMetadata['format'],
  };
}

// --- Síntesis: placeholder + imageAlt -------------------------------------------

const PLACEHOLDER_VARIANTS = ['block-a', 'block-b', 'block-c'] as const;

/**
 * Variante decorativa del bloque de color, derivada del slug — NO del índice.
 * Suma de char codes del slug mod 3. Determinista y estable: agregar o quitar un
 * producto no reshufflea las variantes de los demás, y dos builds del mismo
 * dataset pintan exactamente los mismos bloques.
 */
function placeholderFor(slug: string): Product['placeholder'] {
  let sum = 0;
  for (let i = 0; i < slug.length; i++) sum += slug.charCodeAt(i);
  return PLACEHOLDER_VARIANTS[sum % 3];
}

/**
 * Texto alternativo calculado, nunca editable — mismo criterio que los alt fijos
 * de `mapRace()` (memoria `race-image-alt-fixed-in-front`). La edición entra como
 * aposición en minúscula ("Polera oficial La Paz 10K, edición La Paz 10K 2025").
 */
function productImageAlt(name: string, edition?: string): string {
  if (!edition) return name;
  const inline = edition.charAt(0).toLowerCase() + edition.slice(1);
  return `${name}, ${inline}`;
}

// --- Adaptador -------------------------------------------------------------------

function mapProducto(raw: RawProducto): Product {
  const edition = raw.edition ?? undefined;
  return {
    slug: raw.slug,
    name: raw.name,
    category: raw.category,
    price: raw.price,
    edition,
    description: raw.description ?? undefined,
    image: sanityImage(raw.image),
    imageAlt: productImageAlt(raw.name, edition),
    placeholder: placeholderFor(raw.slug),
    sizes: raw.sizes.map((s) => ({ label: s.label, available: s.available ?? true })),
    stock: { remaining: raw.stock.remaining, total: raw.stock.total },
    featured: raw.featured ?? false,
    soldOutNote: raw.soldOutNote ?? undefined,
  };
}

// --- Orden ---------------------------------------------------------------------
// GROQ no garantiza orden; el orden por categoría es editorial, no lexical.

const CATEGORY_ORDER: Record<ProductCategory, number> = {
  poleras: 0,
  medallas: 1,
  accesorios: 2,
};

function sortProducts(a: Product, b: Product): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (byCategory !== 0) return byCategory;
  return a.name.localeCompare(b.name, 'es');
}

// --- Fetch + memoización + degradación suave ------------------------------------

// Memoizado a nivel de módulo: un solo fetch GROQ por proceso de build. Mismo
// mecanismo que `getEvents()` en `content/events.ts`.
let cachedProducts: Promise<Product[]> | null = null;

async function fetchProducts(): Promise<Product[]> {
  try {
    const raw = await sanityClient.fetch(PRODUCTS_QUERY);
    const parsed = productListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(
        `tienda (Sanity): el payload de la query GROQ (tipo "producto") no calza ` +
          `con el schema esperado. La tienda queda VACÍA en este build. ` +
          `Detalle: ${parsed.error.message}`,
      );
      return [];
    }
    return parsed.data.map(mapProducto).sort(sortProducts);
  } catch (cause) {
    // DIVERGENCIA DELIBERADA respecto de `events.ts`, que sí tira y rompe el
    // build: Astro `output: 'static'` construye TODAS las páginas en un solo
    // proceso, así que un throw acá se llevaría puestas la home, /calendario y
    // /inscripcion por culpa de un producto mal cargado. La tienda está
    // deslinkeada y con `noindex`: se degrada a vacía y grita en el log.
    console.error(
      `tienda (Sanity): no se pudieron leer los productos. La tienda queda VACÍA ` +
        `en este build. (${(cause as Error).message})`,
    );
    return [];
  }
}

/** Fuente única de la Tienda. Un solo fetch por build, sin importar los callers. */
export function getProducts(): Promise<Product[]> {
  if (!cachedProducts) {
    // Si el fetch falla, se limpia el caché para que la siguiente llamada
    // reintente en vez de repetir el mismo resultado degradado para siempre.
    cachedProducts = fetchProducts().then((products) => {
      if (products.length === 0) cachedProducts = null;
      return products;
    });
  }
  return cachedProducts;
}
