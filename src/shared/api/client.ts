import { BACKEND_URL } from 'astro:env/server';

/**
 * Cliente HTTP central para hablar con el backend REST.
 *
 * Vive SOLO en el servidor: importa BACKEND_URL desde 'astro:env/server',
 * así que es imposible usarlo por accidente desde código de navegador.
 *
 * Centraliza en un único lugar: URL base, headers JSON, serialización del
 * body, parseo de la respuesta y normalización de errores. Cualquier feature
 * que necesite hablar con el backend pasa por aquí.
 */

/** Error de API normalizado: cualquier respuesta no-2xx se lanza como esto. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Opciones del request: las de fetch + un atajo `json` que se serializa solo. */
export type ApiRequestOptions = RequestInit & {
  /** Objeto que se convierte a JSON y se envía como body (pone Content-Type). */
  json?: unknown;
};

/**
 * Hace una petición al backend y devuelve la respuesta ya parseada.
 *
 * @param path  Ruta relativa al backend, p. ej. '/api/v1/auth/login'.
 * @throws ApiError si la respuesta no es 2xx.
 *
 * @example
 *   const data = await apiFetch<LoginResponse>('/api/v1/auth/login', {
 *     method: 'POST',
 *     json: { email, password },
 *   });
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { json, headers, body, ...rest } = options;

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      // Solo añadimos Content-Type si realmente mandamos un body JSON.
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  // Parseamos según el tipo de contenido (un 204 o un error HTML no rompen).
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data
        ? String((data as Record<string, unknown>).message)
        : `El backend respondió ${response.status} en ${path}`;
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}
