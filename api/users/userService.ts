// api/users/userService.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno (Vercel).');
}

export const adminClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Role = 'admin' | 'technician' | 'client' | 'developer';

export interface CreatedAuthUser {
  id: string;
  email: string | null;
}

export async function createOrGetAuthUser(email: string, password: string): Promise<CreatedAuthUser> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Opción simple: propagar error (el front mostrára "ya existe" si se da el caso)
    throw error;
  }

  if (!data || !data.user) {
    throw new Error('Supabase no devolvió el usuario creado.');
  }

  return { id: data.user.id, email: data.user.email ?? email };
}

export async function upsertProfile(input: {
  id: string;
  email: string | null;
  full_name: string;
  phone?: string | null;
  role: Role;
}) {
  const { id, email, full_name, phone, role } = input;

  const { error } = await adminClient
    .from('profiles')
    .upsert(
      {
        id,
        email: email ?? '',
        full_name,
        phone: phone ?? null,
        role,
        is_active: true,
      },
      { onConflict: 'id' } // ⚙️ importante: evita duplicados
    );

  if (error) throw error;
}
