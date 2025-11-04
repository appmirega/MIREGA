// api/users/create.js
import { createClient } from '@supabase/supabase-js';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Client-Info, apikey'
  );
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // No revelamos en runtime; lo validamos cuando llega la request.
}

const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method Not Allowed' });
  }

  if (!supabaseAdmin) {
    return json(res, 500, { success: false, error: 'Supabase env vars missing.' });
  }

  try {
    const body = req.body || {};
    const { email, password, full_name, phone, role } = body;

    if (!email || !password) {
      return json(res, 400, { success: false, error: 'email y password son obligatorios' });
    }

    // 1) Intento crear usuario en Auth
    let authUserId = null;
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, phone, role },
      });
      if (error) throw error;
      authUserId = data?.user?.id || null;
    } catch (e) {
      // Si ya existe, lo recuperamos por email desde auth.users
      const already =
        String(e?.message || e?.error_description || '')
          .toLowerCase()
          .includes('already') ||
        String(e?.message || '').toLowerCase().includes('registered');

      if (!already) {
        return json(res, 500, { success: false, error: e.message || 'No se pudo crear el usuario' });
      }

      // Buscar por email en auth.users usando schema('auth')
      const { data: existing, error: qErr } = await supabaseAdmin
        .schema('auth')
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (qErr) {
        return json(res, 500, { success: false, error: qErr.message });
      }
      if (!existing?.id) {
        return json(res, 500, { success: false, error: 'No se pudo recuperar el usuario existente.' });
      }
      authUserId = existing.id;
    }

    // 2) UPSERT en profiles (idempotente)
    const profile = {
      id: authUserId,      // UUID del usuario de Auth
      email,
      full_name: full_name || null,
      phone: phone || null,
      role: role || 'technician',
      status: 'active',
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabaseAdmin
      .from('profiles')
      .upsert(profile, { onConflict: 'id' });

    if (upErr) {
      // Si llega a chocar por carrera, devolvemos 200 igual (idempotente)
      const msg = String(upErr.message || '').toLowerCase();
      const pkey = msg.includes('duplicate key') || msg.includes('pkey');
      if (!pkey) {
        return json(res, 500, { success: false, error: upErr.message });
      }
    }

    // ✅ Responder SIEMPRE JSON
    return json(res, 200, {
      success: true,
      user_id: authUserId,
      profile: { id: authUserId, email },
    });
  } catch (err) {
    return json(res, 500, { success: false, error: err?.message || 'Server error' });
  }
}
