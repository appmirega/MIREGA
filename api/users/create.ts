// api/users/create.ts
/* Serverless function en Vercel que SIEMPRE responde JSON e implementa CORS.
   Crea (o recupera) el usuario en Auth y hace UPSERT del profile (idempotente).
*/

import { createClient } from '@supabase/supabase-js';

const ok = (res: any, status: number, payload: any) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const setCORS = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
};

export default async function handler(req: any, res: any) {
  setCORS(res);

  if (req.method === 'OPTIONS') return ok(res, 200, { ok: true });

  if (req.method !== 'POST') {
    return ok(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    // El body puede venir como string o como objeto
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { email, password, full_name, phone, role } = body;

    if (!email || !password || !full_name || !role) {
      return ok(res, 400, { ok: false, error: 'Faltan campos obligatorios' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_KEY =
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return ok(res, 500, { ok: false, error: 'Config de Supabase ausente en variables de entorno' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Buscar usuario por email
    let userId: string | null = null;
    const { data: existingUser, error: getErr } = await admin.auth.admin.getUserByEmail(email);
    if (getErr && getErr.message !== 'User not found') {
      return ok(res, 500, { ok: false, error: `Auth error (getUserByEmail): ${getErr.message}` });
    }

    if (existingUser?.user?.id) {
      userId = existingUser.user.id;
    } else {
      // 2) Crear usuario
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) {
        return ok(res, 500, { ok: false, error: `Auth error (createUser): ${createErr.message}` });
      }
      userId = created.user.id;
    }

    // 3) UPSERT del profile (idempotente)
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          email,
          full_name,
          phone: phone ?? null,
          role,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

    if (upsertErr) {
      // Nunca devolvemos HTML: siempre JSON
      return ok(res, 500, { ok: false, error: `DB error (upsert profiles): ${upsertErr.message}` });
    }

    // 4) Respuesta OK siempre JSON
    return ok(res, 200, { ok: true, id: userId });
  } catch (e: any) {
    // Si el body llegó malformado o cualquier otra cosa
    return ok(res, 500, { ok: false, error: `SERVER: ${e?.message || 'unknown error'}` });
  }
}
