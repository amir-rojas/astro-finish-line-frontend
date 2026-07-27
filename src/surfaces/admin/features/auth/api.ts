// features/auth/api.ts — testable seam for the admin login BFF call
// (see `sdd/admin-auth-surface-migration`, design decision D1). Raw `fetch`
// to Go, no shared backend-client abstraction — mirrors
// `src/pages/api/inscripciones.ts`, the only other live BFF→Go call in this
// repo. Kept out of the route file so the Go-contract mapping is testable in
// isolation once a runner lands (design's Testing Strategy).
import { BACKEND_URL, BACKEND_SERVICE_SECRET } from 'astro:env/server';

export interface LoginCredentials {
  email: string;
  password: string;
}

export type AuthResult =
  | { ok: true; accessToken: string; expiresAt: string; refreshToken: string }
  | { ok: false; reason: 'invalid' | 'server' };

// Alias histórico: `login()` ya devolvía este nombre antes de que `refresh()`
// compartiera el mismo shape de resultado.
export type LoginResult = AuthResult;

interface GoAuthResponse {
  access_token?: string;
  token_type?: string;
  expires_at?: string;
}

// El login espera con el usuario mirando la pantalla — puede cubrir un cold
// start del free tier de Render (~30-50s) sin que se sienta roto. El refresh
// silencioso desde middleware NO: si Render está dormido, es mejor fallar
// rápido y mandar a login que colgar la carga de cada página admin.
const LOGIN_TIMEOUT_MS = 45_000;
const REFRESH_TIMEOUT_MS = 5_000;

// TTL de la cookie `refresh_token` que Astro re-emite al navegador — debe
// calzar con `REFRESH_TOKEN_TTL` de Go (default 7 días, `config.go`). No hay
// forma de leer el `Max-Age` real desde el `Set-Cookie` de Go sin parsear
// atributos además del valor, así que se fija el mismo default acá.
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// Go setea `refresh_token` como cookie httpOnly en la MISMA respuesta que el
// access token (login y refresh). Este fetch es server-to-server, así que
// nada del lado del navegador ve ese `Set-Cookie` — hay que leerlo a mano acá
// y Astro re-emite su propia cookie más arriba (`api/admin/login.ts`).
function extractRefreshToken(res: Response): string | undefined {
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie') ?? ''];

  for (const cookie of setCookies) {
    const match = /(?:^|;\s*)refresh_token=([^;]+)/.exec(cookie);
    if (match) return match[1];
  }
  return undefined;
}

// D3 (resolved, Phase 4.4): read the Go source directly —
// `internal/auth/adapters/rest/handler.go` registers `POST /auth/login`
// behind only a rate limiter, and `internal/common/config/config.go`
// documents `ServiceSecret` as scoped to `POST /api/v1/registrations` only.
// Go never checks `X-Service-Secret` on this route at all, unlike
// `inscripciones.ts`'s endpoint. So 401 here is always a genuine
// invalid-credentials response (never a secret mismatch), which is why it
// maps to `reason: 'invalid'` unconditionally. The header below is sent
// anyway, defensively, in case Go starts validating it on this route later.
export async function login({ email, password }: LoginCredentials): Promise<LoginResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // `envField.string({ optional: true })` types this as `string | undefined`;
        // fall back to `''` for `HeadersInit`. Purely a type-satisfaction fix — Go
        // doesn't validate this header on `/auth/login` (see D3 above), so an empty
        // string has no runtime effect either way.
        'X-Service-Secret': BACKEND_SERVICE_SECRET ?? '',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'server' };
  }

  return parseAuthResponse(goRes);
}

// Refresca la sesión con el refresh token opaco que Go emitió en el login
// (rotación: Go invalida el refresh usado y devuelve uno nuevo). Se llama
// server-to-server desde `src/middleware.ts` en cada request a `/admin/*`
// cuando `session` venció, así que usa un timeout corto — ver
// `REFRESH_TIMEOUT_MS` arriba.
export async function refresh(refreshToken: string): Promise<AuthResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        // La cookie del navegador nunca llega a Go directo (server-to-server) —
        // hay que reenviar el valor a mano en el header `Cookie`.
        Cookie: `refresh_token=${refreshToken}`,
      },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'server' };
  }

  return parseAuthResponse(goRes);
}

async function parseAuthResponse(goRes: Response): Promise<AuthResult> {
  if (goRes.status === 200) {
    const body = await safeJson<GoAuthResponse>(goRes);
    const refreshToken = extractRefreshToken(goRes);
    if (!body?.access_token || !body?.expires_at || !refreshToken) {
      // Go said 200 but the contract broke — never trust a partial/empty token pair.
      return { ok: false, reason: 'server' };
    }
    return { ok: true, accessToken: body.access_token, expiresAt: body.expires_at, refreshToken };
  }

  if (goRes.status === 401) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: false, reason: 'server' };
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type MeResult = { ok: true; name: string; email: string } | { ok: false };

interface GoMeResponse {
  name?: string;
  email?: string;
}

// `AdminShell.astro` la llama en el frontmatter (design D3) con try/catch
// propio — acá basta con nunca lanzar y nunca inventar un nombre: cualquier
// fallo (red, timeout, 401, contrato roto) cae a `{ok:false}` y el header
// saluda genérico. Mismo timeout corto que `refresh()`: esto corre en el
// camino crítico de CADA página admin, no puede colgar la carga si Render
// está dormido.
export async function me(accessToken: string): Promise<MeResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return { ok: false };
  }

  if (goRes.status !== 200) return { ok: false };

  const body = await safeJson<GoMeResponse>(goRes);
  if (!body?.name || !body?.email) return { ok: false };

  return { ok: true, name: body.name, email: body.email };
}

interface CookieJar {
  set(name: string, value: string, options: Record<string, unknown>): void;
}

// Único lugar que fija los atributos de `session`/`refresh_token` — los
// llama tanto `api/admin/login.ts` (login) como `middleware.ts` (rotación
// silenciosa), y ambos deben quedar idénticos.
export function setSessionCookies(
  cookies: CookieJar,
  result: { accessToken: string; expiresAt: string; refreshToken: string },
): void {
  cookies.set('session', result.accessToken, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    expires: new Date(result.expiresAt),
  });
  cookies.set('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}
