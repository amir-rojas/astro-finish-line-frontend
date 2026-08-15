// features/reports/api.ts — testable seam for the two Go calls behind
// `/api/admin/reports-{referral-sources,shirt-sizes}` (PR2 of
// `sdd/admin-reportes`, design "Interfaces / Contracts" + "Decision: Four
// separate BFF routes"). Same shape as `features/participants/api.ts`: raw
// `fetch`, defensive mapping, kept out of the route files so the Go-contract
// mapping stays testable in isolation once a runner lands.
// `getRegistrationsTimeline` lands in PR3 — not implemented here.
import { BACKEND_URL } from 'astro:env/server';
import type { ReferralSource, ReferralSourceDto, ShirtSize, ShirtSizeDto } from './types';

// Same criterion as `features/registrations/api.ts` / `features/participants/api.ts`
// (`GO_TIMEOUT_MS`): tolerates a full Render free-tier cold start (~30-50s)
// without hanging the browser fetch indefinitely.
const GO_TIMEOUT_MS = 45_000;

export type GetReferralSourcesResult = { ok: true; sources: ReferralSource[] } | { ok: false; status: number };
export type GetShirtSizesResult = { ok: true; sizes: ShirtSize[] } | { ok: false; status: number };

// GET /reports/referral-sources?race_id=. `race_id` omitted = "all races"
// (spec "Aggregate 'All Races' Default"). `raceId` already passed the
// route handler's `z.string().uuid().optional()` guard before reaching here
// (Threat Matrix — never let an unvalidated query param reach the backend
// request).
export async function getReferralSources(
  raceId: string | undefined,
  accessToken: string,
): Promise<GetReferralSourcesResult> {
  const query = new URLSearchParams();
  if (raceId) query.set('race_id', raceId);
  const qs = query.toString();

  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/reports/referral-sources${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GO_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  if (goRes.status !== 200) return { ok: false, status: goRes.status };

  // Go idiomático suele serializar un slice vacío/nil como JSON `null`, no
  // `[]` — se trata como lista vacía. Cualquier OTRO shape no-array (objeto,
  // string, número) sí es un contrato roto.
  const body = await safeJson<ReferralSourceDto[] | null>(goRes);
  if (body !== null && !Array.isArray(body)) return { ok: false, status: 502 };

  // Server order es autoritativo (design "Ordering rule") — nunca se
  // reordena acá. Una fila malformada se descarta, nunca tumba el resto.
  const sources: ReferralSource[] = (body ?? [])
    .filter((row): row is ReferralSourceDto => typeof row?.source === 'string' && typeof row.count === 'number')
    .map((row) => ({ source: row.source, label: row.source || 'Sin especificar', count: row.count }));

  return { ok: true, sources };
}

// GET /reports/shirt-sizes?race_id=. Mismo criterio de `race_id` que arriba.
export async function getShirtSizes(raceId: string | undefined, accessToken: string): Promise<GetShirtSizesResult> {
  const query = new URLSearchParams();
  if (raceId) query.set('race_id', raceId);
  const qs = query.toString();

  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/reports/shirt-sizes${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GO_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  if (goRes.status !== 200) return { ok: false, status: goRes.status };

  const body = await safeJson<ShirtSizeDto[] | null>(goRes);
  if (body !== null && !Array.isArray(body)) return { ok: false, status: 502 };

  const rawSizes = (body ?? []).filter(
    (row): row is ShirtSizeDto => typeof row?.size === 'string' && typeof row.count === 'number',
  );

  // Server order autoritativo EXCEPTO el bucket de talla vacía, que siempre
  // se fuerza al final sin importar dónde lo puso Go (spec "Shirt-Size Empty
  // Bucket Label").
  const named = rawSizes.filter((row) => row.size !== '');
  const empty = rawSizes.filter((row) => row.size === '');
  const sizes: ShirtSize[] = [...named, ...empty].map((row) => ({
    size: row.size,
    label: row.size === '' ? 'Sin polera' : row.size,
    count: row.count,
  }));

  return { ok: true, sizes };
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
