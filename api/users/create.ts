// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers']);
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // VARIABLES DE ENTORNO (Vercel → Settings → Environment Variables)
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Missing Supabase env vars' });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ⚠️ EXTRAER TOKEN EN ENTORNO NODE
    const rawAuth =
      (req.headers.authorization as string | undefined) ||
      ((req.headers as any)['Authorization'] as string | undefined) ||
      ((req.headers as any)['authorization'] as string | undefined);

    if (!rawAuth || !rawAuth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    const token = rawAuth.slice('Bearer '.length);

    // Usuario que está creando (debe ser developer o admin)
    const { data: me, error: meErr } = await sb.auth.getUser(token);
    if (meErr || !me?.user) {
      return res.status(401).json({ error: 'Invalid session token' });
    }

    const { data: myProfile, error: profErr } = await sb
      .from('profiles')
      .select('role')
      .eq('id', me.user.id)
      .single();

    if (profErr || !myProfile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    const { email, password, full_name, phone, role } = req.body ?? {};
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Reglas de permisos
    if (!['developer', 'admin'].includes(myProfile.role)) {
      return res.status(403).json({ error: 'User not allowed' });
    }
    if (myProfile.role === 'admin' && role === 'developer') {
      return res.status(403).json({ error: 'Admins cannot create developers' });
    }

    // Crear usuario en auth
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (createErr) {
      return res.status(400).json({ error: `auth.createUser failed: ${createErr.message}` });
    }

    // Crear/insertar perfil
    const newId = created.user!.id;
    const { error: insErr } = await sb.from('profiles').insert({
      id: newId,
      email,
      role,
      full_name,
      phone: phone ?? null,
      is_active: true,
    });
    if (insErr) {
      return res.status(400).json({ error: `profiles insert failed: ${insErr.message}` });
    }

    res.setHeader('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    return res.status(200).json({ ok: true, user_id: newId });
  } catch (e: any) {
    console.error('CREATE /api/users/create error:', e);
    res.setHeader('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    return res.status(500).json({ error: e?.message ?? 'Server error' });
  }
}
