import React from 'react';
import { Link2, LayoutDashboard, LogIn, LogOut, User, Sparkles, PlusCircle } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, user, onOpenAuth, onLogout }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('shortener')}
          className="flex cursor-pointer items-center space-x-2.5 group"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              SnipURL
            </span>
            <span className="hidden sm:inline-block ml-2 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20">
              API Powered
            </span>
          </div>
        </div>

        {/* Navigation & User controls */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('shortener')}
              className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                activeTab === 'shortener'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Shorten</span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  onOpenAuth('login');
                } else {
                  setActiveTab('dashboard');
                }
              }}
              className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
          </nav>

          {/* Account Profile / Auth Action */}
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
              <div className="hidden md:flex items-center space-x-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 font-semibold">
                  {user.email ? user.email[0].toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <span className="font-medium text-slate-300 max-w-[120px] truncate">
                  {user.email}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Log Out"
                className="flex items-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-rose-400 transition-all duration-150"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth('login')}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 transition-all duration-200 active:scale-95"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
