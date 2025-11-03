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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  console.log('USERS_CREATE v4'); // <— marca para verificar despliegue

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Autenticación del solicitante
    const bearer = req.headers.authorization || '';
    const token = bearer.replace(/^Bearer\s+/i, '');
    const { data: me, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !me?.user) return res.status(401).json({ error: 'Unauthorized' });

    // 2) Verificar rol (admin o developer)
    const { data: myProfile, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', me.user.id)
      .single();
    if (profErr || !myProfile) return res.status(403).json({ error: 'Profile not found' });

    if (!['developer', 'admin'].includes(myProfile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    type Body = {
      email: string;
      password: string;
      full_name: string;
      phone?: string | null;
      role: 'admin' | 'technician' | 'client' | 'developer';
    };

    const body = req.body as Body;

    // 3) Crear usuario en Auth (o recuperar si ya existe)
    let userId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role },
    });

    if (createErr) {
      const already =
        /already|exists|registered/i.test(createErr.message || '') ||
        (createErr as any)?.status === 422 ||
        (createErr as any)?.code === 'user_already_exists';

      if (!already) {
        return res.status(400).json({ error: `auth.createUser failed: ${createErr.message}` });
      }

      const { data: byEmail, error: byEmailErr } = await admin.auth.admin.getUserByEmail(body.email);
      if (byEmailErr || !byEmail?.user) {
        return res.status(400).json({ error: `User exists but cannot fetch by email: ${byEmailErr?.message}` });
      }
      userId = byEmail.user.id;
    } else {
      userId = created?.user?.id ?? null;
    }

    if (!userId) return res.status(400).json({ error: 'Cannot determine user id' });

    // 4) Perfil: buscar primero
    const { data: existing, error: selErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (selErr) {
      // si hay política RLS rara, aun así continuamos e intentamos upsert manual
      console.log('profiles select warning:', selErr.message);
    }

    const profilePayload = {
      id: userId,
      role: body.role,
      full_name: body.full_name,
      email: body.email,
      phone: body.phone ?? null,
      is_active: true,
    };

    if (existing?.id) {
      // UPDATE idempotente
      const { error: updErr } = await admin
        .from('profiles')
        .update(profilePayload)
        .eq('id', userId);

      if (updErr) {
        return res.status(400).json({ error: `profiles update failed: ${updErr.message}` });
      }
    } else {
      // INSERT con tolerancia a carrera (ignora 23505)
      const { error: insErr } = await admin
        .from('profiles')
        .insert(profilePayload);

      if (insErr) {
        const duplicate = /duplicate key|23505|unique constraint.*profiles_pkey/i.test(insErr.message || '');
        if (!duplicate) {
          return res.status(400).json({ error: `profiles insert failed: ${insErr.message}` });
        }
        // Si fue carrera: sin drama, seguimos como éxito.
      }
    }

    return res.status(200).json({
      success: true,
      user_id: userId,
      message: 'Usuario creado/actualizado correctamente',
    });
  } catch (e: any) {
    console.error('USERS_CREATE v4 fatal:', e);
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
