// features/reports/types.ts — shared BFF contract for
// `/api/admin/reports-{shirt-sizes,referral-sources,timeline}` (PR2+PR3 of
// `sdd/admin-reportes`, design "Interfaces / Contracts"). DTOs mirror Go's
// `/reports/*` responses verbatim; domain types are what the widgets
// actually render.
import type { BffResult } from '@admin/lib/bff-types';

export interface ReferralSourceDto {
  source: string;
  count: number;
}

export interface ShirtSizeDto {
  size: string;
  count: number;
}

// `label` rules (design "Interfaces / Contracts" + "Decision: `referral_source`
// displays raw, no label map"): `source` is already human-readable free text
// from the registration form's fixed `<select>` — displayed as-is, only a
// blank value falls back to `'Sin especificar'`. `size === ''` → `'Sin
// polera'`.
export interface ReferralSource {
  source: string;
  label: string;
  count: number;
}

export interface ShirtSize {
  size: string;
  label: string;
  count: number;
}

export type ReferralResponse = BffResult<ReferralSource[]>;
export type ShirtSizeResponse = BffResult<ShirtSize[]>;

// Go pre-fills gaps with `count: 0` for the fixed 14-day window (spec "Fixed
// 14-Day Timeline Window") — no domain transform needed beyond the DTO
// shape, unlike `ReferralSource`/`ShirtSize` which add a `label`.
export interface TimelinePointDto {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export type TimelinePoint = TimelinePointDto;

export type TimelineResponse = BffResult<TimelinePoint[]>;
