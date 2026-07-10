// @ts-check
import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// El patrón de imagen remota se DERIVA de STRAPI_URL en vez de hardcodear el host.
// El sitio es `output: 'static'`: las fotos de las carreras se descargan y optimizan
// en tiempo de build, así que el host de Strapi tiene que estar permitido en cada
// entorno (localhost en dev, el host real en staging y prod). Escribirlo a mano
// significaría que mudar Strapi rompe el build sin que nadie sepa por qué.
//
// Acá no se puede usar `astro:env` (todavía no existe cuando se evalúa el config),
// así que se lee `process.env`, que en Vercel trae las variables del proyecto.
function strapiImagePattern() {
  const raw = process.env.STRAPI_URL ?? 'http://localhost:1337';
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `astro.config: STRAPI_URL no es una URL válida ("${raw}"). ` +
        `Esperado algo como "https://cms.finishlinebolivia.com".`,
    );
  }
  const protocol = url.protocol.replace(':', '');
  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error(`astro.config: STRAPI_URL debe ser http o https, no "${protocol}".`);
  }
  // `port: ''` no matchea nada: cuando la URL no lo lleva (443/80 implícitos) se omite.
  return { protocol, hostname: url.hostname, ...(url.port ? { port: url.port } : {}) };
}

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
    // El host sale de STRAPI_URL (ver `strapiImagePattern` arriba): un solo lugar
    // que configurar por entorno, no dos que se pueden desincronizar.
    remotePatterns: [strapiImagePattern()],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
