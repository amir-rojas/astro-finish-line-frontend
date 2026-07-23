// src/middleware.ts — gate de sesión para `/admin/*`.
//
// Reemplaza el chequeo inline que tenía `pages/admin/index.astro` (solo
// `Astro.cookies.has('session')`, sin intento de refresh — limitación ya
// documentada ahí). Acá, si `session` venció pero hay `refresh_token`,
// se intenta una rotación silenciosa contra Go antes de mandar a login.
import { defineMiddleware } from 'astro:middleware';
import { refresh, setSessionCookies } from '@admin/features/auth/api';

const LOGIN_PATH = '/admin/login';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;

  if (!url.pathname.startsWith('/admin') || url.pathname === LOGIN_PATH) {
    return next();
  }

  if (cookies.has('session')) {
    return next();
  }

  const refreshToken = cookies.get('refresh_token')?.value;
  if (!refreshToken) {
    return redirect(LOGIN_PATH);
  }

  // Timeout corto (ver `REFRESH_TIMEOUT_MS` en `features/auth/api.ts`): si
  // Render está dormido, esto falla rápido en vez de colgar la carga de la
  // página — el usuario cae a login como si el refresh no existiera.
  const result = await refresh(refreshToken);
  if (!result.ok) {
    cookies.delete('session', { path: '/' });
    cookies.delete('refresh_token', { path: '/' });
    return redirect(LOGIN_PATH);
  }

  setSessionCookies(cookies, result);
  return next();
});
