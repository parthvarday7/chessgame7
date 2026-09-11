'use client';

import React from 'react';
import { PieceColor } from '../types';

interface PromotionModalProps {
  isOpen: boolean;
  color: PieceColor;
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({
  isOpen,
  color,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  const pieces: Array<{ type: 'q' | 'r' | 'b' | 'n'; label: string; symbol: string }> = [
    { type: 'q', label: 'Queen', symbol: color === 'w' ? '♕' : '♛' },
    { type: 'r', label: 'Rook', symbol: color === 'w' ? '♖' : '♜' },
    { type: 'b', label: 'Bishop', symbol: color === 'w' ? '♗' : '♝' },
    { type: 'n', label: 'Knight', symbol: color === 'w' ? '♘' : '♞' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel p-6 rounded-2xl max-w-sm w-full text-center border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-200">
        <h3 className="text-xl font-bold text-white mb-2">Promote Pawn</h3>
        <p className="text-sm text-slate-400 mb-6">Choose a piece for promotion</p>

        <div className="grid grid-cols-4 gap-3 mb-4">
          {pieces.map((p) => (
            <button
              key={p.type}
              onClick={() => onSelect(p.type)}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800/80 hover:bg-blue-600 hover:scale-105 active:scale-95 transition border border-slate-700 hover:border-blue-400 group"
            >
              <span className="text-4xl text-white group-hover:text-white drop-shadow-md select-none">
                {p.symbol}
              </span>
              <span className="text-xs font-semibold text-slate-300 mt-1">{p.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 underline"
        >
          Cancel move
        </button>
      </div>
    </div>
  );
};
