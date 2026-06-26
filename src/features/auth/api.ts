import { apiFetch } from '@/shared/api/client';

/**
 * Llamadas de dominio relacionadas con autenticación.
 * Usan el cliente HTTP central (transporte) y añaden los tipos del contrato.
 */

/** Forma exacta de la respuesta del backend en un login correcto. */
export interface LoginResponse {
  access_token: string;
  token_type: string; // "Bearer"
  expires_at: string; // ISO 8601, p. ej. "2026-06-15T15:47:10.573-04:00"
}

/** Autentica contra el backend y devuelve el token. Lanza ApiError si falla. */
export function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    json: { email, password },
  });
}
