// features/registrations/api.ts — testable seam for the two Go calls behind
// `/api/admin/races` and `/api/admin/registrations` (see `sdd/admin-dashboard`,
// design D2/D4/D5). Same pattern as `features/auth/api.ts`: raw `fetch`, no
// shared backend-client abstraction, kept out of the route files so the
// Go-contract mapping is testable in isolation once a runner lands.
//
// Go's exact `/races` and `/registrations` response DTOs were confirmed by
// reading the backend source (`go-finish-line-backend`, read-only). Both
// mappers are defensive: unknown or missing fields fall back safely instead
// of throwing, and a single malformed row never drops the rest of the list.
import { BACKEND_URL } from 'astro:env/server';
import { getEvents } from '@shared/lib/content/events';
import type { RaceOption, RegistrationRow } from './types';

// Mismo criterio de timeout que el resto de rutas BFF→Go de este surface
// (`login`/`refresh`/`me` en `features/auth/api.ts`, donde `LOGIN_TIMEOUT_MS`
// documenta cold starts reales de Render de 30-50s): estas dos llamadas
// corren server-to-server desde `/api/admin/*`, disparadas por la isla desde
// el cliente — 45s tolera un cold start completo de Render sin colgar
// indefinidamente el fetch del navegador.
const GO_TIMEOUT_MS = 45_000;

export type ListRacesResult = { ok: true; races: RaceOption[] } | { ok: false; status: number };

interface GoRace {
  race_id?: string;
  document_id?: string;
  name?: string;
  date?: string;
  capacity?: number;
}

// GET /races. Asume que Go expone el mismo `Authorization: Bearer` que
// `/users/me` (authMW, no `X-Service-Secret` — ese secreto está scopeado a
// `POST /registrations` per el design de `sdd/admin-dashboard`).
export async function listRaces(accessToken: string): Promise<ListRacesResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/races`, {
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
  const body = await safeJson<GoRace[] | null>(goRes);
  if (body !== null && !Array.isArray(body)) return { ok: false, status: 502 };
  const rawRaces = body ?? [];

  // Etiqueta de carrera (design "Interfaces / Contracts"): si el DTO de Go no
  // trae un nombre legible, se joinea contra Sanity por slug/document_id. El
  // join solo se paga (una llamada a `getEvents()`, cacheada) si al menos una
  // fila lo necesita.
  let sanityBySlug: Map<string, string> | null = null;
  const races: RaceOption[] = [];
  for (const raw of rawRaces) {
    const id = raw.race_id;
    if (!id) continue; // fila sin identidad usable — se descarta, nunca tumba el listado completo

    const readable = raw.name;
    if (readable) {
      races.push({ id, label: readable });
      continue;
    }

    const slugKey = raw.document_id ?? id;
    // Un fallo de Sanity nunca debe tumbar la lista de carreras — si
    // `getEvents()` lanza, se degrada al id/slug crudo como label.
    try {
      if (!sanityBySlug) {
        const events = await getEvents();
        sanityBySlug = new Map(events.map((event) => [event.slug, event.title]));
      }
      races.push({ id, label: sanityBySlug.get(slugKey) ?? slugKey });
    } catch {
      races.push({ id, label: slugKey });
    }
  }

  return { ok: true, races };
}

export type ListRegistrationsResult = { ok: true; rows: RegistrationRow[] } | { ok: false; status: number };

interface GoRegistration {
  registration_id?: string;
  first_names?: string;
  last_names?: string;
  email?: string;
  phone?: string;
  gender?: string;
  status?: string;
  dorsal?: number | null;
  created_at?: string;
}

// GET /registrations?race_id=. `raceId` ya pasó el guard
// `z.string().uuid()` del route handler antes de llegar acá (Threat
// Matrix, design D4) — Go exige un UUID válido (`uuid.Parse`) y devuelve 400
// para cualquier otro string.
export async function listRegistrations(raceId: string, accessToken: string): Promise<ListRegistrationsResult> {
  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/registrations?race_id=${encodeURIComponent(raceId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(GO_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 502 };
  }

  if (goRes.status !== 200) return { ok: false, status: goRes.status };

  // Go idiomático suele serializar un slice vacío/nil como JSON `null`, no
  // `[]` — se trata como lista vacía (carrera con 0 inscritos). Cualquier
  // OTRO shape no-array (objeto, string, número) sí es un contrato roto.
  const body = await safeJson<GoRegistration[] | null>(goRes);
  if (body !== null && !Array.isArray(body)) return { ok: false, status: 502 };

  const rows: RegistrationRow[] = (body ?? [])
    .filter((row): row is GoRegistration & { registration_id: string } => Boolean(row.registration_id))
    .map((row) => ({
      id: row.registration_id,
      firstNames: row.first_names ?? '',
      lastNames: row.last_names ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      gender: row.gender ?? '',
      status: row.status ?? '',
      dorsal: row.dorsal ?? null,
      createdAt: row.created_at ?? '',
    }));

  return { ok: true, rows };
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
