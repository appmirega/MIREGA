import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Building2,
  Wrench,
  AlertTriangle,
  TrendingUp,
  Activity,
  Database,
  Shield,
  UserPlus,
  BookOpen,
} from 'lucide-react';
import { AdminForm } from '../forms/AdminForm';

interface Stats {
  totalUsers: number;
  totalClients: number;
  totalElevators: number;
  activeEmergencies: number;
  pendingMaintenance: number;
  completedToday: number;
}

interface DeveloperDashboardProps {
  onNavigate?: (path: string) => void;
}

export function DeveloperDashboard({ onNavigate }: DeveloperDashboardProps = {}) {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalClients: 0,
    totalElevators: 0,
    activeEmergencies: 0,
    pendingMaintenance: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [users, clients, elevators, emergencies, maintenance] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('elevators').select('id', { count: 'exact', head: true }),
        supabase
          .from('emergency_visits')
          .select('id', { count: 'exact', head: true })
          .in('status', ['reported', 'assigned', 'in_progress']),
        supabase
          .from('maintenance_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      setStats({
        totalUsers: users.count || 0,
        totalClients: clients.count || 0,
        totalElevators: elevators.count || 0,
        activeEmergencies: emergencies.count || 0,
        pendingMaintenance: maintenance.count || 0,
        completedToday: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Usuarios',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      trend: '+12%',
    },
    {
      label: 'Clientes Activos',
      value: stats.totalClients,
      icon: Building2,
      color: 'bg-green-500',
      trend: '+8%',
    },
    {
      label: 'Ascensores',
      value: stats.totalElevators,
      icon: Wrench,
      color: 'bg-slate-500',
      trend: '+5%',
    },
    {
      label: 'Emergencias Activas',
      value: stats.activeEmergencies,
      icon: AlertTriangle,
      color: 'bg-red-500',
      trend: '-15%',
    },
    {
      label: 'Mantenimientos Pendientes',
      value: stats.pendingMaintenance,
      icon: Activity,
      color: 'bg-orange-500',
      trend: '+3%',
    },
    {
      label: 'Completados Hoy',
      value: stats.completedToday,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      trend: '+23%',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (showAdminForm) {
    return (
      <AdminForm
        onSuccess={() => {
          setShowAdminForm(false);
          loadStats();
        }}
        onCancel={() => setShowAdminForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Panel de Desarrollador</h1>
          <p className="text-slate-600 mt-1">Control total del sistema y monitoreo avanzado</p>
        </div>
        <button
          onClick={() => setShowAdminForm(true)}
          className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          <UserPlus className="w-5 h-5" />
          Nuevo Administrador
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-green-600">{card.trend}</span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">{card.value}</h3>
              <p className="text-sm text-slate-600">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Estado del Sistema</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Base de Datos</p>
                <p className="text-sm text-slate-600">Funcionando correctamente</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Autenticación</p>
                <p className="text-sm text-slate-600">Operacional</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">API</p>
                <p className="text-sm text-slate-600">Respuesta rápida</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-slate-900" />
            <h2 className="text-xl font-bold text-slate-900">Seguridad</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-semibold text-slate-900">Últimos Accesos</p>
              <p className="text-sm text-slate-600 mt-1">24 inicios de sesión en las últimas 24h</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-semibold text-slate-900">Sesiones Activas</p>
              <p className="text-sm text-slate-600 mt-1">12 usuarios conectados</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-semibold text-slate-900">Intentos Fallidos</p>
              <p className="text-sm text-slate-600 mt-1">2 intentos bloqueados hoy</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-2">Acceso Total al Sistema</h2>
        <p className="text-slate-300 mb-6">
          Como desarrollador, tienes acceso completo a todas las funcionalidades, configuraciones y datos del sistema.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => onNavigate?.('bulk-operations')}
            className="bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-slate-100 transition"
          >
            Operaciones Masivas
          </button>
          <button
            onClick={() => onNavigate?.('audit-logs')}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700"
          >
            Registro de Auditoría
          </button>
          <button
            onClick={() => onNavigate?.('activity-history')}
            className="bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition border border-slate-700"
          >
            Historial de Actividad
          </button>
        </div>
      </div>
    </div>
  );
}
