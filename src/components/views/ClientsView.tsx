import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Plus, Search, Edit, Trash2, MapPin, Phone, Mail } from 'lucide-react';
import { ClientForm } from '../forms/ClientForm';

interface Client {
  id: string;
  company_name: string;
  address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  building_name: string | null;
  created_at: string;
  profile_id: string | null;
  profiles?: {
    full_name: string;
    email: string;
  };
}

type ViewMode = 'list' | 'create' | 'edit';

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(
        (c) =>
          c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClients(filtered);
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`¿Estás seguro de eliminar el cliente "${clientName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);

      if (error) throw error;
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error al eliminar el cliente. Puede que tenga registros asociados.');
    }
  };

  if (viewMode === 'create') {
    return (
      <ClientForm
        onSuccess={() => {
          setViewMode('list');
          loadClients();
        }}
        onCancel={() => setViewMode('list')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Clientes</h1>
          <p className="text-slate-600 mt-1">Administra la información de tus clientes</p>
        </div>
        <button
          onClick={() => setViewMode('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, contacto o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="text-sm text-slate-600 mb-4">
          Total de clientes: <span className="font-semibold text-slate-900">{clients.length}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No se encontraron clientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{client.company_name}</h3>
                      {client.building_name && (
                        <p className="text-xs text-slate-500">{client.building_name}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteClient(client.id, client.company_name)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>{client.address}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <p className="text-xs text-slate-500 mb-1">Contacto:</p>
                    <p className="font-medium text-slate-900">{client.contact_name}</p>
                    <div className="flex items-center gap-2 text-slate-600 mt-1">
                      <Mail className="w-3 h-3" />
                      <span className="text-xs">{client.contact_email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 mt-1">
                      <Phone className="w-3 h-3" />
                      <span className="text-xs">{client.contact_phone}</span>
                    </div>
                  </div>

                  {client.profiles && (
                    <div className="border-t border-slate-100 pt-2 mt-2">
                      <p className="text-xs text-slate-500 mb-1">Usuario Asignado:</p>
                      <p className="text-sm font-medium text-blue-600">
                        {client.profiles.full_name}
                      </p>
                      <p className="text-xs text-slate-600">{client.profiles.email}</p>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 mt-2">
                    <p className="text-xs text-slate-500">
                      Registrado: {new Date(client.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
