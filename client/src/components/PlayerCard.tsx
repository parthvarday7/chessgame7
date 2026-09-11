'use client';

import { Shield, User, Wifi, WifiOff } from 'lucide-react';
import React from 'react';
import { PieceColor, Player } from '../types';

interface PlayerCardProps {
  player: Player | null;
  color: PieceColor;
  timeMs: number;
  isActiveTurn: boolean;
  capturedPieces: string[]; // Pieces this player captured
  isYou: boolean;
}

const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  color,
  timeMs,
  isActiveTurn,
  capturedPieces,
  isYou,
}) => {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (totalSeconds < 20 && ms > 0) {
      const tenths = Math.floor((ms % 1000) / 100);
      return `${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}.${tenths}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeMs < 30000 && timeMs > 0;
  const isExpired = timeMs <= 0;

  return (
    <div
      className={`glass-panel p-4 rounded-xl flex items-center justify-between border transition-all duration-300 ${
        isActiveTurn
          ? 'border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.25)] bg-slate-800/80'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      {/* Player info & captured pieces */}
      <div className="flex items-center space-x-3">
        {/* Color Avatar Icon */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center font-bold shadow-md border ${
            color === 'w'
              ? 'bg-slate-100 text-slate-900 border-slate-300'
              : 'bg-slate-950 text-slate-100 border-slate-700'
          }`}
        >
          {color === 'w' ? 'W' : 'B'}
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-slate-100 truncate max-w-[140px]">
              {player ? player.username : 'Waiting for player...'}
            </span>
            {isYou && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                YOU
              </span>
            )}
            {player && (
              <span title={player.connected ? 'Online' : 'Disconnected (reconnecting)'}>
                {player.connected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                )}
              </span>
            )}
          </div>

          {/* Captured pieces */}
          <div className="flex items-center space-x-1 mt-1 min-h-[18px]">
            {capturedPieces.length > 0 ? (
              capturedPieces.map((p, idx) => (
                <span
                  key={idx}
                  className="text-xs text-slate-400 font-serif leading-none select-none"
                  title={`Captured ${p}`}
                >
                  {PIECE_SYMBOLS[p] || p}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-500">No captures</span>
            )}
          </div>
        </div>
      </div>

      {/* Authoritative Clock display */}
      <div
        className={`px-4 py-2 rounded-lg font-mono text-xl font-bold tracking-wider transition-colors duration-200 border ${
          isExpired
            ? 'bg-rose-950/80 text-rose-400 border-rose-800'
            : isLowTime
            ? 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
            : isActiveTurn
            ? 'bg-blue-950 text-blue-300 border-blue-700'
            : 'bg-slate-950 text-slate-400 border-slate-800'
        }`}
      >
        {formatTime(timeMs)}
      </div>
    </div>
  );
};
