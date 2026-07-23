/**
 * backend-client.ts — BFF HTTP stub (server-only).
 *
 * Este módulo importa BACKEND_URL desde `astro:env/server`, lo que convierte
 * la importación de este módulo en un error de build si se incluye en un bundle
 * de cliente. Ese es el comportamiento deseado: todo acceso al backend pasa por
 * el servidor.
 *
 * Convención: nunca importar este módulo desde <script> ni directivas client:*.
 * Solo usar desde frontmatter .astro o rutas API con `prerender = false`.
 */
import { BACKEND_URL } from 'astro:env/server';

export interface BackendClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
}

/**
 * Crea un cliente HTTP apuntando al backend.
 * @param baseUrl — URL base; por defecto usa BACKEND_URL del env schema.
 */
export function createBackendClient(baseUrl: string = BACKEND_URL): BackendClient {
  // Intencionalmente sin implementar — no es el cliente que usa admin auth.
  // La convención BFF vigente es raw `fetch` por endpoint (ver
  // src/pages/api/inscripciones.ts y src/surfaces/admin/features/auth/api.ts):
  // un solo consumidor no justifica esta abstracción compartida (YAGNI). Este
  // stub queda como marcador de intención por si en el futuro aparecen
  // varios consumidores BFF→Go con necesidades comunes (reintentos, reenvío
  // de cookies, tipado por endpoint) que sí justifiquen generalizar.
  throw new Error(`createBackendClient not yet implemented (baseUrl: ${baseUrl})`);
}
