import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  QrCode,
  ClipboardList,
  Building2,
  Search,
  History,
  FileText,
  Download,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { QRScanner } from '../checklist/QRScanner';
import { CertificationForm } from '../checklist/CertificationForm';
import { DynamicChecklistForm } from '../checklist/DynamicChecklistForm';
import { generateMaintenancePDF, generatePDFFilename } from '../../utils/pdfGenerator';

interface Client {
  id: string;
  company_name: string;
  address: string;
}

interface Elevator {
  id: string;
  brand: string;
  model: string;
  serial_number: string;
  is_hydraulic: boolean;
  location_name: string;
}

interface ActiveChecklist {
  id: string;
  elevator_id: string;
  elevator: Elevator;
  month: number;
  year: number;
}

interface MaintenanceHistory {
  id: string;
  month: number;
  year: number;
  completion_date: string;
  status: string;
  elevator: {
    brand: string;
    model: string;
    serial_number: string;
  };
  client: {
    company_name: string;
  };
}

interface PDFRecord {
  id: string;
  folio_number: number;
  file_name: string;
  created_at: string;
  checklist: {
    month: number;
    year: number;
    clients: {
      company_name: string;
    };
    elevators: {
      brand: string;
      model: string;
    };
  };
}

type ViewMode = 'start' | 'select-elevator' | 'certification' | 'checklist' | 'history' | 'pdfs';

