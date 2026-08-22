/**
 * products.ts — capa de datos de la Tienda pública.
 *
 * Placeholder-first: 5 productos hardcodeados que fijan la FORMA que un futuro
 * `mapProducto()` (adaptador Sanity, siguiendo el patrón de `mapRace()` en
 * `content/events.ts`) tendrá que satisfacer. Mientras tanto `getProducts()` es
 * el único punto de entrada — ninguna sección importa este array directamente,
 * así que el día que esto pase a leer Sanity, el cambio es local a este archivo
 * (o al import path de la página).
 *
 * Omisiones deliberadas, espejo de `RaceEvent`:
 *  - Sin campo `status`: "agotado" se DERIVA de `stock.remaining === 0`, igual
 *    que `raceStatus()` deriva el estado de una carrera de sus modalidades, no
 *    de un flag redundante que podría desincronizarse del stock real.
 *  - `featured` SÍ es un flag propio (no derivable de nada): es una decisión
 *    editorial, igual que `isRunTour` en `events.ts`.
 *  - `sizes: []` en vez de `undefined` cuando no aplica (medalla, morral):
 *    mismo criterio "array vacío, no ausente" que el resto del content layer.
 *  - `async` aunque hoy resuelve sincrónico: el día del swap a Sanity, ningún
 *    caller cambia su firma.
 */

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
  /** Ausente en v1: no hay fotografía real todavía (ver `ProductPlaceholder`). */
  image?: ImageMetadata;
  /** Calculado, no editable — mismo criterio que el alt fijo de `mapRace()` (ver
      memoria `race-image-alt-fixed-in-front`): nunca un campo de texto libre. */
  imageAlt: string;
  placeholder: 'block-a' | 'block-b' | 'block-c';
  /** `[]` cuando la talla no aplica (medalla, morral). */
  sizes: ProductSize[];
  stock: ProductStock;
  /** Editorial: cuál de los 5 va en la posición grande de la grilla. */
  featured: boolean;
  /** "Se agotó en 6 días" — solo en el agotado, contexto sin prometer reposición. */
  soldOutNote?: string;
}

const PRODUCTS: Product[] = [
  {
    slug: 'polera-oficial-la-paz-10k',
    name: 'Polera oficial La Paz 10K',
    category: 'poleras',
    price: 120,
    edition: 'Edición La Paz 10K 2025',
    description:
      'La polera técnica que corrió la ruta de Sopocachi a Achumani. Tela ligera de secado rápido, corte unisex.',
    imageAlt: 'Polera oficial La Paz 10K, edición 2025',
    placeholder: 'block-a',
    sizes: [
      { label: 'S', available: true },
      { label: 'M', available: true },
      { label: 'L', available: true },
      { label: 'XL', available: false },
    ],
    stock: { remaining: 14, total: 40 },
    featured: true,
  },
  {
    slug: 'medalla-la-paz-10k',
    name: 'Medalla La Paz 10K',
    category: 'medallas',
    price: 80,
    edition: 'Edición La Paz 10K 2025',
    description: 'La medalla de finisher, disponible por separado para quien la quiera de recuerdo o de repuesto.',
    imageAlt: 'Medalla de finisher La Paz 10K, edición 2025',
    placeholder: 'block-b',
    sizes: [],
    stock: { remaining: 22, total: 30 },
    featured: false,
  },
  {
    slug: 'gorra-finish-line',
    name: 'Gorra Finish Line',
    category: 'accesorios',
    price: 60,
    description: 'Gorra de marca, ajustable, para entrenar o para el día de la carrera.',
    imageAlt: 'Gorra deportiva de la marca Finish Line',
    placeholder: 'block-c',
    sizes: [
      { label: 'Única', available: true },
    ],
    stock: { remaining: 9, total: 25 },
    featured: false,
  },
  {
    slug: 'morral-finish-line',
    name: 'Morral Finish Line',
    category: 'accesorios',
    price: 95,
    description: 'Morral liviano para llevar tu kit el día de la carrera.',
    imageAlt: 'Morral deportivo de la marca Finish Line',
    placeholder: 'block-a',
    sizes: [],
    stock: { remaining: 5, total: 20 },
    featured: false,
  },
  {
    slug: 'polera-5k-la-paz',
    name: 'Polera 5K La Paz',
    category: 'poleras',
    price: 100,
    edition: 'Edición La Paz 10K 2025',
    description: 'La polera de la distancia corta. Se agotó rápido en esta edición.',
    imageAlt: 'Polera de la distancia 5K, edición La Paz 10K 2025',
    placeholder: 'block-b',
    sizes: [
      { label: 'S', available: false },
      { label: 'M', available: false },
      { label: 'L', available: false },
    ],
    stock: { remaining: 0, total: 30 },
    featured: false,
    soldOutNote: 'Se agotó en 6 días',
  },
];

/** Fuente única de la Tienda. `async` a propósito: ver nota de cabecera. */
export async function getProducts(): Promise<Product[]> {
  return PRODUCTS;
}
