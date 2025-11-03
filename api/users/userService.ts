// api/users/userService.ts
import { createClient } from '@supabase/supabase-js';

type CreateUserInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role: 'admin' | 'technician' | 'client' | 'developer';
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export async function createUserOnSupabase(input: CreateUserInput) {
  const { email, password, full_name, phone, role } = input;

  // 1) Crear usuario en Auth (o detectar si ya existe)
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, phone },
  });

  // Si ya existía el correo, seguimos con flujo de "upsert" de profiles
  const emailAlreadyExists =
    !!createErr &&
    typeof createErr.message === 'string' &&
    /already.*registered|exists/i.test(createErr.message);

  let userId = created?.user?.id as string | undefined;
  let alreadyExists = false;

  if (createErr && !emailAlreadyExists) {
    throw createErr;
  }

  if (!userId) {
    // Buscar el userId del correo (si el usuario ya existía)
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profileByEmail?.id) {
      userId = profileByEmail.id;
    } else {
      // Último recurso: buscar en auth (puede paginar; aquí asumimos pocos usuarios)
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const match = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!match) throw new Error('No se pudo resolver el ID del usuario existente.');
      userId = match.id;
    }
    alreadyExists = true;
  }

  // 2) UPSERT en profiles (si existe, actualiza; si no, inserta)
  //    clave de conflicto: id
  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name,
        phone: phone || null,
        role,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (upsertErr) {
    // Si por algún motivo chocó por unique de email, hacemos un segundo upsert
    // para no fallar la operación (muy raro, pero defensivo).
    const conflictOnEmail =
      typeof upsertErr.message === 'string' &&
      /duplicate key.*email|unique.*email/i.test(upsertErr.message);

    if (!conflictOnEmail) throw upsertErr;
  }

  return { user_id: userId, alreadyExists };
}
