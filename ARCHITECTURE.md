# Arquitectura del proyecto — Finish Line Frontend

Proyecto **Astro-first** con **dos superficies (surfaces)** independientes que
comparten el mismo código base pero atienden a audiencias distintas, con
fronteras duras de **auth, rendering e identidad visual**:

| Superficie   | Audiencia               | Auth            | Rendering          | Estilo   |
| ------------ | ----------------------- | --------------- | ------------------ | -------- |
| **`public`** | corredores / visitantes | sin sesión      | estático / CDN     | marketing|
| **`admin`**  | organizadores / staff   | sesión + cookie | SSR (`prerender=false`) | formal   |

La división es **por superficie (audiencia)**, no por pantalla: cada surface es
un "mundo" completo con muchas pantallas. Dentro de cada surface se organiza
**por feature** (grupo de pantallas). Nunca se mezclan; lo común vive en
`src/shared/`.

> El surface `public` no es "la landing": la landing es solo una de sus
> pantallas (`features/home`). El público incluirá además eventos, inscripción,
> resultados, etc. Igual `admin` agrupa dashboard, inscritos, gestión, etc.

## Árbol

```
src/
├── pages/                          # SOLO routing (Astro file-based). Páginas THIN:
│   ├── index.astro                 #   "/"            -> public/features/home
│   ├── eventos.astro               #   "/eventos"     -> public/features/events   (futuro)
│   ├── inscripcion.astro           #   "/inscripcion" -> public/features/registration (futuro)
│   └── admin/                      #   "/admin/*"     -> surface admin (SSR)
│       ├── login.astro
│       └── index.astro
│
├── surfaces/                       # las dos superficies del producto
│   ├── public/                     # ── audiencia pública (sin sesión, estática) ──
│   │   ├── layouts/
│   │   │   └── PublicLayout.astro          # chrome público (compone sobre BaseLayout)
│   │   ├── features/               # un grupo de pantallas por feature
│   │   │   ├── home/               #   la landing (Hero, ProximoEvento, ...)
│   │   │   │   └── sections/
│   │   │   ├── events/             #   eventos por fecha            (futuro)
│   │   │   ├── registration/       #   formulario de inscripción    (futuro)
│   │   │   └── results/            #   resultados                   (futuro)
│   │   └── components/             # reutilizable entre features del público
│   │
│   └── admin/                      # ── audiencia staff (sesión/cookie, SSR) ──
│       ├── layouts/
│       │   └── AdminLayout.astro
│       ├── features/
│       │   ├── auth/               #   login + sesión (BFF, cookie httpOnly)
│       │   ├── dashboard/
│       │   ├── registrations/      #   inscritos
│       │   └── events/             #   gestión de eventos
│       └── components/
│
├── content/                        # ⚠ Content Collections (UBICACIÓN REQUERIDA por Astro).
│   └── events/                     #   vive fuera de surfaces/ a propósito (excepción
│                                   #   documentada). Datos tipados con Zod (content.config.ts).
│
├── shared/                         # CROSS-SURFACE real (usado por public Y admin)
│   ├── layouts/
│   │   └── BaseLayout.astro         # shell <html>: metas, OG/SEO, fuentes, global.css
│   ├── styles/
│   │   └── global.css               # @import "tailwindcss"
│   ├── ui/                           # primitivos de UI neutrales (Button, Input, ...)
│   └── lib/                          # helpers compartidos
│       └── server/                   # código SOLO-servidor (cliente HTTP/BFF, secretos)
│
└── assets/                         # imágenes/SVG procesados por Astro
```

## Reglas

1. **División por audiencia, luego por feature.** El surface es el "mundo"
   (`public` / `admin`); la `feature` es un grupo de pantallas dentro de él.
   Una pantalla nueva entra como feature del surface que le corresponde.
2. **Las `pages/` son delgadas.** Importan un layout y componen secciones/features.
   Cero markup de negocio. Si una página crece, mueve el contenido a `surfaces/*`.
3. **Layouts en cascada.** `BaseLayout` (shell común) ← `PublicLayout` /
   `AdminLayout` (chrome de cada superficie). Una página nunca usa `BaseLayout`
   directo; usa el layout de su superficie.
4. **`shared/` es solo para lo verdaderamente común.** Si algo es de una sola
   superficie, va dentro de esa superficie. Ante la duda, va en la superficie
   (es más fácil promover a `shared/` después que separar).
5. **Nada de imports cruzados entre superficies.** `public` no importa de
   `admin` ni viceversa. Si necesitan compartir, súbelo a `shared/`.
6. **Frontera server-only.** El código que toca el backend/secretos vive en
   `shared/lib/server/` y usa `astro:env/server` (Astro falla si ese módulo
   acaba en un bundle de cliente).

## Rendering

- **Astro 6** ya no tiene `output: 'hybrid'`. Usamos `output: 'static'`
  (sitio estático por defecto) y las rutas de `admin` optan a SSR con
  `export const prerender = false`. Cualquier ruta SSR requiere adapter
  (`@astrojs/node` en modo standalone).
- La superficie `public` queda 100% estática / cacheable en CDN.

## Alias de import (tsconfig)

Evitan rutas frágiles tipo `../../../`:

| Alias        | Apunta a                |
| ------------ | ----------------------- |
| `@shared/*`  | `src/shared/*`          |
| `@public/*`  | `src/surfaces/public/*` |
| `@admin/*`   | `src/surfaces/admin/*`  |

