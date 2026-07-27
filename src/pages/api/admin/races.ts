// api/admin/races — BFF endpoint for the race selector on
// `/admin/inscripciones` (see `sdd/admin-dashboard`, design D4, tasks Phase
// 2). `src/middleware.ts` only gates `url.pathname.startsWith('/admin')`
// (page routes) — `/api/admin/*` does NOT match, same finding already
// documented for `/api/admin/login`. Without its own guard this would be an
// open proxy to Go: cookie presence is checked HERE, before any fetch to Go.
import type { APIRoute } from 'astro';
import { listRaces } from '@admin/features/registrations/api';
import type { RacesResponse } from '@admin/features/registrations/types';

export const prerender = false;

function respond(body: RacesResponse, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const GET: APIRoute = async ({ cookies }) => {
  const sessionToken = cookies.get('session')?.value;
  if (!sessionToken) {
    return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
  }

  const result = await listRaces(sessionToken);
  if (!result.ok) {
    // Go respondiendo 401 con una cookie basura/vencida también cae acá
    // (nunca se reenvía el cuerpo crudo de Go).
    if (result.status === 401) {
      return respond({ ok: false, code: 'unauthorized', message: 'Tu sesión expiró.' }, 401);
    }
    return respond({ ok: false, code: 'server', message: 'No pudimos cargar las carreras.' }, 502);
  }

  return respond({ ok: true, races: result.races }, 200);
};
