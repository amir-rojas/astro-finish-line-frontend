# Cómo trabajamos — entornos y flujo de despliegue

Este repo usa **tres entornos** atados al modelo de ramas. La regla de oro:
**nada llega al público sin pasar antes por staging.**

## Entornos

| Entorno | Rama | URL | Para qué |
|---|---|---|---|
| **Development** | cualquiera, local | `localhost:4321` (`pnpm dev`) | Tu día a día |
| **Preview / Staging** | `develop` | `staging.finishlinebolivia.com` | Revisión (vos + César) antes de prod |
| **Production** | `main` | `www.finishlinebolivia.com` | El público real |

Las ramas de feature **no** generan preview: Vercel las cancela vía *Ignored
Build Step*. Solo `develop` y `main` deployan. Para ver un cambio desplegado hay
que mergearlo a `develop`.

## Modelo de ramas

```
feature/* ─┐
           ▼
        develop ──► staging.finishlinebolivia.com   (revisa César)
           │
           ▼  (solo cuando está aprobado)
          main ───► www.finishlinebolivia.com        (público)
```

- `main` está **protegida**: nunca se le hace push directo, solo merge desde `develop` vía PR.
- `develop` es la rama de integración: acá se juntan los features ya terminados.
- Las ramas de trabajo salen de `develop` y vuelven a `develop`.

## Flujo diario

```bash
# 1. Partí siempre de develop al día
git checkout develop
git pull

# 2. Rama de trabajo
git checkout -b feat/lo-que-sea

# 3. Trabajás local
pnpm dev

# 4. Push (Vercel no deploya esta rama: la cancela por Ignored Build Step)
git push -u origin feat/lo-que-sea

# 5. PR feat/... → develop. Al mergear, se actualiza staging.
# 6. Cuando staging está OK y aprobado: PR develop → main = producción.
```

## Variables de entorno

Las variables se versionan **solo como plantilla** en `.env.example`. Los valores
reales viven en:

- **Local**: `.env.local` (ignorado por git — nunca se commitea).
- **Vercel**: Project Settings → Environment Variables, con scope por entorno
  (`Development` / `Preview` / `Production`).

Convención Astro/Vite: las variables expuestas al cliente **deben** llevar prefijo
`PUBLIC_` (ej. `PUBLIC_API_URL`). Sin ese prefijo quedan solo server-side.

Ejemplo de scoping pensando en el backend (`go-finish-line-backend`):

| Variable | Development | Preview (staging) | Production |
|---|---|---|---|
| `PUBLIC_API_URL` | `http://localhost:8080` | `https://api-staging.finishlinebolivia.com` | `https://api.finishlinebolivia.com` |

## Setup inicial (una sola vez, en los paneles)

Estas no se hacen desde el repo — son configuración de Vercel y GitHub:

**Vercel** (proyecto `astro-finish-line-frontend`):
1. Settings → Git → **Production Branch = `main`** (ya está así).
2. Settings → Domains → asignar **`staging.finishlinebolivia.com` a la rama `develop`**.
3. Settings → Environment Variables → cargar las variables con su scope por entorno.

**GitHub** (`amir-rojas/astro-finish-line-frontend`):
1. Settings → Branches → Branch protection rule para `main`:
   - Require a pull request before merging.
   - (Opcional) Require status checks (el deploy/preview de Vercel).
2. Mismo rule recomendado para `develop` si trabaja más de una persona.

## Contenido de carreras (Sanity) y rebuild automático

El contenido de carreras vive en Sanity Studio (`finishline.sanity.studio`), no en
este repo: `src/shared/lib/content/events.ts` lee el dataset público
(`34shscw3`/`production`) en cada build vía GROQ, con `useCdn: false` a
propósito (el CDN de Sanity tiene ~10 min de retraso tras un publish).

Como el sitio es estático (SSG), publicar en Studio **no** actualiza
`staging`/`producción` por sí solo — hace falta disparar un rebuild. Eso se
resuelve con un **webhook de Sanity apuntando a un Vercel Deploy Hook**
(configuración externa, sin código en el repo):

1. **Vercel**: Project Settings → Git → Deploy Hooks → crear un hook **solo
   para la rama `develop`**. Copiar la URL generada.
2. **Sanity Studio**: Project → API → Webhooks → crear un webhook con esa URL,
   disparado `on publish`/`on delete` del tipo `race`.

**A propósito, NO se conecta un Deploy Hook de `main`.** Que César publique
una carrera dispara el rebuild de staging, no de producción — así hay
oportunidad de revisar cómo quedó (fechas, imágenes, campos) antes de
promoverla. Pasar `develop` → `main` sigue siendo un paso manual (merge/PR),
igual que cualquier otro cambio.

Sin este webhook, un cambio publicado en Studio queda invisible en staging
hasta el próximo deploy manual.
