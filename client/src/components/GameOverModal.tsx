'use client';

import confetti from 'canvas-confetti';
import { Award, Home, RefreshCw } from 'lucide-react';
import React, { useEffect } from 'react';
import { GameOverDetails, PieceColor } from '../types';

interface GameOverModalProps {
  gameOver: GameOverDetails | null;
  yourColor: PieceColor | null;
  rematchOfferedBy: PieceColor | null;
  onRequestRematch: () => void;
  onReturnHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  gameOver,
  yourColor,
  rematchOfferedBy,
  onRequestRematch,
  onReturnHome,
}) => {
  if (!gameOver) return null;

  const isWinner = yourColor && gameOver.winner === yourColor;
  const isDraw = gameOver.winner === 'draw';

  useEffect(() => {
    if (isWinner) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
      });
    }
  }, [isWinner]);

  const opponentColor = yourColor === 'w' ? 'b' : 'w';
  const opponentWantsRematch = rematchOfferedBy === opponentColor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border border-slate-700 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-30 ${
            isWinner ? 'bg-emerald-500' : isDraw ? 'bg-blue-500' : 'bg-rose-500'
          }`}
        />

        <div className="relative z-10">
          <div className="inline-flex p-3 rounded-2xl bg-slate-800 border border-slate-700 mb-4 shadow-inner">
            <Award
              className={`w-10 h-10 ${
                isWinner
                  ? 'text-emerald-400'
                  : isDraw
                  ? 'text-blue-400'
                  : 'text-slate-400'
              }`}
            />
          </div>

          <h2 className="text-2xl font-extrabold text-white mb-1">
            {isWinner
              ? 'Victory!'
              : isDraw
              ? 'Draw!'
              : yourColor
              ? 'Defeat'
              : 'Game Over'}
          </h2>

          <p className="text-slate-300 font-medium text-base mb-2">{gameOver.message}</p>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-6">
            Ended by {gameOver.reason.replace(/_/g, ' ')}
          </p>

          {opponentWantsRematch && (
            <div className="mb-4 py-2 px-3 rounded-lg bg-blue-900/40 border border-blue-700/50 text-blue-300 text-xs font-semibold animate-pulse">
              Opponent wants a rematch! Click below to accept.
            </div>
          )}

          <div className="flex flex-col space-y-3">
            <button
              onClick={onRequestRematch}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] font-bold text-white shadow-lg shadow-blue-500/25 transition flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{opponentWantsRematch ? 'Accept Rematch' : 'Request Rematch'}</span>
            </button>

            <button
              onClick={onReturnHome}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] font-semibold text-slate-300 border border-slate-700 transition flex items-center justify-center space-x-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to Lobby</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
