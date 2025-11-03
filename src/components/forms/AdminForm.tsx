import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createUser } from '@/api/users/userService';
import { Loader2 } from 'lucide-react';

interface AdminFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AdminForm({ onSuccess, onCancel }: AdminFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const result = await createUser({
        full_name: fullName,
        email,
        phone,
        password,
        role: 'Administrador',
      });

      if (result.error) {
        setErrorMsg(result.error.message || 'Error al crear administrador');
      } else {
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error('Error creando administrador:', err);
      setErrorMsg('Error inesperado al crear administrador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="space-y-2">
        <Label>Nombre Completo</Label>
        <Input
          type="text"
          placeholder="Ej. Luis Garrido Cerda"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          placeholder="Ej. usuario@mirega.cl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Teléfono</Label>
        <Input
          type="tel"
          placeholder="+56 912345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Contraseña</Label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Confirmar Contraseña</Label>
        <Input
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Crear Administrador
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
