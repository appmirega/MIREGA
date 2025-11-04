// /api/users/create.ts
export const config = { runtime: 'edge' };

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method Not Allowed' }, 405);
    }

    const raw = await req.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const { email, password, full_name, phone, role } = body || {};
    if (!email || !password || !full_name) {
      return json({ ok: false, error: 'Missing required fields' }, 400);
    }

    // TODO: Coloca aquí tu lógica real con Supabase (crear usuario + profiles).
    // Mientras tanto, devolvemos éxito para validar el flujo end-to-end.
    // IMPORTANTE: Cuando agregues la lógica real, mantén SIEMPRE los return json(...)
    // para que el frontend no se rompa si algo falla.
    console.log('USERS_CREATE v5', { email, role, full_name, phone });
    return json({
      ok: true,
      message: `Usuario ${full_name} (${role || 'admin'}) procesado correctamente`,
    });
  } catch (e: any) {
    console.error('USERS_CREATE v5 ERROR', e);
    return json({ ok: false, error: e?.message || 'Internal Server Error' }, 500);
  }
}