export function TechnicianMaintenanceChecklistView() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showBuildingSearch, setShowBuildingSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(null);
  const [activeChecklist, setActiveChecklist] = useState<ActiveChecklist | null>(null);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceHistory[]>([]);
  const [pdfs, setPdfs] = useState<PDFRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadClients();
    }
  }, [profile]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, address')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadMaintenanceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('mnt_checklists')
        .select(`
          id,
          month,
          year,
          completion_date,
          status,
          elevators (
            brand,
            model,
            serial_number
          ),
          clients (
            company_name
          )
        `)
        .eq('technician_id', profile?.id)
        .order('completion_date', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMaintenanceHistory(data || []);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const loadPDFs = async () => {
    try {
      const { data: checklistIds } = await supabase
        .from('mnt_checklists')
        .select('id')
        .eq('technician_id', profile?.id);

      if (!checklistIds || checklistIds.length === 0) {
        setPdfs([]);
        return;
      }

      const ids = checklistIds.map((c) => c.id);

      const { data, error } = await supabase
        .from('mnt_maintenance_pdfs')
        .select(`
          *,
          checklist:mnt_checklists!inner (
            month,
            year,
            clients (
              company_name
            ),
            elevators (
              brand,
              model
            )
          )
        `)
        .in('checklist_id', ids)
        .order('folio_number', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item) => ({
        ...item,
        checklist: Array.isArray(item.checklist) ? item.checklist[0] : item.checklist,
      })) || [];

      setPdfs(formattedData);
    } catch (err) {
      console.error('Error loading PDFs:', err);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setLoading(true);
    setError(null);
    setShowQRScanner(false);

    try {
      const { data: elevatorData, error: elevatorError } = await supabase
        .from('elevators')
        .select(`
          id,
          brand,
          model,
          serial_number,
          is_hydraulic,
          location_name,
          client_id,
          clients (
            id,
            company_name,
            address
          )
        `)
        .eq('id', qrCode)
        .single();

      if (elevatorError) throw new Error('Código QR no válido');

      const client = elevatorData.clients as unknown as Client;
      setSelectedClient(client);
      setElevators([elevatorData]);
      setViewMode('select-elevator');
    } catch (err: any) {
      console.error('Error processing QR:', err);
      setError(err.message || 'Error al procesar el código QR');
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingSelect = async (client: Client) => {
    setLoading(true);
    setError(null);
    setShowBuildingSearch(false);

    try {
      const { data: elevatorsData, error: elevatorsError } = await supabase
        .from('elevators')
        .select('id, brand, model, serial_number, is_hydraulic, location_name')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .order('location_name');

      if (elevatorsError) throw elevatorsError;

      setSelectedClient(client);
      setElevators(elevatorsData || []);
      setViewMode('select-elevator');
    } catch (err: any) {
      console.error('Error loading elevators:', err);
      setError(err.message || 'Error al cargar ascensores');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectElevator = async (elevator: Elevator) => {
    setSelectedElevator(elevator);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const { data: existingChecklist } = await supabase
      .from('mnt_checklists')
      .select('*')
      .eq('elevator_id', elevator.id)
      .eq('technician_id', profile?.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingChecklist) {
      setActiveChecklist({
        id: existingChecklist.id,
        elevator_id: elevator.id,
        elevator: elevator,
        month: currentMonth,
        year: currentYear,
      });
      setViewMode('checklist');
    } else {
      setViewMode('certification');
    }
  };

  const handleCertificationComplete = (checklistId: string) => {
    if (selectedElevator) {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      setActiveChecklist({
        id: checklistId,
        elevator_id: selectedElevator.id,
        elevator: selectedElevator,
        month: currentMonth,
        year: currentYear,
      });
      setViewMode('checklist');
    }
  };

  const handleChecklistComplete = () => {
    setViewMode('start');
    setSelectedClient(null);
    setSelectedElevator(null);
    setActiveChecklist(null);
    setElevators([]);
  };

  const handleViewHistory = () => {
    loadMaintenanceHistory();
    setViewMode('history');
  };

  const handleViewPDFs = () => {
    loadPDFs();
    setViewMode('pdfs');
  };

  const downloadPDF = async (pdf: PDFRecord) => {
    setDownloading(pdf.id);
    try {
      const pdfBlob = await generateMaintenancePDF(pdf as any);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generatePDFFilename(pdf.checklist.clients.company_name, pdf.folio_number);
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar PDF');
    } finally {
      setDownloading(null);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (viewMode === 'certification' && selectedClient && selectedElevator) {
    return (
      <CertificationForm
        client={selectedClient}
        elevator={selectedElevator}
        onComplete={handleCertificationComplete}
        onCancel={() => setViewMode('select-elevator')}
      />
    );
  }

  if (viewMode === 'checklist' && activeChecklist) {
    return (
      <DynamicChecklistForm
        checklistId={activeChecklist.id}
        elevator={activeChecklist.elevator}
        month={activeChecklist.month}
        year={activeChecklist.year}
        onComplete={handleChecklistComplete}
        onCancel={() => setViewMode('start')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Checklist de Mantenimiento</h1>
          <p className="text-slate-600 mt-1">Gestión completa de mantenimientos</p>
        </div>
        {viewMode !== 'start' && (
          <button
            onClick={() => {
              setViewMode('start');
              setSelectedClient(null);
              setSelectedElevator(null);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        )}
      </div>

      {viewMode === 'start' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => setShowQRScanner(true)}
              className="p-6 bg-white border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition text-left"
            >
              <QrCode className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Escanear QR</h3>
              <p className="text-sm text-slate-600">Iniciar con código QR</p>
            </button>

            <button
              onClick={() => setShowBuildingSearch(true)}
              className="p-6 bg-white border-2 border-green-200 rounded-xl hover:bg-green-50 transition text-left"
            >
              <Building2 className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Buscar Edificio</h3>
              <p className="text-sm text-slate-600">Seleccionar por nombre</p>
            </button>

            <button
              onClick={handleViewHistory}
              className="p-6 bg-white border-2 border-purple-200 rounded-xl hover:bg-purple-50 transition text-left"
            >
              <History className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Historial</h3>
              <p className="text-sm text-slate-600">Ver mantenimientos realizados</p>
            </button>

            <button
              onClick={handleViewPDFs}
              className="p-6 bg-white border-2 border-orange-200 rounded-xl hover:bg-orange-50 transition text-left"
            >
              <FileText className="w-8 h-8 text-orange-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">PDFs</h3>
              <p className="text-sm text-slate-600">Ver y descargar reportes</p>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'select-elevator' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            Seleccionar Ascensor - {selectedClient?.company_name}
          </h2>
          {elevators.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No hay ascensores disponibles</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {elevators.map((elevator) => (
                <button
                  key={elevator.id}
                  onClick={() => handleSelectElevator(elevator)}
                  className="p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                >
                  <h3 className="font-bold text-slate-900 mb-2">
                    {elevator.brand} {elevator.model}
                  </h3>
                  <p className="text-sm text-slate-600">S/N: {elevator.serial_number}</p>
                  <p className="text-sm text-slate-600">{elevator.location_name}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {elevator.is_hydraulic ? 'Hidráulico' : 'Eléctrico'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'history' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Historial de Mantenimientos</h2>
          {maintenanceHistory.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No hay historial disponible</p>
          ) : (
            <div className="space-y-4">
              {maintenanceHistory.map((maintenance) => (
                <div
                  key={maintenance.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">
                        {maintenance.client.company_name}
                      </h3>
                      <p className="text-sm text-slate-600 mb-2">
                        {maintenance.elevator.brand} {maintenance.elevator.model} - S/N:{' '}
                        {maintenance.elevator.serial_number}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(
                              maintenance.year,
                              maintenance.month - 1
                            ).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        {maintenance.completion_date && (
                          <span>
                            Completado:{' '}
                            {new Date(maintenance.completion_date).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        maintenance.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {maintenance.status === 'completed' ? 'Completado' : 'En Progreso'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'pdfs' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">PDFs de Mantenimiento</h2>
          {pdfs.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No hay PDFs disponibles</p>
          ) : (
            <div className="space-y-4">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <FileText className="w-5 h-5 text-blue-600 mt-1" />
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 mb-1">Folio #{pdf.folio_number}</h3>
                        <p className="text-sm text-slate-600 mb-2">
                          {pdf.checklist.clients.company_name} - {pdf.checklist.elevators.brand}{' '}
                          {pdf.checklist.elevators.model}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(pdf.checklist.year, pdf.checklist.month - 1).toLocaleDateString(
                            'es-ES',
                            { month: 'long', year: 'numeric' }
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadPDF(pdf)}
                      disabled={downloading === pdf.id}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      {downloading === pdf.id ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Escanear Código QR</h3>
            <QRScanner
              onScan={handleQRScan}
              onClose={() => setShowQRScanner(false)}
              title="Escanea el código QR del ascensor"
            />
          </div>
        </div>
      )}

      {showBuildingSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Buscar Edificio</h3>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre de edificio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {filteredClients.length === 0 ? (
                <p className="text-slate-600 text-center py-8">No se encontraron edificios</p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleBuildingSelect(client)}
                    className="w-full p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                  >
                    <h4 className="font-bold text-slate-900">{client.company_name}</h4>
                    <p className="text-sm text-slate-600">{client.address}</p>
                  </button>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowBuildingSearch(false);
                  setSearchTerm('');
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
}