```astro
import BaseLayout from '@shared/layouts/BaseLayout.astro';
import Hero from '@public/features/home/sections/Hero.astro';
```

## Variables de entorno

Declaradas en `astro.config.mjs` vía `envField` (módulo virtual `astro:env`).
El proyecto NO tiene valor hardcodeado para `SESSION_SECRET` (intencionado).

| Variable         | Contexto | Acceso  | Default                  | Descripción |
| ---------------- | -------- | ------- | ------------------------ | ----------- |
| `BACKEND_URL`    | server   | public  | `http://localhost:8080`  | URL base del backend Go (solo BFF server-side) |
| `SESSION_SECRET` | server   | secret  | —                        | Secreto para firmar la cookie de sesión admin |

**Convención de importación:**

```ts
// Solo en módulos server-side (.astro frontmatter o rutas API con prerender=false)
import { BACKEND_URL } from 'astro:env/server';
import { SESSION_SECRET } from 'astro:env/server';
```

> Crea un archivo `.env.example` en la raíz del repo con estos dos valores
> comentados (ver diseño/spec). Ese archivo NO se puede generar automáticamente
> en el entorno de CI actual — créalo manualmente antes del primer `pnpm dev`.

---

## Frontera server-only

El código que accede al backend o a secretos vive en `src/shared/lib/server/` e
importa exclusivamente desde `astro:env/server`.

**Por qué es efectiva:** Astro lanza un error de build si cualquier módulo que
importe `astro:env/server` queda accesible desde un bundle de cliente. La
convención de directorio (`lib/server/`) es la señal legible; la importación del
módulo virtual es la garantía técnica.

**Límite del mecanismo:** un módulo server que NO importe `astro:env/server` ni
ninguna API server-only NO está protegido por build. Esos casos dependen de la
convención de directorio + revisión.

**Regla:** nunca importar `src/shared/lib/server/*` desde:
- Bloques `<script>` en archivos `.astro`
- Componentes con directiva `client:*`

Solo importar desde frontmatter `.astro` (ejecución server) o rutas API
(`export const prerender = false`).

---

## SEO Props en BaseLayout

`BaseLayout.astro` acepta estas props opcionales además del `title` requerido:

| Prop          | Default                                                     | Descripción |
| ------------- | ----------------------------------------------------------- | ----------- |
| `title`       | _(requerido)_                                               | Título de página; se renderiza `{title} — Finish Line` |
| `description` | `'Finish Line — inscripciones y resultados de carreras.'`  | Meta description + OG/Twitter description |
| `ogImage`     | `'/og-default.jpg'`                                         | URL de imagen Open Graph y Twitter Card |
| `ogUrl`       | `Astro.url.href`                                            | URL canónica para OG |
| `canonical`   | `Astro.url.href`                                            | `<link rel="canonical">` |

**Cadena de herencia:** `BaseLayout` ← `PublicLayout` / `AdminLayout` (futuro).
Las páginas pasan las props a su layout de superficie; el layout las reenvía a
`BaseLayout`. Una página nunca usa `BaseLayout` directamente.

**Nota sobre URLs absolutas en producción:** `Astro.url.href` resuelve al host
de dev/build (e.g. `localhost`). Para OG/canonical correctos en producción,
`site: 'https://finishlinebolivia.com'` ya está configurado; considera calcular
`new URL(Astro.url.pathname, Astro.site).href` en páginas de eventos concretas.

**Schema.org Event (guía, no implementado):** Los datos estructurados de evento
son específicos de cada página — NO van en `BaseLayout`. Emitirlos desde
`src/pages/index.astro` o un componente en `surfaces/public/features/home/`:

```astro
<script type="application/ld+json" set:html={JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Event',
  name: event.data.title,
  startDate: event.data.date.toISOString(),
  location: { '@type': 'Place', name: event.data.location },
  url: event.data.registrationUrl,
})} />
```

---

## Estrategia de testing

**Playwright-first.** Playwright NO está instalado aún; la estructura del
proyecto está lista para añadirlo. Cuando se incorpore:

- Directorio: `e2e/` en la raíz (o `src/e2e/` si se prefiere colocación).
- Enfoque: tests de integración de página completa, no unit tests de componentes
  (los componentes Astro no tienen lógica compleja de estado que justifique unit
  tests).
- Candidatos iniciales: landing pública (smoke), flujo de login admin,
  colecciones de eventos (renderizado correcto de datos).

No se usará Vitest para el frontend Astro. Si en el futuro se añaden islas
React/Svelte con lógica compleja, evaluar Vitest + Testing Library solo para
esas islas.

---

## Fuentes (nota de evolución futura)

Las fuentes actuales (Barlow + Barlow Condensed) se cargan desde Google Fonts
vía `<link>` en `BaseLayout.astro`. **Migración futura:** Astro Fonts API
(disponible desde Astro 5.x) permite servir fuentes auto-hospedadas con mejor
LCP y sin dependencia de CDN externo. La migración es una mejora de polish
(no urgente); cuando se haga, reemplazar los `<link>` de Google Fonts por la
directiva `<Font />` de `astro:font`.

---

## Estado por rama

- `feat/landing-proximo-evento` (actual): solo surface `public`. El `admin`
  queda como marcador (`surfaces/admin/README.md`).
- `feat/admin-login-auth` / `main`: contienen el código de admin (login BFF,
  panel). Al integrar, se reubica bajo `surfaces/admin/features/*` siguiendo
  este árbol (tarea aparte).
