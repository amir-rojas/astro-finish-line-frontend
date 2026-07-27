// api/admin/logout — BFF endpoint for the "Cerrar sesión" button on
// `/admin/configuracion` (see `sdd/admin-dashboard`, design D8 + tasks note
// "Cerrar sesión ships in v1"). Native `<form method="POST">`, same
// Post/Redirect/Get pattern as `api/admin/login.ts` — no client JS required.
//
// Unlike `/api/admin/races`/`/api/admin/registrations` (D4, PR 2), this route
// does NOT need to guard-401 on a missing `session` cookie: logging out with
// no active session is a no-op success, not an error. It still self-protects
// in the sense that it never calls Go without a token to invalidate.
import type { APIRoute } from 'astro';
import { BACKEND_URL } from 'astro:env/server';

export const prerender = false;

const LOGOUT_TIMEOUT_MS = 5_000;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const sessionToken = cookies.get('session')?.value;

  // Sin `session`, no hay nada que invalidar en Go — se salta la llamada
  // (spec: "no cookie → still clear+redirect, no Go call needed").
  if (sessionToken) {
    try {
      await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
        signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
      });
    } catch {
      // Se ignora a propósito: la respuesta de Go (éxito, error o timeout)
      // nunca bloquea el logout local. La cookie httpOnly es la única fuente
      // de verdad de la sesión en este navegador — limpiarla ACÁ es lo que
      // importa (design 4.2: "clears session+refresh_token cookies
      // regardless of Go's response").
    }
  }

  cookies.delete('session', { path: '/' });
  cookies.delete('refresh_token', { path: '/' });

  return redirect('/admin/login', 303);
};
