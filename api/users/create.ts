// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const setCORS = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Autenticar llamador y verificar rol
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, error: 'No auth token' });

    const { data: me, error: meErr } = await supabase.auth.getUser(token);
    if (meErr || !me.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', me.user.id)
      .single();

    if (!callerProfile) return res.status(403).json({ success: false, error: 'Profile not found' });
    if (callerProfile.role !== 'developer' && callerProfile.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    // Un admin no crea developers
    if (callerProfile.role === 'admin' && req.body?.role === 'developer') {
      return res.status(403).json({ success: false, error: 'Admins cannot create developers' });
    }

    // 2) Datos de entrada
    const { email, password, full_name, phone, role } = req.body || {};
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    // 3) Crear el usuario en Auth (o “recuperarlo” si ya existe)
    let userId: string | null = null;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (created?.user?.id) {
      userId = created.user.id;
    } else {
      // Si ya existe, evitamos fallar: buscamos por email en Auth para obtener su id
      if (createErr && typeof createErr.message === 'string' && createErr.message.toLowerCase().includes('already')) {
        // Buscar entre usuarios (paginado básico)
        let page = 1;
        const perPage = 1000;
        while (!userId) {
          const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage });
          if (listErr) break;
          const found = list?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
          if (found) userId = found.id;
          if (!list || list.users.length < perPage) break;
          page += 1;
        }
      } else if (createErr) {
        // Error real distinto a "ya existe"
        return res.status(400).json({ success: false, error: createErr.message || 'auth.createUser failed' });
      }
    }

    if (!userId) {
      // Si no pudimos obtener id, abortamos
      return res.status(400).json({ success: false, error: 'Could not resolve user id' });
    }

    // 4) UPSERT del perfil (idempotente)
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
        { onConflict: 'id', ignoreDuplicates: true }
      );

    // Si hubo error distinto a duplicado (23505) lo reportamos; con ignoreDuplicates no debería suceder,
    // pero lo dejamos defensivo.
    if (upsertErr && (upsertErr as any).code !== '23505') {
      return res.status(400).json({ success: false, error: upsertErr.message });
    }

    // 5) OK siempre que llegamos aquí (creado o ya existente)
    console.log('USERS_CREATE v4 → OK', { email, userId });
    return res.status(200).json({
      success: true,
      user_id: userId,
      message: `Usuario ${full_name} listo (creado o recuperado)`,
    });
  } catch (e: any) {
    console.error('USERS_CREATE v4 → ERROR', e);
    return res.status(400).json({ success: false, error: e?.message || 'Unknown error' });
  }
}
