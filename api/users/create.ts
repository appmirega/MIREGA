// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const cors = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Auth del solicitante
    const bearer = req.headers.authorization || '';
    const token = bearer.replace(/^Bearer\s+/i, '');
    const { data: meData, error: meErr } = await admin.auth.getUser(token);
    if (meErr || !meData?.user) return res.status(401).json({ error: 'Unauthorized' });

    // 2) Rol del solicitante
    const { data: myProfile, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', meData.user.id)
      .single();
    if (profErr || !myProfile) return res.status(403).json({ error: 'Profile not found' });

    const allowed = myProfile.role === 'developer' || myProfile.role === 'admin';
    if (!allowed) return res.status(403).json({ error: 'Insufficient permissions' });

    type Body = {
      email: string;
      password: string;
      full_name: string;
      phone?: string | null;
      role: 'admin' | 'technician' | 'client' | 'developer';
    };

    const body = req.body as Body;

    // 3) Crear usuario en Auth (o recuperar si ya existe)
    let newUserId: string | null = null;

    const { data: createRes, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name, role: body.role },
    });

    if (createErr) {
      // Si ya existe el usuario en Auth, lo tratamos como éxito y recuperamos su id
      const alreadyExists =
        /already|exists|registered/i.test(createErr.message || '') ||
        (createErr as any)?.status === 422 ||
        (createErr as any)?.code === 'user_already_exists';

      if (!alreadyExists) {
        return res.status(400).json({ error: `auth.createUser failed: ${createErr.message}` });
      }

      // Buscar por email
      const { data: byEmail, error: byEmailErr } = await admin.auth.admin.getUserByEmail(body.email);
      if (byEmailErr || !byEmail?.user) {
        return res.status(400).json({ error: `User exists but cannot fetch by email: ${byEmailErr?.message}` });
      }
      newUserId = byEmail.user.id;
    } else {
      newUserId = createRes?.user?.id ?? null;
    }

    if (!newUserId) return res.status(400).json({ error: 'Cannot determine user id' });

    // 4) Crear/actualizar perfil de forma IDEMPOTENTE
    //    onConflict por "id" + ignoreDuplicates para evitar el choque con profiles_pkey
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: newUserId,
          role: body.role,
          full_name: body.full_name,
          email: body.email,
          phone: body.phone ?? null,
          is_active: true,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (upsertErr) {
      // Si la BD devuelve igualmente el error de unique (por versiones antiguas),
      // lo tratamos como éxito.
      const duplicate =
        /duplicate key|23505|unique constraint.*profiles_pkey/i.test(upsertErr.message || '');
      if (!duplicate) {
        return res.status(400).json({ error: `profiles upsert failed: ${upsertErr.message}` });
      }
    }

    return res.status(200).json({
      success: true,
      user_id: newUserId,
      message: 'Usuario creado/actualizado correctamente',
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Server error' });
  }
}
