// lib/bff-types.ts — shared contract for the BFF routes introduced by this
// change (`sdd/admin-reportes`: PR1 `participants`, PR2/PR3 `reports`). Same
// error code union that already lived in `features/registrations/types.ts`
// (`BffErrCode`), which now re-exports from here so the two unions never
// drift apart (design "Decision: `BffErrCode` gets a single home").
//
// Deviation from the design draft: the error variant here DOES carry
// `message` (the design's `BffResult<T>` sketch omitted it — flagged as an
// unresolved "Open Question" in the design doc). Verified against the real,
// already-shipped convention in `api/admin/races.ts` /
// `api/admin/registrations.ts` (both on `develop`): both routes always
// return `{ok:false, code, message}`, never bare `code` — the client state
// block renders `body.message` directly. This file follows that verified
// convention, not the design's unresolved assumption.
export type BffErrCode = 'unauthorized' | 'validation' | 'server';

export type BffResult<T> = { ok: true; data: T } | { ok: false; code: BffErrCode; message: string };
