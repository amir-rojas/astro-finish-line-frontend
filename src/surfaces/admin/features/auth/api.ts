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

// D3: Go's `/api/v1/auth/login` returns 401 both for bad credentials AND for
// a misconfigured `X-Service-Secret` — unlike `inscripciones.ts`, where 401
// on that header is treated as a server misconfiguration. Here 401 is the
// EXPECTED invalid-credentials response, so it maps to `reason: 'invalid'`.
// If a misconfigured secret is ever distinguishable (e.g. Go starts
// returning 403 for that case — see design's open D3 question, validated in
// Phase 4.4), add a dedicated branch here instead of widening this one.
export async function login({ email, password }: LoginCredentials): Promise<LoginResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Secret': BACKEND_SERVICE_SECRET,
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
