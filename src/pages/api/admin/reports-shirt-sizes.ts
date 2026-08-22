// api/admin/reports-shirt-sizes — BFF endpoint behind the "Tallas de polera"
// widget on `/admin/reportes` (PR2 of `sdd/admin-reportes`, design "File
// Changes" + spec "admin-reports"). Same self-guard/shape as
// `api/admin/reports-referral-sources.ts`.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getShirtSizes } from '@admin/features/reports/api';
import type { ShirtSizeResponse } from '@admin/features/reports/types';

export const prerender = false;

const querySchema = z.object({ raceId: z.string().uuid().optional() });

function respond(body: ShirtSizeResponse, status: number): Response {
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

  const result = await getShirtSizes(parsed.data.raceId, sessionToken);
  if (!result.ok) {
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar las tallas.' }, 502);
  }

  return respond({ ok: true, data: result.sizes }, 200);
};
