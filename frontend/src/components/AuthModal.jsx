import React, { useState } from 'react';
import { X, Lock, Mail, User, Sparkles, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { authAPI } from '../api/client';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name.trim()) {
          throw new Error('Please enter your name');
        }
        // Register user
        await authAPI.register(name, email, password);
      }
      
      // Perform Login
      const data = await authAPI.login(email, password);
      onAuthSuccess({ email, token: data.access_token });
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Authentication failed. Please check your credentials.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    const randomId = Math.floor(Math.random() * 100000);
    const demoName = `Demo User ${randomId}`;
    const demoEmail = `demo_${randomId}@example.com`;
    const demoPass = `demo12345`;

    try {
      await authAPI.register(demoName, demoEmail, demoPass);
      const data = await authAPI.login(demoEmail, demoPass);
      onAuthSuccess({ email: demoEmail, token: data.access_token });
      onClose();
    } catch (err) {
      // If user already exists, try logging in
      try {
        const data = await authAPI.login(demoEmail, demoPass);
        onAuthSuccess({ email: demoEmail, token: data.access_token });
        onClose();
      } catch (loginErr) {
        setError('Failed to create demo account. Please try manual registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
              {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </div>
            <h3 className="text-lg font-bold text-slate-100">
              {mode === 'login' ? 'Sign In to Your Account' : 'Create a New Account'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 border-b border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-slate-800 text-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2 text-sm font-semibold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-slate-800 text-indigo-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start space-x-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-all duration-150 mt-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === 'login' ? (
              <span>Sign In</span>
            ) : (
              <span>Create Account</span>
            )}
          </button>

          {/* Quick Demo Login Option */}
          <div className="pt-3 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-400 mb-2">Want to try it without registering manually?</p>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-all duration-150"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>One-Click Demo Login</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
