'use client';

import { ArrowRight, Clock, Dices, Play, Plus, Swords, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useChessGame } from '../hooks/useChessGame';
import { TimeControl } from '../types';

const PRESET_TIME_CONTROLS: Array<{
  label: string;
  type: string;
  initialMinutes: number;
  incrementSeconds: number;
}> = [
  { label: '1 min', type: 'Bullet', initialMinutes: 1, incrementSeconds: 0 },
  { label: '1 | 1', type: 'Bullet', initialMinutes: 1, incrementSeconds: 1 },
  { label: '3 | 2', type: 'Blitz', initialMinutes: 3, incrementSeconds: 2 },
  { label: '5 min', type: 'Blitz', initialMinutes: 5, incrementSeconds: 0 },
  { label: '10 min', type: 'Rapid', initialMinutes: 10, incrementSeconds: 0 },
  { label: '15 | 10', type: 'Rapid', initialMinutes: 15, incrementSeconds: 10 },
];

export default function LobbyPage() {
  const router = useRouter();
  const { createRoom, joinRoom, socket, connected } = useChessGame();

  const [username, setUsername] = useState('Grandmaster');
  const [selectedPreset, setSelectedPreset] = useState(2); // 3|2 Blitz by default
  const [colorPreference, setColorPreference] = useState<'w' | 'b' | 'random'>('random');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGame = () => {
    if (!connected) return;
    setIsCreating(true);

    const tc = PRESET_TIME_CONTROLS[selectedPreset];
    const timeControl: TimeControl = {
      initialMinutes: tc.initialMinutes,
      incrementSeconds: tc.incrementSeconds,
    };

    // Listen for room_created event to navigate
    if (socket) {
      socket.once('room_created', (data: { roomId: string }) => {
        router.push(`/game/${data.roomId}`);
      });
    }

    createRoom(timeControl, colorPreference, username);
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomCode.trim()) return;
    setIsJoining(true);
    router.push(`/game/${joinRoomCode.trim().toUpperCase()}`);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header */}
      <div className="text-center mb-10 max-w-lg">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4 backdrop-blur-sm">
          <Swords className="w-4 h-4" />
          <span>Real-Time Authoritative Chess</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Master the Board
        </h1>
        <p className="text-slate-400 mt-3 text-sm sm:text-base">
          Play 1v1 live chess with server-authoritative move validation, Blitz & Rapid clocks, and instant spectator sharing.
        </p>
      </div>

      {/* Main Grid: Create Game & Join Game */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {/* Card 1: Create Game */}
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Create a Match</h2>
                <p className="text-xs text-slate-400">Generate a private room and invite a friend</p>
              </div>
            </div>

            {/* Username Input */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Your Handle
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm font-medium transition"
                placeholder="Enter player name"
              />
            </div>

            {/* Time Control Selector */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Time Control
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {PRESET_TIME_CONTROLS.map((tc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPreset(idx)}
                    className={`py-2.5 px-2 rounded-xl text-center border transition flex flex-col items-center justify-center ${
                      selectedPreset === idx
                        ? 'bg-blue-600/30 border-blue-500 text-white shadow-md'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold text-sm">{tc.label}</span>
                    <span className="text-[10px] text-slate-400 uppercase mt-0.5">{tc.type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Preference */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Piece Color
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setColorPreference('w')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    colorPreference === 'w'
                      ? 'bg-white text-slate-900 border-white font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white border border-slate-400 inline-block" />
                  <span>White</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorPreference('random')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    colorPreference === 'random'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Random</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColorPreference('b')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition ${
                    colorPreference === 'b'
                      ? 'bg-slate-950 text-white border-slate-600 font-bold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-black border border-slate-700 inline-block" />
                  <span>Black</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateGame}
            disabled={!connected || isCreating}
            className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white shadow-lg shadow-blue-500/25 transition active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isCreating ? 'Creating Room...' : 'Create Private Room'}</span>
          </button>
        </div>

        {/* Card 2: Join Game & Quick Info */}
        <div className="flex flex-col space-y-6">
          {/* Join by Code */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-700/80 shadow-2xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Join by Code</h2>
                <p className="text-xs text-slate-400">Enter a 6-character room code</p>
              </div>
            </div>

            <form onSubmit={handleJoinGame} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={joinRoomCode}
                  onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
                  placeholder="e.g. UYSJ3U"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder-slate-600 font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 uppercase transition"
                />
              </div>

              <button
                type="submit"
                disabled={!joinRoomCode.trim() || isJoining}
                className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 font-bold text-white shadow-lg shadow-purple-500/25 transition active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <span>Join Game</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Quick Features Highlight */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-3">
            <div className="flex items-center space-x-2.5 text-slate-300 font-semibold">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Server-Authoritative Clock</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Every millisecond is tracked server-side with instantaneous flag-fall detection and automatic increments.
            </p>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>Server Status:</span>
              <span className={`font-semibold ${connected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {connected ? 'Online & Ready' : 'Connecting to server...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
