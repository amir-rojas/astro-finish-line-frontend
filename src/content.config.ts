import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    tagline: z.string().optional(),               // titular de marca, p.ej. "La Paz, la ciudad que corre"
    date: z.coerce.date(),                         // ISO string en JSON -> Date
    gatheringTime: z.string().optional(),         // concentración, "07:00"
    startTime: z.string().optional(),             // partida, "08:00"
    timezoneOffset: z.string().default('-04:00'), // para el countdown (Bolivia)
    // Punto de partida. OPCIONAL: una carrera vieja que solo vive como recap puede
    // no tener este dato, y obligarlo empujaba a rellenarlo con algo inventado.
    location: z.string().optional(),
    finishLocation: z.string().optional(),         // punto de meta (si difiere de la partida)
    city: z.string().optional(),
    country: z.string().optional(),
    courseTitle: z.string().optional(),            // titular de la sección recorrido
    courseDescription: z.string().optional(),      // párrafo del recorrido
    // Mapa del recorrido. Sin él, la sección "El recorrido" no se renderiza: un
    // encabezado sin mapa no informa nada.
    routeMap: image().optional(),
    routeMapAlt: z.string().optional(),
    altitudeM: z.number().optional(),              // altitud en metros (hilo conductor)
    altitudeNote: z.string().optional(),           // "La ciudad más alta del mundo"
    distances: z.array(z.string()).default([]),    // ["5K", "10K", "21K", "42K"]
    price: z
      .object({ amount: z.number(), currency: z.string().default('Bs') })
      .optional(),                                  // legacy: precio único (fallback si no hay registrationOptions)
    // Vías de inscripción de la carrera. Una carrera puede tener varias: p.ej.
    // una GRATIS (cupo cubierto) y otra de pago con kit. El dorsal las renderiza
    // en orden; `featured` marca la resaltada. Deriva "gratis" del dato real
    // (amount === 0), sin flags inventados. Si está vacío, el dorsal cae al
    // modelo legacy (price + registrationUrl único).
    registrationOptions: z
      .array(
        z.object({
          label: z.string(),                                                   // "Gratis", "Con kit"
          price: z.object({ amount: z.number(), currency: z.string().default('Bs') }),
          url: z.string().url(),                                               // inscripción externa de esta vía
          includes: z.array(z.string()).default([]),                          // qué incluye esta vía
          note: z.string().optional(),                                         // "Hasta agotar cupos", "Incluye kit"
          featured: z.boolean().default(false),                               // vía resaltada (primaria)
        }),
      )
      .default([]),
    includes: z.array(z.string()).default([]),     // legacy: qué incluye (fallback del modelo de precio único)
    categories: z
      .array(z.object({ name: z.string(), ages: z.string() }))
      .default([]),
    categoriesNote: z.string().optional(),
    registrationUrl: z.string().url().optional(),  // inscripción externa (enlace saliente)
    registrationDeadline: z.coerce.date().optional(),
    registrationNote: z.string().optional(),       // "o hasta agotar cupos"
    status: z.enum(['upcoming', 'open', 'closed', 'finished']).default('upcoming'),
    heroImage: image().optional(),                 // foto del evento (src/assets), optimizada por Astro
    heroImageAlt: z.string().optional(),           // alt de heroImage; si falta, cae al título
    // Variante APAISADA del hero para pantallas anchas (art direction, no solo
    // resolución): la foto vertical que funciona en el celular queda mal recortada
    // a lo ancho. Si falta, desktop reusa `heroImage`.
    heroImageDesktop: image().optional(),
    // Afiche oficial de la carrera. Va SOLO en el detalle, donde la imagen se
    // muestra CONTENIDA y sin texto encima: ahí un afiche se lee como afiche. NO
    // sirve para el hero de la home, que superpone su propio texto sobre la foto —
    // un afiche ahí produce tipografía sobre tipografía. Si falta, el detalle reusa
    // `heroImage`.
    poster: image().optional(),
    posterAlt: z.string().optional(),
    description: z.string().optional(),
    instagram: z.string().optional(),              // handle "@finishlinebolivia"
    instagramUrl: z.string().url().optional(),     // URL del perfil de Instagram
    facebookUrl: z.string().url().optional(),      // URL de la página de Facebook
    tiktokUrl: z.string().url().optional(),        // URL del perfil de TikTok
    youtubeUrl: z.string().url().optional(),       // URL del canal de YouTube
    whatsapp: z.string().optional(),               // contacto, "+591 62151410"
    organizer: z.string().optional(),
    organizerLogo: z.string().optional(),
    featured: z.boolean().default(false),
    // --- Campos net-new (ex-Strapi), ver adaptador `content/events.ts` -------
    // Serie Run Tour vs carrera suelta — tag de la agenda de la home.
    isRunTour: z.boolean().default(false),
    // Número de etapa dentro del Run Tour ("Etapa 01"). Solo tiene sentido con
    // `isRunTour: true`. El hero lo muestra junto al nombre de la serie; sin él,
    // el lockup degrada al nombre de la serie a secas.
    runTourStage: z.number().int().positive().optional(),
    coorganizer: z.string().optional(),            // "Alcaldía de La Paz" (chip del hero)
    // --- Recap (carrera ya corrida) -----------------------------------------
    // Álbum de fotos de la carrera. Hoy las fotos viven en Facebook: no tenemos
    // dónde alojarlas. OPCIONAL a propósito: solo las carreras que REALMENTE
    // tienen álbum lo llevan, y solo esas se vuelven clickeables en "Así se
    // vivió". Una tarjeta que promete fotos que no existen es una mentira barata.
    photosUrl: z.string().url().optional(),
    // Foto para la vitrina de recaps. Si falta, cae a `heroImage`.
    recapImage: image().optional(),
    recapImageAlt: z.string().optional(),
    // Encuadre de la foto del recap ("50% 40%"): las fotos de carrera tienen la
    // acción en distintos lugares y el recorte por defecto decapita corredores.
    recapImageFocus: z.string().optional(),
    // Merch del evento: polera oficial y medalla finisher. Media local opcional,
    // misma forma que heroImage (imagen + alt separado).
    shirt: image().optional(),
    shirtAlt: z.string().optional(),
    // CONDICIÓN para llevarse la pieza ("Solo con la modalidad Con polera · 230 Bs").
    // Sin ella la pieza NO se muestra: una foto de merch sin condición es una
    // promesa que la carrera puede no cumplir, y eso ya pasó (la polera se exhibía
    // como incluida cuando en realidad separa la vía de 105 de la de 230).
    shirtTerms: z.string().optional(),
    medal: image().optional(),
    medalAlt: z.string().optional(),
    medalTerms: z.string().optional(),
    // Modalidades reales de la carrera (distancia + precio + estado propio).
    // Si viene vacío, el listado/hero cae al legacy `distances[]`.
    modalities: z
      .array(
        z.object({
          distance: z.string(),
          label: z.string().optional(), // fallback a `distance` en el adaptador
          price: z.number(),
          status: z.enum(['abierto', 'ultimos_cupos', 'agotado']).default('abierto'),
        }),
      )
      .default([]),
    // Bloques de "Información del evento" (reglamento, convocatoria…). Los
    // adjuntos (`files`) son rutas públicas (p.ej. "/docs/reglamento.pdf" en
    // /public), no media gestionada: local no tiene equivalente a Strapi media.
    infoBlocks: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(), // markdown crudo
          order: z.number().optional(),
          files: z
            .array(
              z.object({
                url: z.string(),
                name: z.string(),
                sizeKb: z.number(),
                mime: z.string(),
                ext: z.string().optional(),
              }),
            )
            .default([]),
        }),
      )
      .default([]),
  }),
});

export const collections = { events };
