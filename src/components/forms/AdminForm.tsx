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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');

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

    // Intentamos leer JSON, si no, texto
    let body: any = null;
    let raw = '';
    try { body = await resp.json(); } catch (_) {
      try { raw = await resp.text(); } catch { raw = ''; }
    }

    const errText =
      (typeof body?.error === 'string' ? body.error : '') + ' ' + raw;
    const looksDuplicate =
      /duplicate key|23505|unique constraint.*profiles_pkey/i.test(errText);

    if (resp.ok || looksDuplicate) {
      setSuccess(
        body?.message || `Administrador ${formData.full_name} creado/actualizado.`
      );

      if (onSuccess) {
        setTimeout(() => onSuccess(), 400);
        return;
      }

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
      return;
    }

    // Error real
    throw new Error(body?.error || raw || 'No se pudo crear el administrador');
  } catch (err: any) {
    setError(err.message || 'Error al crear el administrador');
    console.error(err);
  } finally {
    setLoading(false);
  }
};
