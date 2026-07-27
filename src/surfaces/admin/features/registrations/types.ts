// features/registrations/types.ts — shared BFF contract for
// `/api/admin/races` + `/api/admin/registrations` and the client island that
// consumes them (see `sdd/admin-dashboard`, design "Interfaces / Contracts").
// Server and client both import from here so the shape never drifts.
export interface RaceOption {
  id: string;
  label: string;
}

export interface RegistrationRow {
  id: string;
  firstNames: string;
  lastNames: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  dorsal: number | null;
  createdAt: string;
}

export type BffErrCode = 'unauthorized' | 'validation' | 'server';

export type RacesResponse = { ok: true; races: RaceOption[] } | { ok: false; code: BffErrCode; message: string };

export type RegistrationsResponse =
  | { ok: true; count: number; rows: RegistrationRow[]; truncated: boolean }
  | { ok: false; code: BffErrCode; message: string };

// Go no pagina `GET /registrations?race_id=` (design D5) — el BFF corta acá
// para nunca reenviar miles de filas al navegador. El conteo ("N inscritos",
// spec "Registrant count without denominator") sigue siendo el total real,
// derivado ANTES de aplicar el corte.
export const ROW_DISPLAY_LIMIT = 200;
