import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const events = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),                        // ISO string en JSON -> Date
    location: z.string(),                         // sede / punto de partida
    city: z.string().optional(),
    distances: z.array(z.string()).default([]),   // ["5K", "10K", "21K", "42K"]
    registrationUrl: z.string().url().optional(),
    status: z.enum(['upcoming', 'open', 'closed', 'finished']).default('upcoming'),
    heroImage: z.string().optional(),             // ruta /assets o URL externa
    description: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { events };
