// features/participants/types.ts — shared BFF contract for
// `/api/admin/participants` and `ParticipantsBrowser.astro` (PR1 of
// `sdd/admin-reportes`, design "Interfaces / Contracts"). DTOs mirror Go's
// `/participants` response verbatim; domain types are what the table
// actually renders.
import type { BffResult } from '@admin/lib/bff-types';

export interface ParticipantDto {
  participant_id: string;
  first_names: string;
  last_names: string;
  email: string;
  phone: string;
  document_id: string;
  gender: string;
  birth_date: string;
  age: number;
  races_count: number;
}

export interface ParticipantsPageDto {
  items: ParticipantDto[] | null;
  total: number;
  page: number;
  page_size: number;
}

export interface Participant {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  documentId: string;
  gender: string;
  genderLabel: string;
  birthDate: string;
  age: number | null;
  racesCount: number;
}

export interface ParticipantsPage {
  items: Participant[];
  total: number;
  page: number;
  pageSize: number;
}

export type ParticipantsResponse = BffResult<ParticipantsPage>;
