// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';

const ALLOWED_ORIGINS = new Set([
  'https://mirega.vercel.app',  // prod
  'http://localhost:5173',      // dev local (vite)
]);

function setCors(res: VercelResponse, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function resolveOrigin(req: VercelRequest) {
  const o = (req.headers.origin || req.headers.referer || '').toString().replace(/\/$/, '');
  return ALLOWED_ORIGINS.has(o) ? o : 'https://mirega.vercel.app';
}

const supabaseAdmin = (SUPABASE_URL && SERVICE_ROLE)
  ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function supabaseFromRequest(req: VercelRequest) {
  const authHeader = (req.headers.authorization || '') as string;
  return createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, resolveOrigin(req));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server not initialized. Check SUPABASE_URL / SERVICE_ROLE key.' });
  }

  try {
    const supabase = supabaseFromRequest(req);

    // 1) Validar sesión y rol del que llama
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'No session' });

    const { data: caller, error: profErr } = await supabase
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();
    if (profErr) return res.status(403).json({ error: 'Cannot read caller profile' });

    const allowed = ['developer', 'admin'];
    if (!allowed.includes(caller?.role)) {
      return res.status(403).json({ error: 'Insufficient role', details: caller?.role ?? 'unknown' });
    }

    // 2) Validación simple de payload
    const {
      email, password, full_name, phone, role,
      // datos opcionales de edificio (los dejamos listos, pero insert a clients está comentado)
      building_name, building_admin_name, building_admin_email,
      building_phone, elevators_count, floors, elevator_type,
    } = (req.body ?? {}) as Record<string, any>;

    const missing: string[] = [];
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!full_name) missing.push('full_name');
    if (!role) missing.push('role');

    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', details: missing });
    }

    if (caller.role === 'admin' && role === 'developer') {
      return res.status(403).json({ error: 'Admins cannot create developers' });
    }

    // 3) Crear usuario en Auth (confirmado)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    });
    if (createErr || !created?.user) {
      return res.status(500).json({ error: 'auth.createUser failed', details: createErr?.message || created });
    }
    const newUserId = created.user.id;

    // 4) Insertar perfil
    const { error: insertProfErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: newUserId, email, role, full_name, phone: phone ?? null, is_active: true });
    if (insertProfErr) {
      return res.status(500).json({ error: 'insert profiles failed', details: insertProfErr.message });
    }

    // 5) (Opcional) Insertar ficha del cliente (ajusta a tu tabla real 'clients')
    // if (role === 'client' && building_name) {
    //   const { error: clientErr } = await supabaseAdmin.from('clients').insert({
    //     user_id: newUserId,
    //     name: building_name,
    //     admin_name: building_admin_name,
    //     admin_email: building_admin_email,
    //     phone: building_phone,
    //     elevators_count,
    //     floors,
    //     elevator_type,
    //   });
    //   if (clientErr) return res.status(500).json({ error: 'insert clients failed', details: clientErr.message });
    // }

    // 6) (Recomendado) Registro de auditoría — ignora errores si la tabla cambia
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'create_user',
        actor_id: user.id,
        target_id: newUserId,
        details: JSON.stringify({ email, role, created_by: caller?.email || null }),
      });
    } catch { /* opcional */ }

    return res.status(200).json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return res.status(500).json({ error: 'Server error', details: e?.message || String(e) });
  }
}
