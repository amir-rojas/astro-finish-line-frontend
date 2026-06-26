// @ts-check
import { defineConfig, envField } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  adapter: node({
    mode: 'standalone',
  }),

  // Esquema de variables de entorno (type-safe).
  // server + secret  → solo accesible en el servidor, nunca se inyecta al navegador.
  env: {
    schema: {
      BACKEND_URL: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});