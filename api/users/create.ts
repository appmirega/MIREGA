import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type Role = 'admin' | 'technician' | 'client' | 'developer';

interface CreateUserBody {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role: Role;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS básico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return res.status(500).json({ success: false, error: 'Missing Supabase env vars' });
  }

  try {
    // ----- 1) Validar sesión con ANON KEY -----
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Missing bearer token' });
    }
    const accessToken = authHeader.replace('Bearer ', '');

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // ----- 2) Chequear rol en profiles -----
    const { data: currentProfile, error: profErr } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profErr || !currentProfile) {
      return res.status(403).json({ success: false, error: 'Profile not found' });
    }

    const callerRole: Role = currentProfile.role;
    if (!(callerRole === 'developer' || callerRole === 'admin')) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const body: CreateUserBody = req.body;

    if (callerRole === 'admin' && body.role === 'developer') {
      return res.status(403).json({ success: false, error: 'Admins cannot create developers' });
    }

    if (!body?.email || !body?.password || !body?.full_name || !body?.role) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    // ----- 3) Crear usuario con SERVICE ROLE -----
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        role: body.role,
        phone: body.phone || null,
      },
    });

    if (createErr) {
      // Responder con detalle explícito para depurar
      return res.status(400).json({ success: false, error: createErr.message || 'auth.createUser failed' });
    }

    // ----- 4) Insertar fila en profiles -----
    if (created?.user) {
      const { error: profInsErr } = await adminClient.from('profiles').insert({
        id: created.user.id,
        email: body.email,
        full_name: body.full_name,
        phone: body.phone || null,
        role: body.role,
        is_active: true
      });

      if (profInsErr) {
        return res.status(500).json({ success: false, error: `profiles insert failed: ${profInsErr.message}` });
      }
    }

    return res.status(200).json({
      success: true,
      user_id: created?.user?.id,
      message: `Usuario ${body.full_name} creado`
    });

  } catch (err: any) {
    // Log mínimo sin exponer secretos
    console.error('users/create error:', { msg: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
