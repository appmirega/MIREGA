// api/users/create.ts
import { createOrGetAuthUser, upsertProfile } from './userService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, password, full_name, phone, role } = req.body ?? {};

    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Faltan campos obligatorios' });
      return;
    }

    // ⚠️ Aquí podrías validar el JWT del usuario que crea (admin/developer) si quieres
    // por ahora, dejamos la validación a nivel UI/flow

    const authUser = await createOrGetAuthUser(email, password);

    await upsertProfile({
      id: authUser.id,
      email: authUser.email || email,
      full_name,
      phone: phone ?? null,
      role, // 'admin' | 'technician' | 'client' | 'developer'
    });

    res.status(200).json({
      ok: true,
      userId: authUser.id,
      message: `Usuario ${full_name} creado/actualizado`,
    });
  } catch (e: any) {
    res.status(400).json({
      ok: false,
      error: e?.message || 'Error inesperado',
    });
  }
}
