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
    location: z.string(),                          // sede / punto de partida
    finishLocation: z.string().optional(),         // punto de meta (si difiere de la partida)
    city: z.string().optional(),
    country: z.string().optional(),
    courseTitle: z.string().optional(),            // titular de la sección recorrido
    courseDescription: z.string().optional(),      // párrafo del recorrido
    altitudeM: z.number().optional(),              // altitud en metros (hilo conductor)
    altitudeNote: z.string().optional(),           // "La ciudad más alta del mundo"
    distances: z.array(z.string()).default([]),    // ["5K", "10K", "21K", "42K"]
    price: z
      .object({ amount: z.number(), currency: z.string().default('Bs') })
      .optional(),
    includes: z.array(z.string()).default([]),     // ["Incluye dorsal oficial", ...]
    categories: z
      .array(z.object({ name: z.string(), ages: z.string() }))
      .default([]),
    categoriesNote: z.string().optional(),
    registrationUrl: z.string().url().optional(),  // Eventrid (enlace saliente)
    registrationDeadline: z.coerce.date().optional(),
    registrationNote: z.string().optional(),       // "o hasta agotar cupos"
    status: z.enum(['upcoming', 'open', 'closed', 'finished']).default('upcoming'),
    heroImage: image().optional(),                 // foto del evento (src/assets), optimizada por Astro
    description: z.string().optional(),
    instagram: z.string().optional(),              // "@finishlinebolivia"
    organizer: z.string().optional(),
    organizerLogo: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { events };
