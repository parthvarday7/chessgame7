'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import React, { useState } from 'react';

interface ShareLinkProps {
  roomId: string;
}

export const ShareLink: React.FC<ShareLinkProps> = ({ roomId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/game/${roomId}` : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="glass-panel p-3 rounded-xl flex items-center justify-between border border-slate-800">
      <div className="flex items-center space-x-2">
        <Share2 className="w-4 h-4 text-blue-400" />
        <span className="text-xs text-slate-400">Room Code:</span>
        <span className="font-mono font-bold text-sm tracking-wider text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          {roomId}
        </span>
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 active:scale-95 text-blue-400 text-xs font-semibold border border-blue-500/30 transition"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
};
