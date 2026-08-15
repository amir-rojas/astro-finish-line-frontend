// api/admin/reports-referral-sources — BFF endpoint behind the "Canal de
// adquisición" widget on `/admin/reportes` (PR2 of `sdd/admin-reportes`,
// design "File Changes" + spec "admin-reports"). Same self-guard as
// `api/admin/participants.ts` (`src/middleware.ts` only gates `/admin/*`
// page routes — `/api/admin/*` does NOT match) — the session cookie is
// re-checked HERE, before any call to Go, and `raceId` is zod-validated
// before the Go URL is composed (Threat Matrix: never forward an
// unvalidated query param).
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getReferralSources } from '@admin/features/reports/api';
import type { ReferralResponse } from '@admin/features/reports/types';

export const prerender = false;

const querySchema = z.object({ raceId: z.string().uuid().optional() });

function respond(body: ReferralResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const sessionToken = cookies.get('session')?.value;
  if (!sessionToken) {
    return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
  }

  const parsed = querySchema.safeParse({ raceId: url.searchParams.get('raceId') ?? undefined });
  if (!parsed.success) {
    return respond({ ok: false, code: 'validation', message: 'Carrera inválida.' }, 400);
  }

  const result = await getReferralSources(parsed.data.raceId, sessionToken);
  if (!result.ok) {
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar los canales de adquisición.' }, 502);
  }

  return respond({ ok: true, data: result.sources }, 200);
};
