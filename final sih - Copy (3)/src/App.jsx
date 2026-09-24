import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { Dashboard } from './components/Dashboard';
import { Diagnosis } from './components/Diagnosis';
import { WhatIf } from './components/WhatIf';
import { AdminPanel } from './components/AdminPanel';

const API_BASE_URL = "http://127.0.0.1:8000";

const AppContent = () => {
  const { token, user, login, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(706718);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [reportInfo, setReportInfo] = useState(null);
  
  // Explicit API Connection Error state (so page NEVER renders blank)
  const [apiError, setApiError] = useState(null);
  const [checkingApi, setCheckingApi] = useState(false);

  const checkApiHealth = async () => {
    setCheckingApi(true);
    try {
      const res = await fetch('/api/projects?limit=1', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok || res.status === 401) {
        setApiError(null);
        return true;
      } else {
        setApiError(`Cannot reach API at ${API_BASE_URL} (HTTP ${res.status})`);
        return false;
      }
    } catch (err) {
      setApiError(`Cannot reach API at ${API_BASE_URL} (Network Error)`);
      return false;
    } finally {
      setCheckingApi(false);
    }
  };

  // Initial API health check & auto-login
  useEffect(() => {
    checkApiHealth().then((isHealthy) => {
      if (!isAuthenticated) {
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin_user', password: 'admin123' })
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.access_token) {
              login(data.access_token, data.user);
              setApiError(null);
            }
          })
          .catch(() => {
            setApiError(`Cannot reach API at ${API_BASE_URL}`);
          });
      }
    });
  }, []);

  // Fetch report info from API
  useEffect(() => {
    if (token) {
      fetch('/api/projects?limit=1', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          setReportInfo({
            month: data.report_month || 'July 2026',
            totalCount: data.total || 1775
          });
          setApiError(null);
        })
        .catch((err) => {
          setApiError(`Cannot reach API at ${API_BASE_URL}`);
        });
    }
  }, [token]);

  const handleSelectProject = (pid) => {
    setSelectedProjectId(pid);
    setActiveTab('diagnosis');
  };

  const handleGoToWhatIf = (pid) => {
    setSelectedProjectId(pid);
    setActiveTab('whatif');
  };

  const renderActiveView = () => {
    if (apiError) {
      return (
        <div className="bg-gray-900/90 border border-amber-500/50 rounded-xl p-8 max-w-2xl mx-auto my-12 text-center space-y-4 shadow-2xl">
          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-lg">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            <span>{apiError}</span>
          </div>
          <p className="text-sm text-gray-300">
            The frontend application is running, but cannot communicate with the LAABH FastAPI backend server.
          </p>
          <div className="p-4 bg-gray-950 border border-gray-800 rounded-lg text-left text-xs font-mono space-y-2">
            <span className="text-gray-400 block font-semibold">To start the backend server, run this command in your terminal:</span>
            <code className="text-amber-300 block bg-gray-900 p-2 rounded border border-gray-800">
              uvicorn backend.app.main:app --reload --port 8000
            </code>
          </div>
          <div className="pt-2">
            <button
              onClick={checkApiHealth}
              disabled={checkingApi}
              className="btn-primary text-xs py-2 px-6"
            >
              {checkingApi ? 'Connecting...' : 'Retry API Connection ↻'}
            </button>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <div className="text-center py-20 bg-gray-900/60 rounded-xl border border-gray-800 p-8 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-amber-400 mb-2">LAABH Infrastructure Portal</h2>
          <p className="text-gray-400 text-sm mb-6">Please login to access scoped project risk diagnostics.</p>
          <button onClick={() => setIsLoginOpen(true)} className="btn-primary">
            Login with JWT
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
      case 'projects':
        return <Dashboard onSelectProject={handleSelectProject} />;

      case 'diagnosis':
        return (
          <Diagnosis
            projectId={selectedProjectId}
            onBack={() => setActiveTab('dashboard')}
            onGoToWhatIf={handleGoToWhatIf}
          />
        );

      case 'whatif':
        return (
          <WhatIf
            projectId={selectedProjectId}
            onBack={() => setActiveTab('dashboard')}
          />
        );

      case 'admin':
        return <AdminPanel />;

      default:
        return <Dashboard onSelectProject={handleSelectProject} />;
    }
  };

  return (
    <div className="app-layout min-h-screen bg-[#09090b] text-gray-100 font-sans selection:bg-amber-500 selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportInfo={reportInfo}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      <main className="main-content container mx-auto px-4 py-8 max-w-7xl">
        {renderActiveView()}
      </main>

      <footer className="border-t border-gray-800/80 py-6 text-center text-xs text-gray-500">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>LAABH System — Ministry of Statistics and Programme Implementation (MoSPI)</span>
          <span className="font-mono text-[11px] text-gray-400">WCAG AA Compliant | Phase-Cascade Bottleneck Diagnosis Engine</span>
        </div>
      </footer>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
