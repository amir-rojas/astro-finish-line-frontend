// api/inscripciones — BFF endpoint for the native registration form
// (see `sdd/registration-form`, design decision D3). First `prerender=false`
// route in this repo: `output: 'static'` + `@astrojs/vercel()` builds every
// route as a static file UNLESS it opts out with `export const prerender =
// false`, which turns this one file into a Vercel serverless function while
// every other route stays static — confirmed against this repo's actual
// `astro.config.mjs` (no changes needed there beyond the new env var).
//
// POST only. Validation is layered (design D3):
//   1. This zod schema — shape/format, fast reject, the trust boundary.
//   2. Go's domain value objects — final authority (documentid.go, phone.go,
//      gender.go, birthdate.go, participant.go).
// The BFF never trusts the client past the schema, and never re-implements
// Go's business rules — it only maps names/shapes and normalizes the
// response so the client never has to branch on Go's HTTP status directly.
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { BACKEND_URL, BACKEND_SERVICE_SECRET } from 'astro:env/server';

export const prerender = false;

const requestSchema = z.object({
  raceSlug: z.string().trim().min(1),
  fullName: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
  // YYYY-MM-DD — same layout Go's handler parses with `time.Parse(dateLayout, ...)`.
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be YYYY-MM-DD'),
  email: z.string().trim().email(),
  // Full E.164-ish phone, "+591" already composed client-side — Go's
  // NormalizePhone accepts an optional leading "+" then 7-15 digits.
  phone: z.string().trim().min(1),
  gender: z.enum(['M', 'F', 'X']),
  // Debe llegar exactamente `true` — un checkbox sin marcar nunca aparece en
  // el FormData, así que esto también cubre "campo ausente".
  acceptsRules: z.literal(true),
  // Display-only, no re-validado acá (mismo criterio que el dominio Go:
  // ver registration.go — modalidad no tiene invariante propia).
  modalidad: z.string().trim().optional().default(''),
});

type BffOk = {
  ok: true;
  status?: string;
  dorsal: number | null;
  firstNames?: string;
};
type BffErrCode = 'conflict' | 'validation' | 'not_found' | 'server';
type BffErr = { ok: false; code: BffErrCode; message: string };

function respond(body: BffOk | BffErr, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Bolivian names are commonly "Nombre1 Nombre2 Apellido1 Apellido2" — Go
// requires both FirstNames and LastNames non-empty, but the form (mockup +
// spec) collects ONE "Nombres y apellidos" field. Naive split: first token is
// the first name, the rest is the last name. A single-token name (rare, but
// the client only blocks on < 2 words, not exactly 2) falls back to reusing
// the same token for both, so Go's required-field check still passes instead
// of surfacing a confusing 400 for something the client already accepted.
function splitFullName(fullName: string): { firstNames: string; lastNames: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    const only = parts[0] ?? fullName.trim();
    return { firstNames: only, lastNames: only };
  }
  return { firstNames: parts[0], lastNames: parts.slice(1).join(' ') };
}

interface GoRegistrationResponse {
  status?: string;
  dorsal?: number | null;
  first_names?: string;
}
interface GoErrorResponse {
  error?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return respond({ ok: false, code: 'validation', message: 'La solicitud no tiene un formato válido.' }, 400);
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return respond({ ok: false, code: 'validation', message: 'Revisa los datos del formulario e intenta de nuevo.' }, 400);
  }

  const { raceSlug, fullName, documentId, birthDate, email, phone, gender, modalidad } = parsed.data;
  const { firstNames, lastNames } = splitFullName(fullName);

  let goRes: Response;
  try {
    goRes = await fetch(`${BACKEND_URL}/api/v1/registrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Secreto server-only (astro:env/server, access: 'secret') — nunca
        // llega al cliente. Debe ser idéntico al SERVICE_SECRET de Go
        // (internal/common/config/config.go) o Go responde 401 antes de
        // tocar el dominio (ver Unit E, sdd/registration-form/apply-progress).
        'X-Service-Secret': BACKEND_SERVICE_SECRET,
      },
      body: JSON.stringify({
        race_document_id: raceSlug,
        first_names: firstNames,
        last_names: lastNames,
        document_id: documentId,
        email,
        phone,
        birth_date: birthDate,
        gender,
        // v1 solo tiene un canal de inscripción (este formulario) — sin
        // selector de referido todavía (ver design D3).
        referral_source: 'sitio_web',
        modalidad,
      }),
    });
  } catch {
    return respond(
      { ok: false, code: 'server', message: 'No pudimos conectar con el servidor. Intenta de nuevo en unos minutos.' },
      502,
    );
  }

  if (goRes.status === 201) {
    const goBody = (await safeJson<GoRegistrationResponse>(goRes)) ?? {};
    return respond(
      {
        ok: true,
        status: goBody.status,
        dorsal: goBody.dorsal ?? null,
        firstNames: goBody.first_names ?? firstNames,
      },
      201,
    );
  }

  if (goRes.status === 409) {
    return respond({ ok: false, code: 'conflict', message: 'Ya estás inscrito en esta carrera con este correo.' }, 409);
  }

  if (goRes.status === 404) {
    // Slug sin sincronizar (el webhook de Sanity todavía no corrió, o la
    // carrera no existe en Go) — ver Manual E2E Checklist del diseño.
    return respond(
      {
        ok: false,
        code: 'not_found',
        message: 'No encontramos esta carrera. Es posible que las inscripciones todavía no estén habilitadas.',
      },
      404,
    );
  }

  if (goRes.status === 400) {
    const goBody = await safeJson<GoErrorResponse>(goRes);
    return respond(
      { ok: false, code: 'validation', message: goBody?.error ?? 'Revisa los datos del formulario e intenta de nuevo.' },
      400,
    );
  }

  if (goRes.status === 401) {
    // Nunca debería pasar en un entorno bien configurado: significa que
    // BACKEND_SERVICE_SECRET no coincide con el SERVICE_SECRET de Go. Es un
    // error de configuración del servidor, no algo que explicarle a quien se
    // está inscribiendo — se registra server-side y se responde genérico.
    console.error('[api/inscripciones] Go rejected X-Service-Secret (401) — BACKEND_SERVICE_SECRET misconfigured?');
    return respond({ ok: false, code: 'server', message: 'Ocurrió un error inesperado. Intenta de nuevo en unos minutos.' }, 500);
  }

  return respond({ ok: false, code: 'server', message: 'Ocurrió un error inesperado. Intenta de nuevo en unos minutos.' }, 502);
};

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
