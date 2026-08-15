// api/admin/participants — BFF endpoint for the participant directory on
// `/admin/participantes` (PR1 of `sdd/admin-reportes`, design "File Changes"
// + spec "admin-participants"). Same self-guard as `api/admin/races.ts` /
// `api/admin/registrations.ts` (`src/middleware.ts` only gates
// `/admin/*` page routes — `/api/admin/*` does NOT match) — the session
// cookie is re-checked HERE, before any call to Go, and `raceId`/`page` are
// zod-validated before the Go URL is composed (Threat Matrix: never forward
// an unvalidated query param).
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { listParticipants } from '@admin/features/participants/api';
import type { ParticipantsResponse } from '@admin/features/participants/types';

export const prerender = false;

const querySchema = z.object({
  raceId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

function respond(body: ParticipantsResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const sessionToken = cookies.get('session')?.value;
  if (!sessionToken) {
    return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
  }

  const parsed = querySchema.safeParse({
    raceId: url.searchParams.get('raceId') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
  });
  if (!parsed.success) {
    return respond({ ok: false, code: 'validation', message: 'Parámetros inválidos.' }, 400);
  }

  const page = parsed.data.page ?? 1;
  const result = await listParticipants({ raceId: parsed.data.raceId, page }, sessionToken);
  if (!result.ok) {
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar los participantes.' }, 502);
  }

  return respond({ ok: true, data: result.page }, 200);
};
