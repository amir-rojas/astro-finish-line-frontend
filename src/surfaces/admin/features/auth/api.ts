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

export type LoginResult =
  | { ok: true; accessToken: string; expiresAt: string }
  | { ok: false; reason: 'invalid' | 'server' };

interface GoLoginResponse {
  access_token?: string;
  token_type?: string;
  expires_at?: string;
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
    });
  } catch {
    return { ok: false, reason: 'server' };
  }

  if (goRes.status === 200) {
    const body = await safeJson<GoLoginResponse>(goRes);
    if (!body?.access_token || !body?.expires_at) {
      // Go said 200 but the contract broke — never trust an empty token.
      return { ok: false, reason: 'server' };
    }
    return { ok: true, accessToken: body.access_token, expiresAt: body.expires_at };
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
