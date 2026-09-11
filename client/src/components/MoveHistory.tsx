'use client';

import { History } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { MoveRecord } from '../types';

interface MoveHistoryProps {
  moves: MoveRecord[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (White move, Black move)
  const movePairs: Array<{ number: number; white: MoveRecord; black?: MoveRecord }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [moves.length]);

  return (
    <div className="glass-panel rounded-xl flex flex-col h-[280px] border border-slate-800">
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold text-sm">
          <History className="w-4 h-4 text-blue-400" />
          <span>Move History</span>
        </div>
        <span className="text-xs text-slate-500">{moves.length} moves played</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {movePairs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 italic">
            Moves will appear here
          </div>
        ) : (
          <div className="space-y-1">
            {movePairs.map((pair) => (
              <div
                key={pair.number}
                className="grid grid-cols-5 py-1 px-2 rounded hover:bg-slate-800/50 transition-colors"
              >
                <span className="text-slate-500 font-medium col-span-1">{pair.number}.</span>
                <span className="text-slate-200 font-medium col-span-2">{pair.white.san}</span>
                <span className="text-slate-300 font-medium col-span-2">
                  {pair.black ? pair.black.san : ''}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
};
