const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  setSuccess(null);

  if (formData.password !== formData.confirmPassword) {
    setError('Las contraseñas no coinciden');
    setLoading(false);
    return;
  }
  if (formData.password.length < 8) {
    setError('La contraseña debe tener al menos 8 caracteres');
    setLoading(false);
    return;
  }

  try {
    // 1) sesión actual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');

    // 2) SIEMPRE llamar a Vercel
    const resp = await fetch('/api/users/create', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone || null,
        role: 'admin',
      }),
    });

    // Leemos el body UNA sola vez
    let payload: any = null;
    try { payload = await resp.json(); } catch (_) { payload = null; }

    const duplicatePkey =
      typeof payload?.error === 'string' &&
      /duplicate key.*profiles_pkey/i.test(payload.error);

    // 3) Tratar como ÉXITO: 200, 409, o el texto clásico de duplicado
    if (resp.status === 200 || resp.status === 409 || duplicatePkey) {
      setSuccess(
        payload?.message ||
          `Administrador ${formData.full_name} listo.`
      );

      // Opción A: cerrar y volver a la lista
      if (onSuccess) {
        setTimeout(() => onSuccess(), 500);
        return;
      }

      // Opción B: limpiar para crear otro al tiro
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
      return;
    }

    // 4) Si llegó acá, es un error real
    throw new Error(payload?.error || 'No se pudo crear el administrador');
  } catch (err: any) {
    setError(err.message || 'Error al crear el administrador');
    console.error(err);
  } finally {
    setLoading(false);
  }
};
