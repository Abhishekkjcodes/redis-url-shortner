import React, { useState } from 'react';
import { X, Save, AlertCircle, Loader2, Clock, Flame, Tag, Link2, ToggleLeft, ToggleRight } from 'lucide-react';
import { urlAPI } from '../api/client';

export default function EditUrlModal({ isOpen, onClose, urlItem, onUpdated }) {
  if (!isOpen || !urlItem) return null;

  const [original, setOriginal] = useState(urlItem.original || '');
  const [alias, setAlias] = useState(urlItem.alias || urlItem.shortened || '');
  const [expireAt, setExpireAt] = useState(
    urlItem.expire_at ? new Date(urlItem.expire_at).toISOString().slice(0, 16) : ''
  );
  const [active, setActive] = useState(urlItem.active ?? true);
  const [viewOnce, setViewOnce] = useState(urlItem.view_once ?? false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        original: original.trim(),
        alias: alias.trim() ? alias.trim() : null,
        expire_at: expireAt ? new Date(expireAt).toISOString() : null,
        active,
        view_once: viewOnce,
      };

      await urlAPI.update(urlItem.id, payload);
      if (onUpdated) {
        onUpdated();
      }
      onClose();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'Failed to update URL';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-100">
            Edit Short URL #{urlItem.id}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
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

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Original URL
            </label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="url"
                required
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Short Alias
            </label>
            <div className="relative">
              <Tag className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
              <Clock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Expiration Date & Time</span>
            </label>
            <input
              type="datetime-local"
              value={expireAt}
              onChange={(e) => setExpireAt(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-xs font-semibold text-slate-300">Active Status</span>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {active ? 'Active' : 'Inactive'}
              </button>
            </div>

            {/* View Once Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-xs font-semibold text-slate-300">View-Once</span>
              <button
                type="button"
                onClick={() => setViewOnce(!viewOnce)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                  viewOnce
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {viewOnce ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          <div className="pt-3 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 text-sm font-semibold hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
