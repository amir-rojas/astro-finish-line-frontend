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
import { login } from '@admin/features/auth/api';

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
    // D3: Go answers 401 both for bad credentials and for a misconfigured
    // `X-Service-Secret` — both map to `?error=invalid` here. See
    // `features/auth/api.ts` for the full rationale and the open D3
    // follow-up (Phase 4.4).
    const emailParam = encodeURIComponent(parsed.data.email);
    return redirect(`/admin/login?error=${result.reason}&email=${emailParam}`, 303);
  }

  cookies.set('session', result.accessToken, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: new Date(result.expiresAt),
  });

  return redirect('/admin', 303);
};
