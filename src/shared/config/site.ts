// Datos de la ORGANIZACIÓN, no de una carrera.
//
// Vivían dentro de `src/content/events/*.json`, heredados de cuando el sitio era
// la landing de un solo evento. En el modelo real —Finish Line organiza muchas
// carreras— el WhatsApp, las redes y el nombre del organizador son hechos de la
// empresa: no cambian de una carrera a otra, y el footer los necesita en TODAS
// las páginas, no solo donde hay un evento en el scope.
//
// Migrable a un single type "Organización" en Strapi sin tocar los componentes:
// basta con que este módulo pase a leer del CMS y mantenga la forma de `site`.

export interface SocialLink {
  label: string;
  href: string;
  icon: 'instagram' | 'facebook' | 'tiktok' | 'youtube';
}

export interface SiteConfig {
  /** Razón social. Es el `name` del SportsOrganization y el del copyright. */
  organizer: string;
  /** La marca como la usa la gente (y como la busca). `alternateName` en schema.org. */
  shortName: string;
  /** Sede. Estructurada porque schema.org/PostalAddress la necesita en partes. */
  address: { locality: string; country: string; countryCode: string };
  /** Formato internacional legible; el `href` de wa.me se deriva quitando todo lo que no sea dígito. */
  whatsapp?: string;
  socials: SocialLink[];
}

export const site: SiteConfig = {
  organizer: 'Finish Line Sporting Events',
  shortName: 'Finish Line',
  address: { locality: 'La Paz', country: 'Bolivia', countryCode: 'BO' },
  whatsapp: '+591 62151410',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/finishlinebolivia', icon: 'instagram' },
    { label: 'Facebook', href: 'https://www.facebook.com/FinishLineSportingEvents', icon: 'facebook' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@finishlinesport', icon: 'tiktok' },
    { label: 'YouTube', href: 'https://www.youtube.com/@finishlinebolivia', icon: 'youtube' },
  ],
};

/** "La Paz, Bolivia" — la sede en prosa, para la línea de créditos del footer. */
export const cityLine = `${site.address.locality}, ${site.address.country}`;

/** `https://wa.me/59162151410?text=...` — null si la organización no publica WhatsApp. */
export function whatsappLink(message: string): { href: string; detail: string } | null {
  if (!site.whatsapp) return null;
  const digits = site.whatsapp.replace(/\D/g, '');
  return {
    href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    detail: site.whatsapp,
  };
}
