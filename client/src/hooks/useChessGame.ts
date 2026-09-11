'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ChessMovePayload,
  GameNotification,
  GameOverDetails,
  MoveRecord,
  PieceColor,
  RoomState,
  TimeControl,
} from '../types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export function useChessGame(initialRoomId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [yourPlayerId, setYourPlayerId] = useState<string | null>(null);
  const [yourColor, setYourColor] = useState<PieceColor | null>(null);
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [clocks, setClocks] = useState<{ whiteMs: number; blackMs: number }>({
    whiteMs: 600000,
    blackMs: 600000,
  });
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(
    null
  );
  const [drawOfferedBy, setDrawOfferedBy] = useState<PieceColor | null>(null);
  const [rematchOfferedBy, setRematchOfferedBy] = useState<PieceColor | null>(null);

  const addNotification = useCallback((message: string, type: GameNotification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      addNotification('Connected to chess server', 'success');

      // Auto-reconnect if roomId exists and session was stored in localStorage
      if (initialRoomId) {
        const storedSession = localStorage.getItem(`chess_session_${initialRoomId.toUpperCase()}`);
        if (storedSession) {
          try {
            const { playerId, username } = JSON.parse(storedSession);
            socket.emit('join_room', {
              roomId: initialRoomId.toUpperCase(),
              playerId,
              username,
            });
          } catch (e) {
            console.error('Failed to parse session:', e);
          }
        }
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addNotification('Disconnected from server. Reconnecting...', 'warning');
    });

    socket.on('room_created', (data: { roomId: string; playerId: string; color: PieceColor }) => {
      setYourPlayerId(data.playerId);
      setYourColor(data.color);
      setIsSpectator(false);
      localStorage.setItem(
        `chess_session_${data.roomId}`,
        JSON.stringify({ playerId: data.playerId })
      );
    });

    socket.on(
      'game_joined',
      (data: {
        roomState: RoomState;
        yourPlayerId?: string;
        yourColor?: PieceColor;
        isSpectator: boolean;
      }) => {
        setRoomState(data.roomState);
        setIsSpectator(data.isSpectator);
        if (data.yourPlayerId) setYourPlayerId(data.yourPlayerId);
        if (data.yourColor) setYourColor(data.yourColor);

        // Update local clocks from server
        if (data.roomState.whitePlayer && data.roomState.blackPlayer) {
          setClocks({
            whiteMs: data.roomState.whitePlayer.timeRemainingMs,
            blackMs: data.roomState.blackPlayer.timeRemainingMs,
          });
        }

        if (data.yourPlayerId && data.roomState.roomId) {
          localStorage.setItem(
            `chess_session_${data.roomState.roomId}`,
            JSON.stringify({ playerId: data.yourPlayerId })
          );
        }
      }
    );

    socket.on('game_started', (data: { roomState: RoomState }) => {
      setRoomState(data.roomState);
      addNotification('Opponent joined! The game has started.', 'success');
    });

    socket.on('move_made', (data: { move: MoveRecord; roomState: RoomState }) => {
      setRoomState(data.roomState);
      setClocks({
        whiteMs: data.roomState.whitePlayer?.timeRemainingMs || 0,
        blackMs: data.roomState.blackPlayer?.timeRemainingMs || 0,
      });
      setDrawOfferedBy(null);
    });

    socket.on('move_rejected', (data: { error: string }) => {
      addNotification(`Move rejected: ${data.error}`, 'error');
    });

    socket.on('clock_tick', (data: { whiteTimeMs: number; blackTimeMs: number; turn: PieceColor }) => {
      setClocks({
        whiteMs: data.whiteTimeMs,
        blackMs: data.blackTimeMs,
      });
    });

    socket.on('player_disconnected', (data: { color: PieceColor; username: string; gracePeriodSeconds: number }) => {
      addNotification(
        `${data.username} disconnected. They have ${data.gracePeriodSeconds}s to reconnect.`,
        'warning'
      );
    });

    socket.on('player_reconnected', (data: { color: PieceColor; roomState: RoomState }) => {
      setRoomState(data.roomState);
      addNotification(`Player reconnected! Game resumes.`, 'info');
    });

    socket.on('game_over', (data: { details: GameOverDetails; roomState: RoomState }) => {
      setRoomState(data.roomState);
      addNotification(data.details.message, 'info');
    });

    socket.on('draw_offered', (data: { fromColor: PieceColor }) => {
      setDrawOfferedBy(data.fromColor);
      addNotification('Opponent offered a draw.', 'info');
    });

    socket.on('draw_declined', () => {
      setDrawOfferedBy(null);
      addNotification('Draw offer was declined.', 'info');
    });

    socket.on('rematch_offered', (data: { fromColor: PieceColor }) => {
      setRematchOfferedBy(data.fromColor);
      addNotification('Opponent offered a rematch!', 'info');
    });

    socket.on('rematch_started', (data: { roomState: RoomState }) => {
      setRoomState(data.roomState);
      setRematchOfferedBy(null);
      setDrawOfferedBy(null);
      addNotification('Rematch started! Good luck.', 'success');
    });

    socket.on('error_message', (data: { message: string }) => {
      addNotification(data.message, 'error');
    });

    return () => {
      socket.disconnect();
    };
  }, [initialRoomId, addNotification]);

  // Client-side smooth timer decrement (interpolated every 100ms)
  useEffect(() => {
    if (!roomState || roomState.status !== 'in_progress') return;

    const interval = setInterval(() => {
      setClocks((prev) => {
        if (roomState.turn === 'w') {
          return { ...prev, whiteMs: Math.max(0, prev.whiteMs - 100) };
        } else {
          return { ...prev, blackMs: Math.max(0, prev.blackMs - 100) };
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [roomState?.status, roomState?.turn]);

  // Action dispatches
  const createRoom = useCallback(
    (timeControl: TimeControl, preferredColor: 'w' | 'b' | 'random' = 'w', username: string = 'Player 1') => {
      socketRef.current?.emit('create_room', { timeControl, preferredColor, username });
    },
    []
  );

  const joinRoom = useCallback((roomId: string, username: string = 'Player 2') => {
    const storedSession = localStorage.getItem(`chess_session_${roomId.toUpperCase()}`);
    let playerId: string | undefined = undefined;
    if (storedSession) {
      try {
        playerId = JSON.parse(storedSession).playerId;
      } catch (e) {}
    }
    socketRef.current?.emit('join_room', {
      roomId: roomId.toUpperCase(),
      username,
      playerId,
    });
  }, []);

  const makeMove = useCallback(
    (move: ChessMovePayload) => {
      if (!roomState || !yourPlayerId) return;
      socketRef.current?.emit('make_move', {
        roomId: roomState.roomId,
        playerId: yourPlayerId,
        move,
      });
    },
    [roomState, yourPlayerId]
  );

  const resign = useCallback(() => {
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('resign', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
  }, [roomState, yourPlayerId]);

  const offerDraw = useCallback(() => {
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('offer_draw', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
    addNotification('Draw offer sent to opponent.', 'info');
  }, [roomState, yourPlayerId, addNotification]);

  const respondDraw = useCallback(
    (accept: boolean) => {
      if (!roomState || !yourPlayerId) return;
      socketRef.current?.emit('respond_draw', {
        roomId: roomState.roomId,
        playerId: yourPlayerId,
        accept,
      });
      setDrawOfferedBy(null);
    },
    [roomState, yourPlayerId]
  );

  const requestRematch = useCallback(() => {
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('request_rematch', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
    addNotification('Rematch requested. Waiting for opponent...', 'info');
  }, [roomState, yourPlayerId, addNotification]);

  return {
    socket: socketRef.current,
    connected,
    roomState,
    yourPlayerId,
    yourColor,
    isSpectator,
    clocks,
    notifications,
    pendingPromotion,
    setPendingPromotion,
    drawOfferedBy,
    rematchOfferedBy,
    createRoom,
    joinRoom,
    makeMove,
    resign,
    offerDraw,
    respondDraw,
    requestRematch,
  };
}
