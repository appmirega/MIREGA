// api/users/create.ts
import { createOrGetAuthUser, upsertProfile } from './userService.js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      return res
        .status(405)
        .json({ ok: false, error: 'Método no permitido. Usa POST.' });
    }

    const { email, password, full_name, phone, role } = req.body ?? {};

    if (!email || !password || !full_name || !role) {
      return res
        .status(400)
        .json({ ok: false, error: 'Faltan campos obligatorios.' });
    }

    const authUser = await createOrGetAuthUser(email, password);

    await upsertProfile({
      id: authUser.id,
      email: authUser.email || email,
      full_name,
      phone: phone ?? null,
      role,
    });

    return res.status(200).json({
      ok: true,
      message: `Usuario ${full_name} creado correctamente`,
      userId: authUser.id,
    });
  } catch (error: any) {
    console.error('Error en create.ts:', error);

    // ⚠️ Siempre devolvemos JSON válido
    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        'Error inesperado del servidor (create.ts)',
    });
  }
}
