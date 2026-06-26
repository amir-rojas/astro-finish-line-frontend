import type { APIRoute } from 'astro';
import { login } from '@/features/auth/api';
import { ApiError } from '@/shared/api/client';

// Este endpoint se ejecuta en el servidor por cada petición (no se prerenderiza).
export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // El <form> nativo envía los campos como form-data, no como JSON.
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  // Validación mínima en el servidor (nunca confíes solo en el navegador).
  if (!email || !password) {
    return redirect('/admin/login?error=missing', 303);
  }

  try {
    const { access_token, expires_at } = await login(email, password);

    // Guardamos el token en una cookie httpOnly: el JavaScript del navegador
    // NO puede leerla, lo que mitiga el robo de token vía XSS. Solo el
    // servidor de Astro la lee en cada petición.
    cookies.set('session', access_token, {
      httpOnly: true,
      secure: import.meta.env.PROD, // solo por HTTPS en producción
      sameSite: 'lax',
      path: '/',
      expires: new Date(expires_at),
    });

    // 303: tras un POST, redirige con GET (patrón Post/Redirect/Get).
    return redirect('/admin', 303);
  } catch (error) {
    // Credenciales inválidas → el backend responde 401.
    if (error instanceof ApiError && error.status === 401) {
      return redirect('/admin/login?error=invalid', 303);
    }
    // Cualquier otra cosa (backend caído, 500, red): error genérico.
    console.error('[login] error inesperado:', error);
    return redirect('/admin/login?error=server', 303);
  }
};
