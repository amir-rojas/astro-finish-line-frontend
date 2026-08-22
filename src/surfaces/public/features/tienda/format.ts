// Helpers de formato + mensajes de WhatsApp de la Tienda pública.
//
// Mismo patrón que `calendar/format.ts`: la sección nunca arma texto suelto,
// llama a un helper de acá. `orderMessage`/`waitlistMessage`/`BROWSE_MESSAGE`
// son la ÚNICA fuente de los mensajes prellenados — así los tres CTAs (card,
// destacado, barra fija) no pueden desincronizarse entre sí.
import { site } from '@shared/config/site';
import type { Product } from './products';

const CURRENCY = 'Bs';

/** "120 Bs" — precio de un producto. Sin "GRATIS": en la Tienda nada es gratis. */
export function formatPrice(amount: number): string {
  return `${amount} ${CURRENCY}`;
}

export interface StockMeta {
  label: string;
  tone: 'open' | 'warning' | 'closed';
}

/**
 * Tono del stock, mismo semáforo de tres colores que `raceStatus()` usa para
 * inscripciones — el usuario ya trae la lectura aprendida (verde=hay, ámbar=
 * poco, gris=no hay). Umbral de "poco stock": 20% o menos del total.
 */
export function stockTone(stock: Product['stock']): StockMeta['tone'] {
  if (stock.remaining === 0) return 'closed';
  if (stock.remaining / stock.total <= 0.2) return 'warning';
  return 'open';
}

/** "Quedan 3 de 20" / "Agotado" — el label textual que SIEMPRE acompaña al color. */
export function stockLabel(stock: Product['stock']): string {
  if (stock.remaining === 0) return 'Agotado';
  return `Quedan ${stock.remaining} de ${stock.total}`;
}

/** Ancho (0–100) de la barra de stock, server-rendered inline en `style="width:N%"`. */
export function stockPercent(stock: Product['stock']): number {
  if (stock.total <= 0) return 0;
  return Math.round((stock.remaining / stock.total) * 100);
}

export const BROWSE_MESSAGE = `Hola, quiero ver qué hay disponible en la Tienda de ${site.shortName}.`;

/** Mensaje del CTA "PEDIR" — con talla cuando el producto la tiene. */
export function orderMessage(product: Product, size?: string): string {
  const sizeSuffix = size ? ` (talla ${size})` : '';
  return `Hola, quiero pedir: ${product.name}${sizeSuffix} — ${formatPrice(product.price)}.`;
}

/** Mensaje del CTA "AVÍSAME" del producto agotado. */
export function waitlistMessage(product: Product): string {
  return `Hola, avísame cuando vuelva a haber: ${product.name}.`;
}
