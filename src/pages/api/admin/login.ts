// api/admin/login — BFF endpoint for the native admin login form
// (see `sdd/admin-auth-surface-migration`). Mirrors the structure of
// `src/pages/api/inscripciones.ts`: `output: 'static'` + `@astrojs/vercel()`
// builds every route as static UNLESS it opts out with
// `export const prerender = false`, which is what turns this file into a
// Vercel serverless function.
//
// Unlike inscripciones (JSON body, JSON response), this route is consumed by
// a native `<form method="POST">` — no client JS required to submit — so it
// reads `request.formData()` and always responds with a
// Post/Redirect/Get 303, never JSON.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { login, setSessionCookies } from '@admin/features/auth/api';

export const prerender = false;

const formSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().trim().min(1),
});

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirect('/admin/login?error=missing', 303);
  }

  const parsed = formSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    // Missing/empty email or password never reaches the backend — spec
    // "Missing Required Fields Are Rejected Server-Side". `parsed.data`
    // doesn't exist on this branch (zod parse failed), so read the raw
    // form value directly to repopulate the email field on redirect —
    // never the password.
    const rawEmail = formData.get('email');
    const emailParam = typeof rawEmail === 'string' && rawEmail ? `&email=${encodeURIComponent(rawEmail)}` : '';
    return redirect(`/admin/login?error=missing${emailParam}`, 303);
  }

  const result = await login(parsed.data);

  if (!result.ok) {
    // D3 (resolved, Phase 4.4): Go's 401 here is always genuine invalid
    // credentials, never a misconfigured `X-Service-Secret` (Go doesn't
    // check that header on this route) — see `features/auth/api.ts`.
    const emailParam = encodeURIComponent(parsed.data.email);
    return redirect(`/admin/login?error=${result.reason}&email=${emailParam}`, 303);
  }

  // Astro re-emite sus propias cookies al navegador — nunca reenvía el
  // `Set-Cookie` crudo de Go (esa cookie de Go nunca sale de la llamada
  // server-to-server en `features/auth/api.ts`).
  setSessionCookies(cookies, result);

  return redirect('/admin', 303);
};
