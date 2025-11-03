import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wrench, Search, Building2, MapPin, Calendar, QrCode } from 'lucide-react';

interface Elevator {
  id: string;
  brand: string;
  model: string;
  serial_number: string;
  location_name: string;
  capacity: number;
  installation_date: string | null;
  last_maintenance: string | null;
  status: string;
  created_at: string;
  clients: {
    company_name: string;
    address: string;
  };
}

export function ElevatorsView() {
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [filteredElevators, setFilteredElevators] = useState<Elevator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadElevators();
  }, []);

  useEffect(() => {
    filterElevators();
  }, [elevators, searchTerm, statusFilter]);

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          *,
          clients (
            company_name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterElevators = () => {
    let filtered = [...elevators];

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.clients.company_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    setFilteredElevators(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'under_observation':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operativo';
      case 'maintenance':
        return 'En Mantenimiento';
      case 'stopped':
        return 'Detenido';
      case 'under_observation':
        return 'En Observación';
      default:
        return status;
    }
  };

  const stats = {
    total: elevators.length,
    operational: elevators.filter((e) => e.status === 'operational').length,
    maintenance: elevators.filter((e) => e.status === 'maintenance').length,
    stopped: elevators.filter((e) => e.status === 'stopped').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gestión de Ascensores</h1>
        <p className="text-slate-600 mt-1">Visualiza y gestiona todos los ascensores del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Ascensores</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <Wrench className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Operativos</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.operational}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En Mantenimiento</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.maintenance}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Detenidos</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.stopped}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo, serie, ubicación o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los Estados</option>
            <option value="operational">Operativos</option>
            <option value="maintenance">En Mantenimiento</option>
            <option value="stopped">Detenidos</option>
            <option value="under_observation">En Observación</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredElevators.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No se encontraron ascensores</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredElevators.map((elevator) => (
              <div
                key={elevator.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {elevator.brand} {elevator.model}
                      </h3>
                      <p className="text-xs text-slate-500">S/N: {elevator.serial_number}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      elevator.status
                    )}`}
                  >
                    {getStatusLabel(elevator.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">{elevator.clients.company_name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>{elevator.location_name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-xs">Capacidad: {elevator.capacity} kg</span>
                  </div>

                  {elevator.installation_date && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">
                        Instalado: {new Date(elevator.installation_date).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  )}

                  {elevator.last_maintenance && (
                    <div className="border-t border-slate-100 pt-2 mt-2">
                      <p className="text-xs text-slate-500">
                        Último Mantenimiento:{' '}
                        {new Date(elevator.last_maintenance).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">ID del Ascensor</p>
                      <p className="text-xs font-mono text-slate-700">{elevator.id.slice(0, 8)}...</p>
                    </div>
                    <QrCode className="w-5 h-5 text-slate-400" />
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
