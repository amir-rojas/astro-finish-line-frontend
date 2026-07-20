// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.finishlinebolivia.com',
  output: 'static',
  adapter: vercel(),
  integrations: [sitemap()],
  image: {
    // Autoriza a `<Image>`/`getImage()` a descargar y optimizar assets servidos
    // por el CDN de imágenes de Sanity (ver `content/events.ts`: los campos de
    // imagen de `RaceEvent` fabrican un `ImageMetadata` con `src` apuntando acá).
    remotePatterns: [{ protocol: 'https', hostname: 'cdn.sanity.io' }],
  },
  env: {
    schema: {
      // Base URL del backend (solo server-side BFF). No es secreto.
      BACKEND_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'http://localhost:8080',
      }),
      // Secreto para firmar/cifrar la sesión admin (cookie httpOnly). Sin default intencional.
      SESSION_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      // PARKED: Strapi ya no alimenta ningún build (ver `strapi-client.ts`, el
      // contenido de carreras vive en `src/content/events/*.json`). Se
      // mantienen declaradas y opcionales SOLO para que `strapi-client.ts`
      // (conservado para cuando el CMS+Go esté hosteado) siga tipando bajo
      // `astro:env/server` mientras está parked. Nada las lee en runtime.
      STRAPI_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'http://localhost:1337',
      }),
      STRAPI_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
