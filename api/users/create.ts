// api/users/create.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createUserOnSupabase } from './userService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { email, password, full_name, phone, role } = req.body;

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const result = await createUserOnSupabase({
      email,
      password,
      full_name,
      phone,
      role,
    });

    // Si el usuario ya existía y fue upsert exitosamente
    if (result?.alreadyExists) {
      return res.status(409).json({
        success: true,
        message: `El usuario ${email} ya existía y fue actualizado correctamente.`,
      });
    }

    // Creación exitosa
    return res.status(200).json({
      success: true,
      message: `Usuario ${full_name} creado correctamente.`,
      user_id: result.user_id,
    });
  } catch (error: any) {
    console.error('Error en /api/users/create:', error);

    // Manejo de error por duplicado explícito
    if (error.message?.includes('duplicate key value')) {
      return res.status(409).json({
        success: true,
        message: 'El usuario ya existe en la base de datos.',
      });
    }

    // Otros errores
    return res.status(400).json({
      success: false,
      error: error.message || 'Error inesperado al crear el usuario.',
    });
  }
}
