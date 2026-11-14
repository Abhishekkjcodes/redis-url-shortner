import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Sparkles, Clock, Flame, ShieldAlert } from 'lucide-react';

export default function UrlResultCard({ resultData, baseUrl = 'http://localhost:8000' }) {
  const [copied, setCopied] = useState(false);

  if (!resultData) return null;

  // Form full short URL using alias/shortened
  const shortUrl = `${baseUrl.replace(/\/$/, '')}/${resultData.shortened}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900/90 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold tracking-wider uppercase mb-3">
        <Sparkles className="h-4 w-4" />
        <span>URL Shortened Successfully!</span>
      </div>

      {/* Main Short URL display box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-slate-950/80 p-3.5 sm:p-4">
        <div className="flex items-center space-x-3 overflow-hidden min-w-0">
          <span className="truncate font-mono text-base sm:text-lg font-bold text-indigo-300">
            {shortUrl}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleCopy}
            className={`flex items-center justify-center space-x-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
              copied
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </button>

          <a
            href={shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-all"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Metadata details */}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center space-x-1.5 truncate max-w-full">
          <span className="text-slate-500">Destination:</span>
          <span className="truncate text-slate-300 max-w-xs">{resultData.original}</span>
        </div>

        {resultData.view_once && (
          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-amber-400 font-medium">
            <Flame className="h-3 w-3" />
            <span>View-Once</span>
          </span>
        )}

        {resultData.expire_at && (
          <span className="inline-flex items-center space-x-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2.5 py-0.5 text-violet-400 font-medium">
            <Clock className="h-3 w-3" />
            <span>Expires: {new Date(resultData.expire_at).toLocaleString()}</span>
          </span>
        )}
      </div>
    </div>
  );
}
