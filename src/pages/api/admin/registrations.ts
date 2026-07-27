// api/admin/registrations — BFF endpoint for the registrant list on
// `/admin/inscripciones` (see `sdd/admin-dashboard`, design D4/D5, tasks
// Phase 2). Same self-guard as `api/admin/races.ts` (D4: `/api/admin/*` is
// outside `src/middleware.ts`'s gate). `raceId` must be a strict UUID — Go's
// `/registrations` handler does `uuid.Parse` and returns 400 for anything
// else, so this is `race_id`, not `document_id`/slug (that one is a free
// string but isn't what's used here) — validated BEFORE composing the Go URL
// (Threat Matrix — never let an unvalidated query param reach the backend
// request; `encodeURIComponent` at the call site is defense in depth).
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { listRegistrations } from '@admin/features/registrations/api';
import { ROW_DISPLAY_LIMIT } from '@admin/features/registrations/types';
import type { RegistrationsResponse } from '@admin/features/registrations/types';

export const prerender = false;

const querySchema = z.object({ raceId: z.string().uuid() });

function respond(body: RegistrationsResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const sessionToken = cookies.get('session')?.value;
  if (!sessionToken) {
    return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
  }

  const parsed = querySchema.safeParse({ raceId: url.searchParams.get('raceId') });
  if (!parsed.success) {
    return respond({ ok: false, code: 'validation', message: 'Carrera inválida.' }, 400);
  }

  const result = await listRegistrations(parsed.data.raceId, sessionToken);
  if (!result.ok) {
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar los inscritos.' }, 502);
  }

  // Conteo derivado server-side ANTES del corte (design D5) — el navegador
  // nunca recibe más de `ROW_DISPLAY_LIMIT` filas, pero `count` sigue siendo
  // el total real (spec "Registrant count without denominator").
  const count = result.rows.length;
  const truncated = count > ROW_DISPLAY_LIMIT;
  const rows = truncated ? result.rows.slice(0, ROW_DISPLAY_LIMIT) : result.rows;

  return respond({ ok: true, count, rows, truncated }, 200);
};
