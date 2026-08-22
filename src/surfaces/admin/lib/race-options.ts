// lib/race-options.ts — memoized `/api/admin/races` fetch, shared across all
// report widgets on `/admin/reportes` (PR2 of `sdd/admin-reportes`, design
// "Decision: One memoized race-options fetch per page"). Zero server-only
// dependencies — safe to import directly into a browser
// `<script type="module">`, same criterion as `lib/island-state.ts`. Every
// widget on the page imports this exact module specifier, so the browser's
// ES module cache guarantees `cached` below is shared: only one
// `/api/admin/races` request fires per page load even though three widgets
// (two in this PR, the timeline in PR3) each need the option list for their
// own selector (design "Independent Per-Widget Race Filter").
export interface RaceOption {
  id: string;
  label: string;
}

export type RaceOptionsResult =
  | { ok: true; races: RaceOption[] }
  | { ok: false; code: 'unauthorized' | 'validation' | 'server'; message: string };

interface RacesResponseBody {
  ok: boolean;
  races?: RaceOption[];
  code?: 'unauthorized' | 'validation' | 'server';
  message?: string;
}

let cached: Promise<RaceOptionsResult> | null = null;

export function getRaceOptions(): Promise<RaceOptionsResult> {
  if (!cached) cached = fetchRaceOptions();
  return cached;
}

async function fetchRaceOptions(): Promise<RaceOptionsResult> {
  let res: Response;
  try {
    res = await fetch('/api/admin/races');
  } catch {
    // Permite reintentar en el próximo `getRaceOptions()` — un fallo de red
    // no debe dejar cacheado un error para siempre (design "Degrades
    // gracefully").
    cached = null;
    return { ok: false, code: 'server', message: 'No pudimos conectar con el servidor.' };
  }

  let body: RacesResponseBody;
  try {
    body = await res.json();
  } catch {
    cached = null;
    return { ok: false, code: 'server', message: 'Ocurrió un error inesperado.' };
  }

  if (!body.ok) {
    cached = null;
    return { ok: false, code: body.code ?? 'server', message: body.message ?? 'No pudimos cargar las carreras.' };
  }

  return { ok: true, races: body.races ?? [] };
}
