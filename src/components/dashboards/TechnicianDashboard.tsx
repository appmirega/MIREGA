import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Calendar,
  MapPin,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Clock,
  Navigation,
  Phone,
} from 'lucide-react';

interface TechnicianDashboardProps {
  onNavigate?: (path: string) => void;
}

export function TechnicianDashboard({ onNavigate }: TechnicianDashboardProps = {}) {
  const { profile } = useAuth();
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [stats, setStats] = useState({
    scheduledToday: 0,
    completed: 0,
    pending: 0,
    emergencies: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      loadTechnicianData();
    }
  }, [profile]);

  const loadTechnicianData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: schedules, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          *,
          elevators (
            id,
            internal_code,
            brand,
            model,
            location_address,
            location_building,
            location_coordinates,
            clients (
              company_name,
              contact_person,
              contact_phone
            )
          )
        `)
        .eq('assigned_technician_id', profile?.id)
        .eq('scheduled_date', today)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setTodaySchedule(schedules || []);

      const completed = schedules?.filter(s => s.status === 'completed').length || 0;
      const pending = schedules?.filter(s => s.status === 'pending').length || 0;

      const { count: emergencyCount } = await supabase
        .from('emergency_visits')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_technician_id', profile?.id)
        .in('status', ['assigned', 'in_progress']);

      setStats({
        scheduledToday: schedules?.length || 0,
        completed,
        pending,
        emergencies: emergencyCount || 0,
      });
    } catch (error) {
      console.error('Error loading technician data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (coordinates: string | null) => {
    if (coordinates) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${coordinates}`, '_blank');
    }
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Mi Ruta de Trabajo</h1>
        <p className="text-slate-600 mt-1">Agenda del día y tareas asignadas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.scheduledToday}</h3>
          <p className="text-sm text-slate-600">Programados Hoy</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.completed}</h3>
          <p className="text-sm text-slate-600">Completados</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-500 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.pending}</h3>
          <p className="text-sm text-slate-600">Pendientes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-red-500 p-3 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-1">{stats.emergencies}</h3>
          <p className="text-sm text-slate-600">Emergencias Activas</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ClipboardList className="w-6 h-6 text-slate-900" />
          <h2 className="text-xl font-bold text-slate-900">Mantenimientos del Día</h2>
        </div>

        {todaySchedule.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay mantenimientos programados para hoy</p>
            <p className="text-sm text-slate-500 mt-1">Revisa la sección de emergencias o contacta con administración</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todaySchedule.map((schedule, index) => {
              const elevator = schedule.elevators;
              const client = elevator?.clients;
              const statusColors = {
                pending: 'bg-orange-100 text-orange-800',
                in_progress: 'bg-blue-100 text-blue-800',
                completed: 'bg-green-100 text-green-800',
                cancelled: 'bg-red-100 text-red-800',
              };

              return (
                <div
                  key={schedule.id}
                  className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">
                          {client?.company_name}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {elevator?.brand} {elevator?.model} - {elevator?.internal_code}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        statusColors[schedule.status as keyof typeof statusColors]
                      }`}
                    >
                      {schedule.status === 'pending' ? 'Pendiente' :
                       schedule.status === 'in_progress' ? 'En Progreso' :
                       schedule.status === 'completed' ? 'Completado' : 'Cancelado'}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-slate-900 font-medium">
                          {elevator?.location_building}
                        </p>
                        <p className="text-sm text-slate-600">{elevator?.location_address}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-slate-900 font-medium">{client?.contact_person}</p>
                        <p className="text-sm text-slate-600">{client?.contact_phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleNavigate(elevator?.location_coordinates)}
                      className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-lg font-medium hover:bg-slate-800 transition flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-5 h-5" />
                      Navegar
                    </button>
                    <button
                      onClick={() => handleCall(client?.contact_phone)}
                      className="flex-1 bg-slate-100 text-slate-900 px-4 py-3 rounded-lg font-medium hover:bg-slate-200 transition flex items-center justify-center gap-2"
                    >
                      <Phone className="w-5 h-5" />
                      Llamar
                    </button>
                    <button className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2">
                      <ClipboardList className="w-5 h-5" />
                      Iniciar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stats.emergencies > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-red-900">Emergencias Asignadas</h2>
          </div>
          <p className="text-red-800 mb-4">
            Tienes {stats.emergencies} emergencia(s) asignada(s). Revisa la sección de emergencias para más detalles.
          </p>
          <button className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition">
            Ver Emergencias
          </button>
        </div>
      )}
    </div>
  );
}
