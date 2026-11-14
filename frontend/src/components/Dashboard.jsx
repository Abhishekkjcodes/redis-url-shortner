import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Trash2,
  BarChart2,
  Flame,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Loader2,
  AlertCircle,
  Link2
} from 'lucide-react';
import { urlAPI } from '../api/client';
import EditUrlModal from './EditUrlModal';

export default function Dashboard({ user, onNavigateToShortener }) {
  const [urls, setUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Edit modal state
  const [editingUrl, setEditingUrl] = useState(null);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const fetchUrls = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      // 1. Fetch user's basic link list from GET /urls/
      const basicList = await urlAPI.getAll();

      // 2. Fetch full details for each URL in parallel via GET /urls/{id}
      const fullListPromises = basicList.map(async (item) => {
        try {
          const detail = await urlAPI.getInfo(item.id);
          return detail;
        } catch (e) {
          // Fallback to basic object if detail fails
          return {
            ...item,
            alias: item.shortened,
            clicks: 0,
            active: true,
            view_once: false,
            expire_at: null,
            created_at: new Date().toISOString(),
          };
        }
      });

      const fullList = await Promise.all(fullListPromises);
      setUrls(fullList);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'Failed to fetch URLs';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUrls();
    }
  }, [user]);

  const handleCopy = (shortened, id) => {
    const fullUrl = `${baseUrl.replace(/\/$/, '')}/${shortened}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this shortened link?')) return;

    try {
      await urlAPI.delete(id);
      setUrls((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert('Failed to delete URL: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Filter list by search query
  const filteredUrls = urls.filter(
    (item) =>
      item.original.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.shortened.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.alias && item.alias.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Compute stat summary
  const totalLinks = urls.length;
  const activeLinksCount = urls.filter((u) => u.active).length;
  const totalClicksCount = urls.reduce((acc, curr) => acc + (curr.clicks || 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300">
      {/* Top Bar / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
            Link Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Manage your shortened links, monitor click metrics, and adjust settings.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchUrls(true)}
            disabled={refreshing || loading}
            className="flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onNavigateToShortener}
            className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create New Link</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Links</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-100">{totalLinks}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Links</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-400">{activeLinksCount}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Clicks</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <BarChart2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-black text-violet-400">{totalClicksCount}</p>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-2.5">
        <Search className="h-4 w-4 text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Search links by original URL or short alias..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ml-3 w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
        />
      </div>

      {/* Main Table / Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-sm font-medium text-slate-400">Loading your shortened links...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          <AlertCircle className="h-5 w-5 text-rose-400 mr-2 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredUrls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 text-center p-6">
          <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
            <Link2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-200">No URLs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            {searchQuery ? 'No links matching your search filter.' : 'You haven’t shortened any links yet.'}
          </p>
          {!searchQuery && (
            <button
              onClick={onNavigateToShortener}
              className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Shorten Your First Link</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th scope="col" className="px-6 py-4">Shortened URL</th>
                  <th scope="col" className="px-6 py-4">Original Destination</th>
                  <th scope="col" className="px-6 py-4 text-center">Clicks</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">View-Once / Expiry</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-medium">
                {filteredUrls.map((item) => {
                  const fullShortUrl = `${baseUrl.replace(/\/$/, '')}/${item.shortened}`;
                  const isCopied = copiedId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Short URL Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm font-bold text-indigo-400">
                            {item.shortened}
                          </span>
                          <button
                            onClick={() => handleCopy(item.shortened, item.id)}
                            className="text-slate-500 hover:text-slate-200 transition-colors"
                            title="Copy Short Link"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={fullShortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-slate-200 transition-colors"
                            title="Test Link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* Original URL Column */}
                      <td className="px-6 py-4 max-w-xs">
                        <span className="block truncate text-xs text-slate-300" title={item.original}>
                          {item.original}
                        </span>
                      </td>

                      {/* Clicks */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center space-x-1 rounded-full bg-slate-800 px-3 py-1 font-mono text-xs font-bold text-slate-200 border border-slate-700">
                          <BarChart2 className="h-3 w-3 text-indigo-400 mr-1" />
                          {item.clicks ?? 0}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.active ? (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                            <XCircle className="h-3 w-3" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* View-once & Expiry */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        <div className="flex flex-col space-y-1">
                          {item.view_once && (
                            <span className="inline-flex items-center space-x-1 text-amber-400 font-semibold">
                              <Flame className="h-3 w-3" />
                              <span>View-Once</span>
                            </span>
                          )}
                          {item.expire_at ? (
                            <span className="inline-flex items-center space-x-1 text-slate-400">
                              <Clock className="h-3 w-3 text-slate-500" />
                              <span>{new Date(item.expire_at).toLocaleString()}</span>
                            </span>
                          ) : (
                            !item.view_once && <span className="text-slate-500">Never expires</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setEditingUrl(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-indigo-400 transition-colors"
                            title="Edit Link"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                            title="Delete Link"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit URL Modal */}
      {editingUrl && (
        <EditUrlModal
          isOpen={Boolean(editingUrl)}
          onClose={() => setEditingUrl(null)}
          urlItem={editingUrl}
          onUpdated={() => fetchUrls(true)}
        />
      )}
    </div>
  );
}
