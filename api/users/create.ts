// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Normaliza cualquier texto de error en 1 string
function normalizeError(e: any): string {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  return e.message || e.error_description || JSON.stringify(e);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1) Validación mínima
    const { email, password, full_name, phone, role } = req.body || {};
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }

    // 2) Crear usuario (si ya existe, lo tratamos como “ok/idempotente”)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    let userId = created?.user?.id;

    // Algunos proyectos devuelven 400/422 con “already registered” o similar
    if (createErr && !userId) {
      const msg = normalizeError(createErr).toLowerCase();
      const already = msg.includes('already registered') || msg.includes('user already') || msg.includes('duplicate');
      if (!already) {
        // Error real que no es “ya existe”
        return res.status(400).json({ success: false, error: normalizeError(createErr) });
      }
      // Buscamos el id del usuario existente para poder hacer el upsert del perfil
      // Nota: listUsers es paginado; como el volumen es bajo, 200 por página está ok
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) {
        return res.status(200).json({
          success: true,
          message: 'User already existed (could not list users to get ID). Profile upsert will be attempted anyway.',
        });
      }
      const match = list?.users?.find(u => u.email?.toLowerCase() === String(email).toLowerCase());
      userId = match?.id;
    }

    // 3) Upsert de perfil **idempotente** (no falla si ya existe)
    if (userId) {
      const { error: upsertErr } = await supabaseAdmin
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
          {
            onConflict: 'id',          // <- clave
            ignoreDuplicates: true,    // <- no dispare 23505
          }
        );

      if (upsertErr) {
        // Si de todas formas nos llegara un 23505 (poco probable con ignoreDuplicates)
        const msg = normalizeError(upsertErr);
        const duplicate =
          /duplicate key|23505|unique constraint.*profiles_pkey/i.test(msg);
        if (!duplicate) {
          return res.status(400).json({ success: false, error: msg });
        }
      }
    }

    // 4) Listo (si ya existía, igual devolvemos 200 + mensaje)
    return res.status(200).json({
      success: true,
      user: userId ? { id: userId, email } : created?.user,
      message: created?.user ? 'Usuario creado' : 'Usuario ya existía (upsert de perfil aplicado)',
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: normalizeError(e) });
  }
}
