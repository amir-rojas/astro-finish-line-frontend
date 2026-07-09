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
  organizer: string;
  /** Ciudad base de la organización, para la línea de créditos del footer. */
  city: string;
  /** Formato internacional legible; el `href` de wa.me se deriva quitando todo lo que no sea dígito. */
  whatsapp?: string;
  socials: SocialLink[];
}

export const site: SiteConfig = {
  organizer: 'Finish Line Sporting Events',
  city: 'La Paz, Bolivia',
  whatsapp: '+591 62151410',
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/finishlinebolivia', icon: 'instagram' },
    { label: 'Facebook', href: 'https://www.facebook.com/FinishLineSportingEvents', icon: 'facebook' },
    { label: 'TikTok', href: 'https://www.tiktok.com/@finishlinesport', icon: 'tiktok' },
    { label: 'YouTube', href: 'https://www.youtube.com/@finishlinebolivia', icon: 'youtube' },
  ],
};

/** `https://wa.me/59162151410?text=...` — null si la organización no publica WhatsApp. */
export function whatsappLink(message: string): { href: string; detail: string } | null {
  if (!site.whatsapp) return null;
  const digits = site.whatsapp.replace(/\D/g, '');
  return {
    href: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    detail: site.whatsapp,
  };
}
