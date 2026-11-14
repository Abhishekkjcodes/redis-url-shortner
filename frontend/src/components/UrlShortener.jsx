import React, { useState } from 'react';
import { Link2, Sparkles, Clock, Flame, Tag, ArrowRight, Loader2, Lock, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { urlAPI } from '../api/client';
import UrlResultCard from './UrlResultCard';

export default function UrlShortener({ user, onOpenAuth, onUrlCreated }) {
  const [originalUrl, setOriginalUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [expireAt, setExpireAt] = useState('');
  const [viewOnce, setViewOnce] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!originalUrl.trim()) return;

    if (!user) {
      onOpenAuth('login');
      return;
    }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        original: originalUrl.trim(),
        alias: alias.trim() ? alias.trim() : null,
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
        active: true,
        view_once: viewOnce,
      };

      const data = await urlAPI.create(payload);
      // Merge view_once and expire_at back into data for display in UrlResultCard if missing
      const fullResult = {
        ...data,
        view_once: viewOnce,
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
      };
      setResult(fullResult);

      // Trigger callback so dashboard auto updates
      if (onUrlCreated) {
        onUrlCreated(fullResult);
      }
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'Failed to shorten URL';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 sm:py-16">
      {/* Hero Header */}
      <div className="max-w-3xl text-center space-y-4 mb-10">
        <div className="inline-flex items-center space-x-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>PostgreSQL + Redis Cached Speed</span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Shorten Links. Track Clicks. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
            Control Expiry.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto">
          Create lightning-fast short URLs with optional custom aliases, self-destruct view-once links, and automated expiry dates.
        </p>
      </div>

      {/* Main Shortener Card */}
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl shadow-slate-950/80 backdrop-blur-xl relative">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Main URL Input field */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              Destination URL <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-4 top-4 h-5 w-5 text-slate-500" />
              <input
                type="url"
                required
                placeholder="https://example.com/my-very-long-url-path"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950/90 py-3.5 pl-12 pr-4 text-base text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Advanced options expander button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span>{showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Custom Alias, Expiry, View-Once)'}</span>
            </button>
          </div>

          {/* Advanced fields section */}
          {showAdvanced && (
            <div className="space-y-4 pt-3 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Custom Alias */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1">
                    <Tag className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Custom Alias (Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="my-custom-code"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Expiry Date/Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center space-x-1">
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Expiration Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={expireAt}
                    onChange={(e) => setExpireAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/90 py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* View-Once Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
                <div className="flex items-center space-x-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-semibold text-slate-200">View-Once Link</span>
                    <span className="block text-xs text-slate-400">Deactivates link immediately after the first click</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={viewOnce}
                    onChange={(e) => setViewOnce(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 py-4 text-base font-bold text-white shadow-xl shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 transition-all duration-200 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Shortening URL...</span>
              </>
            ) : user ? (
              <>
                <span>Shorten URL</span>
                <ArrowRight className="h-5 w-5" />
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                <span>Sign In to Shorten URL</span>
              </>
            )}
          </button>
        </form>

        {/* Error message */}
        {error && (
          <div className="mt-4 flex items-center space-x-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-sm text-rose-300">
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated Result Card */}
      {result && (
        <div className="mt-8 w-full max-w-2xl">
          <UrlResultCard resultData={result} />
        </div>
      )}
    </div>
  );
}
