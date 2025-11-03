// api/users/userService.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
  throw new Error('Missing env SUPABASE_URL');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');
}

/**
 * Cliente ADMIN: usa la Service Role Key (solo en el backend).
 * No se refresca sesión ni se persiste (entorno serverless).
 */
export const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type Role = 'developer' | 'admin' | 'technician' | 'client';

export interface CreateUserOptions {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role: Role;

  // Datos opcionales si el rol es "client"
  building_name?: string | null;
  building_admin_name?: string | null;
  building_admin_email?: string | null;
  building_phone?: string | null;
  elevators_count?: number | null;
  floors?: number | null;
  elevator_type?: string | null;
}

/**
 * Crea usuario en Auth y asegura la fila en profiles (sin duplicar).
 * Si role === "client" y llegan datos de edificio, inserta ficha básica.
 */
export async function createUserOnSupabase(opts: CreateUserOptions) {
  // 1) Crear usuario en Auth con metadatos útiles
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: opts.email,
    password: opts.password,
    email_confirm: true,
    user_metadata: {
      full_name: opts.full_name,
      role: opts.role,
      phone: opts.phone ?? null,
    },
  });

  if (error) {
    throw new Error(`auth.createUser failed: ${error.message}`);
  }

  const newUserId = data.user?.id;
  if (!newUserId) {
    throw new Error('auth.createUser did not return a new user id');
  }

  // 2) UPSERT en profiles para evitar "duplicate key violates profiles_pkey"
  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: newUserId,
        email: opts.email,
        full_name: opts.full_name,
        phone: opts.phone ?? null,
        role: opts.role,
        is_active: true,
      },
      { onConflict: 'id' } // usa la PK "id" como conflicto
    );

  if (upsertErr) {
    throw new Error(`profiles upsert failed: ${upsertErr.message}`);
  }

  // 3) (Opcional) Si es cliente y vienen datos, crear ficha básica
  if (opts.role === 'client' && (opts.building_name || opts.elevators_count || opts.floors)) {
    const { error: clientErr } = await supabaseAdmin.from('clients').insert({
      user_id: newUserId,
      name: opts.building_name ?? null,
      admin_name: opts.building_admin_name ?? null,
      admin_email: opts.building_admin_email ?? null,
      phone: opts.building_phone ?? null,
      elevators_count: opts.elevators_count ?? null,
      floors: opts.floors ?? null,
      elevator_type: opts.elevator_type ?? null,
    });

    // No tumbamos la creación del usuario si falla lo opcional;
    // solo lo dejamos registrado en logs.
    if (clientErr) {
      console.warn('clients insert warning:', clientErr.message);
    }
  }

  return {
    user_id: newUserId,
    email: opts.email,
  };
}
