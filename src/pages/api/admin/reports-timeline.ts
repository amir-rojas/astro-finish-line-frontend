// api/admin/reports-timeline — BFF endpoint behind the "Inscripciones por
// día" widget on `/admin/reportes` (PR3 of `sdd/admin-reportes`, design
// "File Changes" + spec "admin-reports"). Same self-guard/shape as
// `api/admin/reports-{referral-sources,shirt-sizes}.ts`. Query schema only
// ever reads `raceId` — `days` is fixed at 14 inside
// `features/reports/api.ts` and is never read from `url.searchParams` here,
// so a client-supplied `?days=` has no effect (spec "Fixed 14-Day Timeline
// Window").
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getRegistrationsTimeline } from '@admin/features/reports/api';
import type { TimelineResponse } from '@admin/features/reports/types';

export const prerender = false;

const querySchema = z.object({ raceId: z.string().uuid().optional() });

function respond(body: TimelineResponse, status: number): Response {
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

  const result = await getRegistrationsTimeline(parsed.data.raceId, sessionToken);
  if (!result.ok) {
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar el timeline.' }, 502);
  }

  return respond({ ok: true, data: result.points }, 200);
};
