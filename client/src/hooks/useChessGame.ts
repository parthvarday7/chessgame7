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
import { P2PGameSession } from '../utils/p2pGame';

export function getStoredServerUrl(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const queryServer = params.get('server');
    if (queryServer) {
      try {
        localStorage.setItem('chess_server_url', queryServer.trim());
        return queryServer.trim();
      } catch (e) {}
    }
    try {
      const saved = localStorage.getItem('chess_server_url');
      if (saved) return saved.trim();
    } catch (e) {}

    // On HTTPS (e.g. Vercel), do not fallback to http://localhost because browsers block Mixed Content
    if (window.location.protocol === 'https:' && !process.env.NEXT_PUBLIC_SOCKET_URL) {
      return '';
    }
  }
  return process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
}

export function useChessGame(initialRoomId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const p2pSessionRef = useRef<P2PGameSession | null>(null);

  const [serverUrl, setServerUrlState] = useState<string>('');
  // Connected is true by default because P2P WebRTC network is always ready
  const [connected, setConnected] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'error' | 'unconfigured'>('connected');
  const [connectionError, setConnectionError] = useState<string | null>(null);

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

  // Initialize server URL on mount
  useEffect(() => {
    const initialUrl = getStoredServerUrl();
    setServerUrlState(initialUrl);
  }, []);

  const setCustomServerUrl = useCallback((newUrl: string) => {
    const trimmed = newUrl.trim();
    if (typeof window !== 'undefined') {
      try {
        if (trimmed) {
          localStorage.setItem('chess_server_url', trimmed);
        } else {
          localStorage.removeItem('chess_server_url');
        }
      } catch (e) {}
    }
    setServerUrlState(trimmed);
  }, []);

  // Socket connection attempt (optional, when backend URL is configured)
  useEffect(() => {
    if (!serverUrl) {
      setIsSocketConnected(false);
      setConnected(true); // P2P is always ready
      return;
    }

    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      setConnected(true);
      setConnectionStatus('connected');
      setConnectionError(null);
      addNotification('Connected to dedicated chess server', 'success');

      if (initialRoomId && initialRoomId !== 'LOCAL') {
        const storedSession = localStorage.getItem(`chess_session_${initialRoomId.toUpperCase()}`);
        if (storedSession) {
          try {
            const { playerId, username } = JSON.parse(storedSession);
            socket.emit('join_room', {
              roomId: initialRoomId.toUpperCase(),
              playerId,
              username,
            });
          } catch (e) {}
        }
      }
    });

    socket.on('connect_error', (err) => {
      setIsSocketConnected(false);
      // Even if socket fails, P2P network remains ready
      setConnected(true);
      setConnectionError(err.message || 'Server offline');
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
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

        if (data.roomState.whitePlayer && data.roomState.blackPlayer) {
          setClocks({
            whiteMs: data.roomState.whitePlayer.timeRemainingMs,
            blackMs: data.roomState.blackPlayer.timeRemainingMs,
          });
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

    socket.on('clock_tick', (data: { whiteTimeMs: number; blackTimeMs: number; turn: PieceColor }) => {
      setClocks({
        whiteMs: data.whiteTimeMs,
        blackMs: data.blackTimeMs,
      });
    });

    socket.on('game_over', (data: { details: GameOverDetails; roomState: RoomState }) => {
      setRoomState(data.roomState);
      addNotification(data.details.message, 'info');
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, initialRoomId, addNotification]);

  // P2P / WebRTC Session handling when in a game room
  useEffect(() => {
    if (!initialRoomId || initialRoomId === 'LOCAL') return;

    // Read stored P2P host configuration if created on this client
    let isHost = false;
    let timeControl: TimeControl = { initialMinutes: 3, incrementSeconds: 2 };
    let preferredColor: 'w' | 'b' | 'random' = 'random';
    let username = 'Player';

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`chess_p2p_room_${initialRoomId.toUpperCase()}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          isHost = Boolean(parsed.isHost);
          if (parsed.timeControl) timeControl = parsed.timeControl;
          if (parsed.preferredColor) preferredColor = parsed.preferredColor;
          if (parsed.username) username = parsed.username;
        } catch (e) {}
      }
    }

    const session = new P2PGameSession(
      initialRoomId,
      isHost,
      username,
      timeControl,
      preferredColor
    );
    p2pSessionRef.current = session;

    session.onStateUpdate = (state) => {
      setRoomState({ ...state });
      setYourColor(session.yourColor);
      if (state.whitePlayer && state.blackPlayer) {
        setClocks({
          whiteMs: state.whitePlayer.timeRemainingMs,
          blackMs: state.blackPlayer.timeRemainingMs,
        });
      }
    };

    session.onClockTick = (whiteMs, blackMs) => {
      setClocks({ whiteMs, blackMs });
    };

    session.onNotification = (msg, type) => {
      addNotification(msg, type);
    };

    session.onDrawOffer = (fromColor) => {
      setDrawOfferedBy(fromColor);
      addNotification('Opponent offered a draw.', 'info');
    };

    session.onRematchOffer = (fromColor) => {
      setRematchOfferedBy(fromColor);
      addNotification('Opponent offered a rematch!', 'info');
    };

    // Set initial room state
    setRoomState(session.roomState);
    setYourColor(session.yourColor);

    session.start();

    return () => {
      session.destroy();
      p2pSessionRef.current = null;
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

  // Actions
  const createRoom = useCallback(
    (timeControl: TimeControl, preferredColor: 'w' | 'b' | 'random' = 'w', username: string = 'Player 1') => {
      if (isSocketConnected && socketRef.current?.connected) {
        socketRef.current.emit('create_room', { timeControl, preferredColor, username });
      } else {
        // P2P instant room code generation
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        try {
          localStorage.setItem(
            `chess_p2p_room_${code}`,
            JSON.stringify({
              roomId: code,
              isHost: true,
              timeControl,
              preferredColor,
              username,
            })
          );
        } catch (e) {}

        if (typeof window !== 'undefined') {
          window.location.href = `/game/${code}`;
        }
      }
    },
    [isSocketConnected]
  );

  const joinRoom = useCallback((roomId: string, username: string = 'Player 2') => {
    if (isSocketConnected && socketRef.current?.connected) {
      socketRef.current.emit('join_room', {
        roomId: roomId.toUpperCase(),
        username,
      });
    }
  }, [isSocketConnected]);

  const makeMove = useCallback(
    (move: ChessMovePayload) => {
      if (p2pSessionRef.current) {
        p2pSessionRef.current.makeMove(move);
        return;
      }
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
    if (p2pSessionRef.current) {
      p2pSessionRef.current.resign();
      return;
    }
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('resign', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
  }, [roomState, yourPlayerId]);

  const offerDraw = useCallback(() => {
    if (p2pSessionRef.current) {
      p2pSessionRef.current.offerDraw();
      return;
    }
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('offer_draw', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
    addNotification('Draw offer sent to opponent.', 'info');
  }, [roomState, yourPlayerId, addNotification]);

  const respondDraw = useCallback(
    (accept: boolean) => {
      if (p2pSessionRef.current) {
        p2pSessionRef.current.respondDraw(accept);
        return;
      }
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
    if (p2pSessionRef.current) {
      p2pSessionRef.current.requestRematch();
      return;
    }
    if (!roomState || !yourPlayerId) return;
    socketRef.current?.emit('request_rematch', {
      roomId: roomState.roomId,
      playerId: yourPlayerId,
    });
    addNotification('Rematch requested. Waiting for opponent...', 'info');
  }, [roomState, yourPlayerId, addNotification]);

  return {
    socket: socketRef.current,
    serverUrl,
    setCustomServerUrl,
    connectionStatus,
    connectionError,
    connected,
    isSocketConnected,
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
