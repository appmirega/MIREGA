// /api/users/create.js
import { createClient } from '@supabase/supabase-js';

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, apikey');
}

function sendJSON(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') {
      return sendJSON(res, 405, { success: false, error: 'Method Not Allowed' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { email, password, full_name, phone, role } = body || {};

    if (!email || !password) {
      return sendJSON(res, 400, { success: false, error: 'Faltan campos obligatorios' });
    }

    // 1) Crear (o recuperar) usuario en Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone, role },
    });

    if (error) throw error;
    const userId = data.user.id;

    // 2) Upsert del perfil (idempotente)
    const { error: upErr } = await supabase
      .from('profiles')
      .upsert(
        { id: userId, email, full_name, phone, role, status: 'active' },
        { onConflict: 'id' }
      );

    if (upErr) throw upErr;

    return sendJSON(res, 200, { success: true, user_id: userId });
  } catch (err) {
    return sendJSON(res, 500, { success: false, error: err.message || 'Server error' });
  }
}
