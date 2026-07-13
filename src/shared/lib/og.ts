// Imagen de compartir (Open Graph) de una carrera.
//
// Vivía duplicada en la home y en el detalle, y ninguna de las dos contemplaba a
// las carreras SIN foto: caían al `/og-default.jpg` del layout, que NO EXISTE.
// Compartir /calendario, Francofonía o Titicaca daba una preview rota.

import { getImage } from 'astro:assets';
import type { RaceEvent } from '@shared/lib/content/events';

// 1200×630 (1.91:1) es la tarjeta grande de Facebook, WhatsApp y Twitter.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/**
 * Imagen para compartir. Se trata según la NATURALEZA del asset, igual que la
 * grilla de /calendario:
 *
 * - FOTO: se encuadra a 1200×630. Está pensada para recortarse.
 * - AFICHE: se entrega ENTERO a 1200 de ancho, en su proporción (sale ~1200×1500).
 *   No se recorta a 1.91:1 porque a un afiche eso le come el texto de los bordes.
 *
 * Lo ideal para el afiche sería un letterbox: contenerlo sobre el navy de marca
 * dentro de un lienzo de 1200×630. El servicio de imagen de Astro NO puede
 * hacerlo: mapea `fit: 'contain'` al `inside` de sharp (encoge para caber, sin
 * rellenar) y su `background` es un `flatten()`, que solo quita la transparencia.
 * Pedirle 1200×630 con `contain` devuelve 504×630 — demasiado angosto para la
 * tarjeta grande. Entre un afiche entero y alto, y uno decapitado y ancho, gana
 * el entero: la red social elegirá su propio recorte, pero el asset no miente.
 *
 * `undefined` si la carrera no tiene ni foto ni afiche: el layout entonces OMITE
 * el `og:image` en vez de apuntar a un archivo inexistente.
 */
export async function raceOgImage(race: RaceEvent): Promise<string | undefined> {
  if (race.heroImage) {
    const img = await getImage({
      src: race.heroImage,
      width: OG_WIDTH,
      height: OG_HEIGHT,
      format: 'jpeg',
    });
    return img.src;
  }
  if (race.poster) {
    const img = await getImage({ src: race.poster, width: OG_WIDTH, format: 'jpeg' });
    return img.src;
  }
  return undefined;
}
