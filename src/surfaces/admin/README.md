# Superficie: Admin

Hogar del **mundo de administración** (audiencia staff, sesión + cookie, SSR,
estilo formal). Agrupa todas sus pantallas: dashboard, inscritos, gestión de
eventos, etc. — cada una como una `feature`.

> ⚠️ El código de admin (login, auth BFF, dashboard) vive en las ramas
> `feat/admin-login-auth` / `main`. En la rama de la landing esta carpeta
> queda como marcador para fijar **dónde** va cada pantalla del admin según
> la arquitectura por superficie. Al integrar, sigue esta forma:

```
surfaces/admin/
  layouts/
    AdminLayout.astro      # chrome del panel (compone sobre shared/layouts/BaseLayout)
  features/
    auth/                  # login + sesión (BFF, cookie httpOnly)
      components/
    dashboard/             # vista principal del panel
    registrations/         # inscritos
    events/                # gestión de eventos
  components/              # reutilizable entre features del admin
```

Rutas correspondientes (thin, SSR con `export const prerender = false`) en
`src/pages/admin/`:

```
pages/admin/
  login.astro             # -> surfaces/admin/features/auth
  index.astro             # -> surfaces/admin/features/dashboard
```
