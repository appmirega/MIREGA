// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUserOnSupabase } from './userService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email, password, full_name, phone, role } = req.body || {};
    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const result = await createUserOnSupabase({
      email,
      password,
      full_name,
      phone: phone ?? null,
      role,
    });

    // Si el usuario ya existía lo tratamos como "éxito con 409"
    if (result.alreadyExists) {
      return res.status(409).json({
        success: true,
        code: 'USER_ALREADY_EXISTS',
        message: `El usuario ${email} ya existía y su perfil fue actualizado.`,
        user_id: result.user_id,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Usuario ${full_name} creado correctamente.`,
      user_id: result.user_id,
    });
  } catch (error: any) {
    console.error('Error en /api/users/create:', error);
    return res.status(400).json({
      success: false,
      error: error?.message ?? 'Error inesperado al crear el usuario',
    });
  }
}
