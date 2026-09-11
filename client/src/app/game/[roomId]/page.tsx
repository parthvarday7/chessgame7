'use client';

import { Flag, Handshake, Home, MessageSquare, Swords, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { ChessBoardView } from '../../../components/ChessBoardView';
import { GameOverModal } from '../../../components/GameOverModal';
import { MoveHistory } from '../../../components/MoveHistory';
import { PlayerCard } from '../../../components/PlayerCard';
import { ShareLink } from '../../../components/ShareLink';
import { useChessGame } from '../../../hooks/useChessGame';

export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params.roomId as string)?.toUpperCase();

  const {
    connected,
    roomState,
    yourPlayerId,
    yourColor,
    isSpectator,
    clocks,
    notifications,
    drawOfferedBy,
    rematchOfferedBy,
    joinRoom,
    makeMove,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
  } = useChessGame(roomId);

  // Auto-join room when connected
  useEffect(() => {
    if (connected && roomId) {
      joinRoom(roomId);
    }
  }, [connected, roomId, joinRoom]);

  // Derive opponent & you players
  const whitePlayer = roomState?.whitePlayer || null;
  const blackPlayer = roomState?.blackPlayer || null;

  // Determine who is top card vs bottom card
  const isPlayerBlack = yourColor === 'b';
  const topPlayer = isPlayerBlack ? whitePlayer : blackPlayer;
  const topColor = isPlayerBlack ? 'w' : 'b';
  const topTime = isPlayerBlack ? clocks.whiteMs : clocks.blackMs;

  const bottomPlayer = isPlayerBlack ? blackPlayer : whitePlayer;
  const bottomColor = isPlayerBlack ? 'b' : 'w';
  const bottomTime = isPlayerBlack ? clocks.blackMs : clocks.whiteMs;

  const isGameActive = roomState?.status === 'in_progress';

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push('/')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
            title="Back to Lobby"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-2">
            <Swords className="w-5 h-5 text-blue-400" />
            <span className="font-extrabold text-base tracking-tight text-white">Online Chess</span>
          </div>
        </div>

        {/* Room Status Badge */}
        <div className="flex items-center space-x-3">
          {isSpectator && (
            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold flex items-center space-x-1">
              <Users className="w-3.5 h-3.5" />
              <span>Spectator Mode</span>
            </span>
          )}
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              isGameActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {roomState ? roomState.status.replace(/_/g, ' ') : 'Connecting...'}
          </span>
        </div>
      </header>

      {/* Main Content Grid: Board + Side Panel */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center: Board & Player Cards */}
        <div className="lg:col-span-8 flex flex-col items-center space-y-3 w-full">
          {/* Top Player Card (Opponent or Black by default) */}
          <div className="w-full max-w-[560px]">
            <PlayerCard
              player={topPlayer}
              color={topColor}
              timeMs={topTime}
              isActiveTurn={roomState?.turn === topColor && isGameActive}
              capturedPieces={
                topColor === 'w'
                  ? roomState?.capturedPieces.w || []
                  : roomState?.capturedPieces.b || []
              }
              isYou={Boolean(yourColor && yourColor === topColor)}
            />
          </div>

          {/* Chessboard View */}
          <ChessBoardView
            fen={roomState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
            isCheck={Boolean(roomState?.isCheck)}
            turn={roomState?.turn || 'w'}
            lastMove={roomState?.lastMove || null}
            yourColor={yourColor}
            isSpectator={isSpectator}
            isGameActive={isGameActive}
            onMakeMove={makeMove}
          />

          {/* Bottom Player Card (You or White by default) */}
          <div className="w-full max-w-[560px]">
            <PlayerCard
              player={bottomPlayer}
              color={bottomColor}
              timeMs={bottomTime}
              isActiveTurn={roomState?.turn === bottomColor && isGameActive}
              capturedPieces={
                bottomColor === 'w'
                  ? roomState?.capturedPieces.w || []
                  : roomState?.capturedPieces.b || []
              }
              isYou={Boolean(yourColor && yourColor === bottomColor)}
            />
          </div>
        </div>

        {/* Right Side Panel: Match Info, Move History, Controls */}
        <div className="lg:col-span-4 flex flex-col space-y-4 w-full">
          {/* Share Room Link */}
          <ShareLink roomId={roomId} />

          {/* Draw Offer Banner */}
          {drawOfferedBy && drawOfferedBy !== yourColor && (
            <div className="glass-panel p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 animate-pulse">
              <div className="flex items-center space-x-2 font-semibold text-sm mb-2">
                <Handshake className="w-4 h-4 text-amber-400" />
                <span>Draw Offered</span>
              </div>
              <p className="text-xs text-amber-300/80 mb-3">
                Your opponent has proposed a draw. Do you accept?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => respondDraw(true)}
                  className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold text-xs text-white transition"
                >
                  Accept Draw
                </button>
                <button
                  onClick={() => respondDraw(false)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Move History */}
          <MoveHistory moves={roomState?.moveHistory || []} />

          {/* Match Action Controls */}
          {!isSpectator && isGameActive && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={offerDraw}
                className="py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Handshake className="w-4 h-4 text-slate-400" />
                <span>Offer Draw</span>
              </button>
              <button
                onClick={resign}
                className="py-2.5 px-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 border border-rose-800/50 text-rose-300 hover:text-rose-200 text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-sm"
              >
                <Flag className="w-4 h-4 text-rose-400" />
                <span>Resign</span>
              </button>
            </div>
          )}

          {/* Notification Toasts */}
          {notifications.length > 0 && (
            <div className="space-y-2 pt-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl text-xs font-medium border animate-in slide-in-from-right duration-200 ${
                    n.type === 'error'
                      ? 'bg-rose-950/70 border-rose-800 text-rose-200'
                      : n.type === 'warning'
                      ? 'bg-amber-950/70 border-amber-800 text-amber-200'
                      : n.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-800 text-emerald-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}
                >
                  {n.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Game Over Modal */}
      <GameOverModal
        gameOver={roomState?.gameOver || null}
        yourColor={yourColor}
        rematchOfferedBy={rematchOfferedBy}
        onRequestRematch={requestRematch}
        onReturnHome={() => router.push('/')}
      />
    </div>
  );
}
