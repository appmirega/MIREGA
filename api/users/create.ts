// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  // Si esto sale en logs, faltan vars en Vercel
  console.error('ENV MISSING:', { hasUrl: !!SUPABASE_URL, hasService: !!SERVICE_ROLE });
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // === 1) Leer token de forma robusta ===
    // Algunos entornos pasan 'authorization', otros 'Authorization'
    const authHeader =
      (req.headers['authorization'] as string) ||
      (req.headers['Authorization'] as string) ||
      '';

    // Logs de diagnóstico (no imprimen el token completo)
    console.log('AUTH HEADER PRESENT:', !!authHeader);

    if (!authHeader.startsWith('Bearer ')) {
      console.warn('NO BEARER PREFIX');
      return res.status(401).json({ success: false, error: 'No session token' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // === 2) Obtener usuario desde el token ===
    const { data: userResp, error: userErr } = await supabaseAdmin.auth.getUser(token);
    console.log('AUTH.GETUSER ERROR?', !!userErr, 'USER_ID:', userResp?.user?.id);

    if (userErr || !userResp?.user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const currentUserId = userResp.user.id;

    // === 3) Buscar perfil y rol en profiles ===
    const { data: currentProfile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email, full_name')
      .eq('id', currentUserId)
      .maybeSingle();

    console.log('PROFILE ERR?', !!profErr, 'PROFILE FOUND?', !!currentProfile, 'ROLE:', currentProfile?.role);

    if (profErr) {
      return res.status(500).json({ success: false, error: `DB error: ${profErr.message}` });
    }
    if (!currentProfile) {
      return res.status(403).json({ success: false, error: 'Profile not found for current user' });
    }

    // === 4) Chequear permisos del actor ===
    const actorRole = (currentProfile.role || '').toLowerCase();
    const isDeveloper = actorRole === 'developer';
    const isAdmin = actorRole === 'admin';

    // payload del nuevo usuario
    const { email, password, full_name, phone, role } = req.body || {};
    const targetRole = String(role || '').toLowerCase();

    console.log('ACTOR ROLE:', actorRole, 'TARGET ROLE:', targetRole, 'EMAIL:', email);

    // Reglas:
    // - developer: puede crear cualquier rol
    // - admin: puede crear technician / client (NO developer)
    if (!isDeveloper && !isAdmin) {
      return res.status(403).json({ success: false, error: 'User not allowed (actor has no privilege)' });
    }
    if (isAdmin && targetRole === 'developer') {
      return res.status(403).json({ success: false, error: 'Admins cannot create developers' });
    }

    if (!email || !password || !full_name || !targetRole) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    // === 5) Crear usuario auth ===
    const { data: createResp, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: targetRole },
    });

    console.log('CREATE AUTH ERROR?', !!createErr, 'NEW USER ID:', createResp?.user?.id);

    if (createErr) {
      // Errores comunes: password policy, email duplicado, etc.
      return res.status(400).json({ success: false, error: createErr.message, details: createErr });
    }

    const newUser = createResp.user!;
    // === 6) Crear perfil ===
    const { error: profInsErr } = await supabaseAdmin.from('profiles').insert({
      id: newUser.id,
      email,
      role: targetRole,
      full_name,
      phone: phone || null,
      is_active: true,
    });

    console.log('INSERT PROFILE ERROR?', !!profInsErr);

    if (profInsErr) {
      return res.status(500).json({ success: false, error: profInsErr.message });
    }

    return res.status(200).json({
      success: true,
      user: { id: newUser.id, email, full_name, role: targetRole },
    });
  } catch (err: any) {
    console.error('UNEXPECTED ERROR:', err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || 'Server error' });
  }
}
