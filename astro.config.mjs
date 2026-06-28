// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://finishlinebolivia.com',
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
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
