import { useState } from 'react';
import { Calendar, AlertTriangle, CheckCircle } from 'lucide-react';

interface CertificationFormProps {
  onSubmit: (data: {
    lastCertificationDate: string | null;
    nextCertificationDate: string | null;
    certificationNotLegible: boolean;
  }) => void;
  onCancel: () => void;
}

export function CertificationForm({ onSubmit, onCancel }: CertificationFormProps) {
  const [lastCertDate, setLastCertDate] = useState('');
  const [notLegible, setNotLegible] = useState(false);
  const [certificationStatus, setCertificationStatus] = useState<'valid' | 'expiring_soon' | 'expired' | null>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  const calculateNextCertDate = (lastDate: string) => {
    if (!lastDate) return null;
    const date = new Date(lastDate);
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().split('T')[0];
  };

  const calculateCertificationStatus = (nextDate: string) => {
    const today = new Date();
    const expiryDate = new Date(nextDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    setDaysUntilExpiry(diffDays);

    if (diffDays < 0) {
      setCertificationStatus('expired');
    } else if (diffDays <= 120) {
      setCertificationStatus('expiring_soon');
    } else {
      setCertificationStatus('valid');
    }
  };

  const handleLastDateChange = (date: string) => {
    setLastCertDate(date);
    if (date) {
      const nextDate = calculateNextCertDate(date);
      if (nextDate) {
        calculateCertificationStatus(nextDate);
      }
    } else {
      setCertificationStatus(null);
      setDaysUntilExpiry(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (notLegible) {
      onSubmit({
        lastCertificationDate: null,
        nextCertificationDate: null,
        certificationNotLegible: true,
      });
    } else if (lastCertDate) {
      const nextDate = calculateNextCertDate(lastCertDate);
      onSubmit({
        lastCertificationDate: lastCertDate,
        nextCertificationDate: nextDate,
        certificationNotLegible: false,
      });
    }
  };

  const getStatusBadge = () => {
    if (!certificationStatus || notLegible) return null;

    const badges = {
      valid: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircle,
        label: 'Vigente',
      },
      expiring_soon: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: AlertTriangle,
        label: 'Próximo a Vencer',
      },
      expired: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: AlertTriangle,
        label: 'Vencida',
      },
    };

    const badge = badges[certificationStatus];
    const Icon = badge.icon;

    return (
      <div className={`${badge.bg} ${badge.text} px-4 py-3 rounded-lg flex items-center gap-3 mt-4`}>
        <Icon className="w-5 h-5" />
        <div>
          <p className="font-semibold">{badge.label}</p>
          {daysUntilExpiry !== null && (
            <p className="text-sm">
              {daysUntilExpiry < 0
                ? `Venció hace ${Math.abs(daysUntilExpiry)} días`
                : daysUntilExpiry === 0
                ? 'Vence hoy'
                : `Vence en ${daysUntilExpiry} días`}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 rounded-lg">
          <Calendar className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Información de Certificación</h2>
          <p className="text-sm text-slate-600">Ingresa las fechas de certificación del ascensor</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              checked={notLegible}
              onChange={(e) => {
                setNotLegible(e.target.checked);
                if (e.target.checked) {
                  setLastCertDate('');
                  setCertificationStatus(null);
                  setDaysUntilExpiry(null);
                }
              }}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="font-medium text-slate-700">
              Certificación no legible o no disponible
            </span>
          </label>

          {notLegible && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Se marcará que la certificación no está disponible. El administrador deberá actualizar esta información posteriormente.
              </p>
            </div>
          )}
        </div>

        {!notLegible && (
          <>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha de Última Certificación
              </label>
              <input
                type="date"
                value={lastCertDate}
                onChange={(e) => handleLastDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                required={!notLegible}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Fecha que aparece en la placa de certificación del ascensor
              </p>
            </div>

            {lastCertDate && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Próxima Certificación (Calculada Automáticamente)
                </label>
                <input
                  type="date"
                  value={calculateNextCertDate(lastCertDate) || ''}
                  disabled
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Las certificaciones se renuevan anualmente (1 año desde la última)
                </p>
              </div>
            )}

            {getStatusBadge()}
          </>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-bold text-blue-900 mb-2">Información Importante</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>La certificación debe renovarse anualmente</li>
            <li>Recibirás alertas 120, 90 y 30 días antes del vencimiento</li>
            <li>Si la placa no es legible, márcalo para actualizar después</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!notLegible && !lastCertDate}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      </form>
    </div>
  );
}
