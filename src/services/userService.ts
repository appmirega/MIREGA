import { supabase } from '@/lib/supabase';

export type CreateUserPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: 'admin' | 'technician' | 'client' | 'developer';
  // Si para clientes incluyes datos del edificio, agrégalos aquí:
  // building_name?: string;
  // building_admin_name?: string;
  // building_admin_email?: string;
  // building_phone?: string;
  // elevators_count?: number;
  // floors?: number;
  // elevator_type?: string;
};

export async function createUserViaApi(payload: CreateUserPayload) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  const resp = await fetch('/api/users/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await resp.json();
  if (!resp.ok) {
    console.error('Create user failed:', json);
    throw new Error(json?.error || json?.details || 'Server configuration error');
  }
  return json; // { ok: true, user_id: '...' }
}
