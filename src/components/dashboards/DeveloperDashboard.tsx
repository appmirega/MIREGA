import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';

interface Stats {
  users: number;
  admins: number;
  technicians: number;
}

export default function DeveloperDashboard() {
  const [stats, setStats] = useState<Stats>({ users: 0, admins: 0, technicians: 0 });

  useEffect(() => {
    // fetch de stats real si lo necesitas; por ahora placeholder
    setStats({ users: 0, admins: 0, technicians: 0 });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-purple-600" />
        <h1 className="text-2xl font-bold text-slate-900">Panel de Desarrollador</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Usuarios</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{stats.users}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Administradores</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{stats.admins}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Técnicos</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.technicians}</p>
        </div>
      </div>
    </div>
  );
}
