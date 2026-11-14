import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import UrlShortener from './components/UrlShortener';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('shortener');
  const [user, setUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedEmail = localStorage.getItem('userEmail');
    if (savedToken && savedEmail) {
      setUser({ token: savedToken, email: savedEmail });
    }
  }, []);

  const handleAuthSuccess = ({ email, token }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userEmail', email);
    setUser({ email, token });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setUser(null);
    setActiveTab('shortener');
  };

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'shortener' ? (
          <UrlShortener
            user={user}
            onOpenAuth={handleOpenAuth}
            onUrlCreated={() => {
              // Optionally offer to navigate to dashboard
            }}
          />
        ) : (
          <Dashboard
            user={user}
            onNavigateToShortener={() => setActiveTab('shortener')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FastAPI + Redis + PostgreSQL Backend Connected</span>
          </div>
          <div>
            Built with React, Vite & Tailwind CSS
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
