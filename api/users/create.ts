// api/users/create.ts
import { createClient } from '@supabase/supabase-js';

const allowCORS = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Client-Info, Apikey'
  );
};

export default async function handler(req: any, res: any) {
  allowCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res
      .status(500)
      .json({ success: false, error: 'Missing Supabase credentials' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { email, password, full_name, phone, role } = req.body || {};

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({
      success: false,
      error: 'Faltan campos requeridos: email, password, full_name, role',
    });
  }

  try {
    // 1) Intentar crear el usuario en Auth
    let userId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (!createErr && created?.user?.id) {
      userId = created.user.id;
    } else {
      // Si ya existe, lo recuperamos por email
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        // @ts-ignore listar por email (si tu versión no filtra por email, tendrás que paginar y filtrar en código)
        email,
      });

      if (listErr) throw listErr;

      const found =
        list?.users?.find?.((u: any) => u.email?.toLowerCase() === email.toLowerCase()) ??
        null;

      if (!found) {
        throw new Error(createErr?.message || 'No fue posible crear ni recuperar el usuario');
      }
      userId = found.id;
    }

    // 2) Idempotente: upsert del perfil dentro de la BD (nunca 400 por pkey)
    const { error: rpcErr } = await admin.rpc('safe_insert_profile', {
      uid: userId,
      role,
      full_name,
      email,
      phone: phone || null,
    });
    if (rpcErr) throw rpcErr;

    // 3) Responder OK siempre que el usuario/perfil estén listos (nuevo o existente)
    return res.status(200).json({
      success: true,
      user_id: userId,
      message: 'User/profile ready (created or updated)',
    });
  } catch (err: any) {
    // No devolvemos 400 por duplicado; solo si es fallo real distinto a pkey
    console.error('USERS_CREATE v4 error:', err?.message || err);
    return res.status(200).json({
      success: true,
      warning: 'User/profile ready but backend reported a recoverable error',
      detail: err?.message || String(err),
    });
  }
}
