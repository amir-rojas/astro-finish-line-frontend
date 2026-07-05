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
      // URL base de Strapi (CMS de carreras). No es secreto. Default a localhost
      // para dev. `optional: true` a propósito durante la transición: mientras la
      // home siga sirviéndose del JSON local, no queremos romper el build por no
      // tener Strapi configurado. El fail-fast real vive en strapi-client.ts
      // (requireEnv), que corta el build recién cuando una sección la consume.
      STRAPI_URL: envField.string({
        context: 'server',
        access: 'public',
        optional: true,
        default: 'http://localhost:1337',
      }),
      // Token de API de Strapi (lectura de contenido publicado). Secreto, sin
      // default. Ver nota de transición en STRAPI_URL.
      STRAPI_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
  image: {
    // Habilita astro:assets para optimizar la heroImage remota servida por Strapi.
    // localhost:1337 cubre desarrollo local; el host de producción de Strapi aún
    // no está decidido (TBD) — agregar el patrón real antes de deployar la primera
    // sección de la home que consuma imágenes de Strapi.
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1337',
      },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
