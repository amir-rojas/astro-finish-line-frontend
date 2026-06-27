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
  // TODO(admin integration): implementar fetch wrapper real con
  //   - reenvío de cookies de sesión
  //   - manejo de errores y reintentos
  //   - tipado de respuestas por endpoint
  throw new Error(`createBackendClient not yet implemented (baseUrl: ${baseUrl})`);
}
