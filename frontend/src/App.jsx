import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FleetRidersPage from './pages/FleetRidersPage.jsx';
import NewPlanPage from './pages/NewPlanPage.jsx';
import PlanDetailPage from './pages/PlanDetailPage.jsx';

function ProtectedShell() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" aria-hidden="true" />
        <span className="text-sm font-medium">Restoring session...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function PublicOnlyRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<PublicOnlyRoute />} />
          <Route element={<ProtectedShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/fleet" element={<FleetRidersPage />} />
            <Route path="/plans/new" element={<NewPlanPage />} />
            <Route path="/plans/:id" element={<PlanDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
