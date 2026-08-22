// features/participants/api.ts — testable seam for the Go call behind
// `/api/admin/participants` (PR1 of `sdd/admin-reportes`, design
// "Interfaces / Contracts" + "Decision: Four separate BFF routes"). Same
// shape as `features/registrations/api.ts`: raw `fetch`, defensive mapping,
// kept out of the route file so the Go-contract mapping stays testable in
// isolation once a runner lands.
import { BACKEND_URL } from 'astro:env/server';
import type { Participant, ParticipantDto, ParticipantsPage, ParticipantsPageDto } from './types';

// Same criterion as `features/registrations/api.ts` / `features/auth/api.ts`
// (`GO_TIMEOUT_MS` / `LOGIN_TIMEOUT_MS`): tolerates a full Render free-tier
// cold start (~30-50s) without hanging the browser fetch indefinitely.
const GO_TIMEOUT_MS = 45_000;

// Server-side pagination page size (spec "Server-Side Pagination"). Fixed in
// v1 — no page-size selector.
export const PAGE_SIZE = 25;

const GENDER_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino' };

export interface ListParticipantsParams {
  raceId?: string;
  page: number;
}

export type ListParticipantsResult = { ok: true; page: ParticipantsPage } | { ok: false; status: number };

// GET /participants?page=&page_size=&race_id=. `race_id` stays optional at
// this layer even though v1's UI never sets it (spec "Query-Layer Race
// Extensibility") — the aggregate roster is the only mode `ParticipantsBrowser`
// exercises today.
export async function listParticipants(
  params: ListParticipantsParams,
  accessToken: string,
): Promise<ListParticipantsResult> {
  const query = new URLSearchParams({ page: String(params.page), page_size: String(PAGE_SIZE) });
  if (params.raceId) query.set('race_id', params.raceId);

  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/participants?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GO_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  if (goRes.status !== 200) return { ok: false, status: goRes.status };

  const body = await safeJson<ParticipantsPageDto>(goRes);
  // Response is a single object, not a list (unlike races/registrations) —
  // anything that isn't a plain object is a broken contract.
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 502 };

  // Go idiomático suele serializar un slice vacío/nil como JSON `null`, no
  // `[]` — se trata como página vacía. Una fila sin `participant_id` se
  // descarta, nunca tumba el resto de la página.
  const items: Participant[] = (body.items ?? [])
    .filter((row): row is ParticipantDto & { participant_id: string } => Boolean(row.participant_id))
    .map(mapParticipant);

  return {
    ok: true,
    page: {
      items,
      total: body.total ?? 0,
      page: body.page ?? params.page,
      pageSize: body.page_size ?? PAGE_SIZE,
    },
  };
}

function mapParticipant(row: ParticipantDto): Participant {
  const gender = row.gender ?? '';
  const age = typeof row.age === 'number' && Number.isFinite(row.age) ? row.age : null;
  return {
    id: row.participant_id,
    fullName: `${row.first_names ?? ''} ${row.last_names ?? ''}`.trim(),
    email: row.email ?? '',
    phone: row.phone ?? '',
    documentId: row.document_id ?? '',
    gender,
    genderLabel: GENDER_LABEL[gender] ?? (gender || '—'),
    birthDate: row.birth_date ?? '',
    age,
    racesCount: row.races_count ?? 0,
  };
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
