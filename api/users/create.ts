// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// Cliente admin (server-only) → ignora RLS y permite crear usuarios
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cliente “servidor con sesión del usuario” (para verificar permisos del que llama)
function supabaseFromRequest(req: VercelRequest) {
  const authHeader = req.headers.authorization || '';
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader as string } },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS básico (ajusta si usas dominio propio)
  res.setHeader('Access-Control-Allow-Origin', 'https://mirega.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = supabaseFromRequest(req);

    // 1) Verificar sesión y rol de quien llama (debe ser developer o admin)
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'No session' });

    const { data: caller, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr) return res.status(403).json({ error: 'Cannot read caller profile' });
    if (!['developer', 'admin'].includes(caller?.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }

    // 2) Leer payload recibido
    const {
      email,
      password,
      full_name,
      phone,
      role, // 'client' | 'admin' | 'technician'

      // datos opcionales para crear ficha del cliente
      building_name,
      building_admin_name,
      building_admin_email,
      building_phone,
      elevators_count,
      floors,
      elevator_type,
    } = req.body || {};

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 3) Crear usuario en Auth (confirmado)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return res.status(500).json({ error: 'auth.createUser failed', details: createErr?.message });
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

    // 5) (Opcional) Crear ficha del cliente/edificio si mandas datos
    if (role === 'client' && building_name) {
      // ⚠️ Ajusta al nombre real de tu tabla y columnas
      // Ejemplo: tabla 'clients'
      await supabaseAdmin.from('clients').insert({
        user_id: newUserId,
        name: building_name,
        admin_name: building_admin_name,
        admin_email: building_admin_email,
        phone: building_phone,
        elevators_count,
        floors,
        elevator_type,
      });
    }

    return res.status(200).json({ ok: true, user_id: newUserId });
  } catch (e: any) {
    return res.status(500).json({ error: 'Server error', details: e?.message || e });
  }
}
