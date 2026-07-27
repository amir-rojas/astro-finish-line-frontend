// safe-block.ts — aísla el fallo de un bloque server-rendered que depende de
// Sanity (ver `sdd/admin-dashboard`, design "Technical Approach" + spec
// "Sanity block failure isolation"). Convierte una excepción en un estado
// `{ok:false}` que el `.astro` del bloque puede renderizar como
// `<BlockError>`, en vez de tumbar toda la página `/admin` — `getEvents()`
// hoy lanza (`content/events.ts`, `fetchEvents`) si Sanity no responde o el
// payload no calza con el schema.
export type SafeBlockResult<T> = { ok: true; data: T } | { ok: false };

export async function safeBlock<T>(fn: () => Promise<T>): Promise<SafeBlockResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (cause) {
    // Server-side only — nunca se filtra al HTML que ve el admin, ese
    // renderiza `<BlockError>` con un mensaje genérico.
    console.error('[admin/safe-block] block fetch failed:', cause);
    return { ok: false };
  }
}
