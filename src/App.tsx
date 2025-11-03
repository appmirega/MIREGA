import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { DeveloperDashboard } from './components/dashboards/DeveloperDashboard';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { TechnicianDashboard } from './components/dashboards/TechnicianDashboard';
import { ClientDashboard } from './components/dashboards/ClientDashboard';
import { UserProfile } from './components/UserProfile';
import { ManualsView } from './components/views/ManualsView';
import { MaintenanceView } from './components/views/MaintenanceView';
import { EmergencyView } from './components/views/EmergencyView';
import { EmergencyV2View } from './components/views/EmergencyV2View';
import { WorkOrdersView } from './components/views/WorkOrdersView';
import { RoutesView } from './components/views/RoutesView';
import { QuotationsManagementView } from './components/views/QuotationsManagementView';
import { MaintenanceChecklistView } from './components/views/MaintenanceChecklistView';
import { QRCodesManagementView } from './components/views/QRCodesManagementView';
import { QRGalleryView } from './components/views/QRGalleryView';
import { CertificationsDashboard } from './components/views/CertificationsDashboard';
import { PDFHistoryView } from './components/views/PDFHistoryView';
import { StatisticsView } from './components/views/StatisticsView';
import { AuditLogView } from './components/views/AuditLogView';
import { BulkOperationsView } from './components/views/BulkOperationsView';
import { ClientEmergenciesView } from './components/views/ClientEmergenciesView';
import { ClientQuotationsView } from './components/views/ClientQuotationsView';
import { CarpetaCeroView } from './components/views/CarpetaCeroView';
import { RescueTrainingView } from './components/views/RescueTrainingView';
import { MaintenanceCompleteView } from './components/views/MaintenanceCompleteView';
import { EmergencyHistoryCompleteView } from './components/views/EmergencyHistoryCompleteView';
import { QRCodesCompleteView } from './components/views/QRCodesCompleteView';
import { AdminRescueTrainingView } from './components/views/AdminRescueTrainingView';
import { TechnicianMaintenanceChecklistView } from './components/views/TechnicianMaintenanceChecklistView';
import { TechnicianEmergencyView } from './components/views/TechnicianEmergencyView';
import { TechnicianWorkOrdersView } from './components/views/TechnicianWorkOrdersView';
import { TechnicianRoutesView } from './components/views/TechnicianRoutesView';
import { NotificationsView } from './components/views/NotificationsView';
import { UsersView } from './components/views/UsersView';
import { ClientsView } from './components/views/ClientsView';
import { ElevatorsCompleteView } from './components/views/ElevatorsCompleteView';
import { ClientTechnicalInfoView } from './components/views/ClientTechnicalInfoView';
import { DeveloperPermissionsPanel } from './components/views/DeveloperPermissionsPanel';
import { AdminPermissionsPanel } from './components/views/AdminPermissionsPanel';

interface DashboardRouterProps {
  onNavigate?: (path: string) => void;
}

function DashboardRouter({ onNavigate }: DashboardRouterProps) {
  const { profile } = useAuth();

  if (!profile) return null;

  switch (profile.role) {
    case 'developer':
      return <DeveloperDashboard onNavigate={onNavigate} />;
    case 'admin':
      return <AdminDashboard onNavigate={onNavigate} />;
    case 'technician':
      return <TechnicianDashboard onNavigate={onNavigate} />;
    case 'client':
      return <ClientDashboard onNavigate={onNavigate} />;
    default:
      return (
        <div className="text-center py-12">
          <p className="text-slate-600">Rol no reconocido</p>
        </div>
      );
  }
}

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'profile':
        return <UserProfile />;
      case 'manuals':
        return <ManualsView />;
      case 'maintenance':
        return <MaintenanceView />;
      case 'emergencies':
        return profile?.role === 'technician' ? <TechnicianEmergencyView /> : <EmergencyV2View />;
      case 'client-emergencies':
        return <ClientEmergenciesView />;
      case 'work-orders':
        return profile?.role === 'technician' ? <TechnicianWorkOrdersView /> : <WorkOrdersView />;
      case 'routes':
        return profile?.role === 'technician' ? <TechnicianRoutesView /> : <RoutesView />;
      case 'quotations':
        return <QuotationsManagementView />;
      case 'client-quotations':
        return <ClientQuotationsView />;
      case 'carpeta-cero':
        return <CarpetaCeroView />;
      case 'rescue-training':
        return <RescueTrainingView />;
      case 'rescue-training-admin':
        return <AdminRescueTrainingView />;
      case 'maintenance-checklist':
        return profile?.role === 'technician' ? <TechnicianMaintenanceChecklistView /> : <MaintenanceChecklistView />;
      case 'maintenance-complete':
        return <MaintenanceCompleteView />;
      case 'emergency-history':
        return <EmergencyHistoryCompleteView />;
      case 'qr-codes-complete':
        return <QRCodesCompleteView />;
      case 'certifications':
        return <CertificationsDashboard />;
      case 'pdf-history':
        return <PDFHistoryView />;
      case 'statistics':
        return <StatisticsView />;
      case 'audit-logs':
        return <AuditLogView />;
      case 'bulk-operations':
        return <BulkOperationsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'users':
        return <UsersView />;
      case 'clients':
        return <ClientsView />;
      case 'elevators':
        return <ElevatorsCompleteView onNavigate={setCurrentView} />;
      case 'client-technical-info':
        return <ClientTechnicalInfoView />;
      case 'developer-permissions':
        return <DeveloperPermissionsPanel />;
      case 'admin-permissions':
        return <AdminPermissionsPanel />;
      case 'dashboard':
      default:
        return <DashboardRouter onNavigate={setCurrentView} />;
    }
  };

  return (
    <Layout onNavigate={setCurrentView}>
      {renderContent()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
