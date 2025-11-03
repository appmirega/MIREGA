// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/** CORS muy simple para el handler */
const setCORS = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ success: false, error: 'Missing Supabase credentials' });
  }

  // Cliente con service_role (server-side)
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { email, password, full_name, phone, role } = req.body || {};
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    // 1) Crear el usuario en Auth o "recuperarlo" si ya existe
    let userId: string | null = null;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (created?.user?.id) {
      userId = created.user.id;
    } else if (createErr) {
      // Si es "ya existe", lo buscamos listando
      const msg = String(createErr.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists')) {
        let page = 1;
        const perPage = 1000;
        while (!userId) {
          const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
          if (listErr) break;
          const found = list?.users?.find((u) => (u.email || '').toLowerCase() === String(email).toLowerCase());
          if (found) userId = found.id;
          if (!list || list.users.length < perPage) break;
          page += 1;
        }
      } else {
        // Error real distinto a "ya existe"
        return res.status(400).json({ success: false, error: createErr.message || 'auth.createUser failed' });
      }
    }

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Could not resolve user id' });
    }

    // 2) UPSERT del perfil (idempotente). Muy importante: onConflict: 'id'
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          role,
          full_name,
          email,
          phone: phone || null,
          is_active: true,
        },
        {
          onConflict: 'id',       // <- fuerza ON CONFLICT (id)
          ignoreDuplicates: false,
        },
      )
      .select()
      .single();

    // Si por concurrencia igual se llega a un 23505, lo ignoramos y seguimos OK.
    if (upsertErr) {
      const code = (upsertErr as any)?.code || (upsertErr as any)?.details || '';
      const msg = String(upsertErr.message || '').toLowerCase();
      const isDup =
        String(code) === '23505' ||
        msg.includes('duplicate key value violates unique constraint') ||
        msg.includes('profiles_pkey');

      if (!isDup) {
        return res.status(400).json({ success: false, error: upsertErr.message || 'profiles upsert failed' });
      }
    }

    console.log('USERS_CREATE v5 → OK', { email, userId });
    return res.status(200).json({
      success: true,
      user_id: userId,
      message: `Usuario ${full_name} listo (creado o recuperado)`,
    });
  } catch (e: any) {
    console.error('USERS_CREATE v5 → ERROR', e);
    return res.status(400).json({ success: false, error: e?.message || 'Unknown error' });
  }
}
