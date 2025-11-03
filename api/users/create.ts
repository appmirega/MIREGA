// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';

// Guardas tempranos: si falta algo, dilo explícito
function missingEnv() {
  const miss: string[] = [];
  if (!SUPABASE_URL) miss.push('SUPABASE_URL');
  if (!SERVICE_ROLE) miss.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!ANON_KEY)     miss.push('SUPABASE_ANON_KEY');
  return miss;
}

// Admin client (bypasa RLS) — SOLO servidor
const supabaseAdmin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Cliente server → usa token del usuario para validar rol
function supabaseFromRequest(req: VercelRequest) {
  const authHeader = req.headers.authorization || '';
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader as string } },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (temporal: abierto para diagnosticar)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 0) Chequea envs
  const miss = missingEnv();
  if (miss.length) {
    return res.status(500).json({ error: 'Missing environment variables', details: miss });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Admin client not initialized' });
  }

  try {
    const supabase = supabaseFromRequest(req);

    // 1) Verificar sesión y rol
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr) return res.status(401).json({ error: 'No session (getUser error)', details: userErr.message });
    if (!user)   return res.status(401).json({ error: 'No session' });

    const { data: caller, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr) return res.status(403).json({ error: 'Cannot read caller profile', details: profErr.message });
    if (!caller?.role || !['developer', 'admin'].includes(caller.role)) {
      return res.status(403).json({ error: 'Insufficient role', details: caller?.role ?? 'unknown' });
    }

    // 2) Payload
    const {
      email, password, full_name, phone, role,
      // (por ahora ignoramos la ficha del cliente para descartar errores)
      // building_name, building_admin_name, building_admin_email,
      // building_phone, elevators_count, floors, elevator_type,
    } = (req.body ?? {}) as Record<string, any>;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields', details: ['email','password','full_name','role'] });
    }

    // 3) Crear usuario en Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return res.status(500).json({ error: 'auth.createUser failed', details: createErr?.message || created });
    }
    const newUserId = created.user.id;

    // 4) Insertar perfil
    const { error: insertProfErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        email,
        role,
        full_name,
        phone,
        is_active: true,
      });

    if (insertProfErr) {
      return res.status(500).json({ error: 'insert profiles failed', details: insertProfErr.message });
    }

    // 5) (Temporalmente desactivado para aislar el problema de base)
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
    //   if (clientErr) {
    //     return res.status(500).json({ error: 'insert clients failed', details: clientErr.message });
    //   }
    // }

    return res.status(200).json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return res.status(500).json({ error: 'Server error (catch)', details: e?.message || String(e) });
  }
}
