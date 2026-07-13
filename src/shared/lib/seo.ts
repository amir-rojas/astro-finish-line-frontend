// Datos estructurados de la ORGANIZACIÓN y del listado de carreras.
//
// Reparto de roles — una URL, un tema:
//   `/`                  SportsOrganization + ItemList — quién es Finish Line y qué carreras hay
//   `/calendario/[slug]` SportsEvent — dueña ÚNICA de cada carrera
//
// Antes la home emitía el `SportsEvent` de la próxima carrera: el MISMO que
// emite su página de detalle. Dos URLs le declaraban a Google el mismo evento y
// Google elegía cuál mostrar. Peor: la home no tenía tema propio —su título, su
// descripción y su dato estructurado eran los de una carrera puntual—, así que
// cada vez que la próxima carrera cambiaba, la home cambiaba de identidad y
// nunca acumulaba autoridad para "Finish Line" ni para "carreras en Bolivia".
//
// El hero sigue mostrando la próxima carrera: eso es frescura, y es deseable.
// Lo que dejó de hacer es DEFINIR la página.

import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { site } from '@shared/config/site';
import type { RaceEvent } from '@shared/lib/content/events';

// Logo del organizador para schema.org. Google pide 112×112 como mínimo y el
// apple-touch-icon (180×180) es la única marca en un formato que sirve. Cuando
// exista un logo dedicado, cambiar solo esta constante.
const ORG_LOGO = '/apple-touch-icon.png';

const abs = (path: string, base: URL): string => new URL(path, base).href;

// Google corta la descripción alrededor de los 155-160 caracteres. Cortamos
// nosotros, en un límite legible, en vez de dejar que la corte él a mitad de palabra.
const META_MAX = 155;

// sanitize-html deja las entidades codificadas al quitar todas las etiquetas.
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * `<meta description>` a partir de la descripción de la carrera.
 *
 * El campo `description` del contenido es MARKDOWN y su destino principal es la
 * sección visible "Descripción" del detalle: puede tener párrafos y formato. El
 * buscador quiere lo contrario — una línea plana y corta. Meterlo crudo en la
 * meta publicaba los asteriscos del markdown y un texto que Google cortaba a
 * mitad de palabra.
 *
 * Así que de un solo campo salen las dos cosas: la página lo renderiza entero, y
 * acá se aplana (markdown → HTML → texto) y se corta en el último punto que entre
 * en el límite; si no hay ninguno, en el último espacio, con puntos suspensivos.
 * Cortar en el medio de una frase es peor que cortar corto.
 */
export function metaDescription(markdown: string): string {
  const html = marked.parse(markdown, { async: false });
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= META_MAX) return text;

  const head = text.slice(0, META_MAX);
  const lastStop = head.lastIndexOf('. ');
  if (lastStop > 0) return head.slice(0, lastStop + 1);

  const lastSpace = head.lastIndexOf(' ');
  return `${head.slice(0, lastSpace > 0 ? lastSpace : META_MAX).trimEnd()}…`;
}

/**
 * Título SEO de una carrera: "Renacer 2026". El año va porque es como se busca una
 * carrera y es lo único que distingue una edición de la siguiente — y porque desde
 * que la home dejó de ser la página de la próxima carrera, es ESTA la que tiene que
 * ganar esa búsqueda. No se agrega si el título ya lo trae ("Maratón del Titicaca
 * 2025"), que produciría "Maratón del Titicaca 2025 2025".
 *
 * El `<h1>` sigue siendo el nombre a secas: el año es contexto de buscador, no
 * titular de página.
 */
export function raceSeoTitle(title: string, date: Date): string {
  const year = String(date.getUTCFullYear());
  return title.includes(year) ? title : `${title} ${year}`;
}

/** `SportsOrganization` de Finish Line. Va en la home: es la página del organizador. */
export function organizationJsonLd(base: URL): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: site.organizer,
    alternateName: site.shortName,
    sport: 'Running',
    url: abs('/', base),
    logo: abs(ORG_LOGO, base),
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.address.locality,
      addressCountry: site.address.countryCode,
    },
    // `sameAs` es lo que le permite a Google atar el sitio con los perfiles
    // sociales y consolidarlos en una sola entidad de marca.
    sameAs: site.socials.map((s) => s.href),
  };
}

/**
 * `BreadcrumbList` — la miga de pan. Google la usa para mostrar
 * "Inicio › Calendario › Renacer" en el resultado, en vez de la URL cruda.
 *
 * Los `crumbs` van de la raíz a la página actual, SIN incluirla: la página donde
 * vive la miga es el último eslabón y schema.org espera que se declare igual, así
 * que el caller pasa la ruta completa y acá se numera.
 */
export function breadcrumbJsonLd(
  crumbs: { name: string; path: string }[],
  base: URL,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path, base),
    })),
  };
}

/**
 * `ItemList` de las carreras: le dice a Google que esta es una página resumen y
 * dónde vive el detalle de cada una.
 *
 * Cada `ListItem` lleva SOLO `position` y `url`, que es lo que pide Google para
 * páginas resumen: los datos del evento viven en la página de destino y
 * repetirlos acá reintroduciría la duplicación que este módulo existe para matar.
 */
export function racesItemListJsonLd(races: RaceEvent[], base: URL): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: races.map((race, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: abs(`/calendario/${race.slug}`, base),
    })),
  };
}
