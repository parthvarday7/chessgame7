'use client';

import { Chess } from 'chess.js';
import {
  ChessMovePayload,
  GameOverDetails,
  MoveRecord,
  PieceColor,
  Player,
  RoomState,
  TimeControl,
} from '../types';

export interface P2PMessage {
  type:
    | 'join_request'
    | 'room_state'
    | 'move'
    | 'clock_tick'
    | 'game_over'
    | 'draw_offer'
    | 'draw_response'
    | 'rematch_offer'
    | 'rematch_accept';
  payload?: any;
}

export class P2PGameSession {
  private roomId: string;
  private isHost: boolean;
  private username: string;
  private playerId: string;
  private preferredColor: 'w' | 'b' | 'random';
  private timeControl: TimeControl;
  private chess: Chess;
  private bc: BroadcastChannel | null = null;
  private peer: any = null;
  private connections: any[] = [];
  private clockInterval: any = null;

  public roomState: RoomState;
  public yourColor: PieceColor = 'w';
  public onStateUpdate: (state: RoomState) => void = () => {};
  public onClockTick: (whiteMs: number, blackMs: number, turn: PieceColor) => void = () => {};
  public onNotification: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void = () => {};
  public onDrawOffer: (fromColor: PieceColor) => void = () => {};
  public onRematchOffer: (fromColor: PieceColor) => void = () => {};

  constructor(
    roomId: string,
    isHost: boolean,
    username: string,
    timeControl: TimeControl = { initialMinutes: 3, incrementSeconds: 2 },
    preferredColor: 'w' | 'b' | 'random' = 'random'
  ) {
    this.roomId = roomId.toUpperCase();
    this.isHost = isHost;
    this.username = username || (isHost ? 'Host' : 'Challenger');
    this.playerId = 'p2p_' + Math.random().toString(36).substring(2, 9);
    this.timeControl = timeControl;
    this.preferredColor = preferredColor;
    this.chess = new Chess();

    // Determine host color
    let hostColor: PieceColor = 'w';
    if (preferredColor === 'b') hostColor = 'b';
    else if (preferredColor === 'random') hostColor = Math.random() < 0.5 ? 'w' : 'b';

    this.yourColor = isHost ? hostColor : (hostColor === 'w' ? 'b' : 'w');

    const initialMs = timeControl.initialMinutes * 60 * 1000;
    const initialPlayer: Player = {
      id: this.playerId,
      socketId: this.playerId,
      username: this.username,
      color: hostColor,
      connected: true,
      timeRemainingMs: initialMs,
    };

    this.roomState = {
      roomId: this.roomId,
      fen: this.chess.fen(),
      turn: 'w',
      isCheck: false,
      status: 'waiting',
      timeControl,
      whitePlayer: hostColor === 'w' ? initialPlayer : null,
      blackPlayer: hostColor === 'b' ? initialPlayer : null,
      spectators: [],
      moveHistory: [],
      capturedPieces: { w: [], b: [] },
      lastMove: null,
      gameOver: null,
    };
  }

  public async start() {
    // 1. Setup BroadcastChannel for instant local / cross-tab connections
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`chess_p2p_${this.roomId}`);
        this.bc.onmessage = (event) => {
          this.handleIncomingMessage(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    // 2. Setup PeerJS for internet WebRTC connections
    if (typeof window !== 'undefined') {
      try {
        const PeerClass = (await import('peerjs')).default;
        const peerId = this.isHost
          ? `chess-p2p-${this.roomId}-host`
          : `chess-p2p-${this.roomId}-${this.playerId}`;

        this.peer = new PeerClass(peerId, {
          debug: 0,
        });

        this.peer.on('open', () => {
          if (!this.isHost) {
            // Joiner connects to host
            this.connectToHost();
          }
        });

        this.peer.on('connection', (conn: any) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.warn('PeerJS warning:', err.type);
          if (!this.isHost && (err.type === 'peer-unavailable' || err.type === 'network')) {
            // Retry connecting to host after short delay
            setTimeout(() => this.connectToHost(), 2000);
          }
        });
      } catch (e) {
        console.warn('PeerJS initialization error:', e);
      }
    }

    // If joiner, send join request on broadcast channel as well
    if (!this.isHost) {
      setTimeout(() => {
        this.broadcast({
          type: 'join_request',
          payload: {
            username: this.username,
            playerId: this.playerId,
          },
        });
      }, 500);
    }
  }

  private connectToHost() {
    if (!this.peer) return;
    try {
      const conn = this.peer.connect(`chess-p2p-${this.roomId}-host`, {
        reliable: true,
      });
      this.setupConnection(conn);
    } catch (e) {
      console.warn('connectToHost error:', e);
    }
  }

  private setupConnection(conn: any) {
    this.connections.push(conn);

    conn.on('open', () => {
      if (!this.isHost) {
        // Send join request to host
        conn.send({
          type: 'join_request',
          payload: {
            username: this.username,
            playerId: this.playerId,
          },
        });
      } else {
        // Host sends current room state to joiner
        conn.send({
          type: 'room_state',
          payload: {
            roomState: this.roomState,
            yourColor: this.yourColor === 'w' ? 'b' : 'w',
            yourPlayerId: this.playerId,
          },
        });
      }
    });

    conn.on('data', (data: any) => {
      this.handleIncomingMessage(data);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
    });
  }

  private broadcast(message: P2PMessage) {
    // Send to BroadcastChannel
    if (this.bc) {
      try {
        this.bc.postMessage(message);
      } catch (e) {}
    }
    // Send to all open WebRTC peer connections
    for (const conn of this.connections) {
      if (conn && conn.open) {
        try {
          conn.send(message);
        } catch (e) {}
      }
    }
  }

  private handleIncomingMessage(msg: P2PMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'join_request': {
        if (!this.isHost) return;
        const { username, playerId } = msg.payload;

        // If black player is not yet filled
        const joinerColor: PieceColor = this.yourColor === 'w' ? 'b' : 'w';
        const initialMs = this.timeControl.initialMinutes * 60 * 1000;

        const joinerPlayer: Player = {
          id: playerId,
          socketId: playerId,
          username: username || 'Challenger',
          color: joinerColor,
          connected: true,
          timeRemainingMs: initialMs,
        };

        if (joinerColor === 'w') {
          this.roomState.whitePlayer = joinerPlayer;
        } else {
          this.roomState.blackPlayer = joinerPlayer;
        }

        this.roomState.status = 'in_progress';
        this.startClock();

        this.onNotification(`${joinerPlayer.username} joined! Match started.`, 'success');
        this.onStateUpdate({ ...this.roomState });

        // Broadcast updated state to all peers
        this.broadcast({
          type: 'room_state',
          payload: {
            roomState: this.roomState,
            yourColor: joinerColor,
            yourPlayerId: playerId,
          },
        });
        break;
      }

      case 'room_state': {
        const { roomState, yourColor } = msg.payload;
        this.roomState = roomState;
        this.chess.load(roomState.fen);
        if (yourColor) {
          this.yourColor = yourColor;
        }
        this.onStateUpdate({ ...this.roomState });
        break;
      }

      case 'move': {
        const { move, san, fen, clocks } = msg.payload;
        try {
          this.chess.load(fen);
        } catch (e) {}

        this.roomState.fen = fen;
        this.roomState.turn = this.chess.turn() as PieceColor;
        this.roomState.isCheck = this.chess.inCheck();
        this.roomState.lastMove = { from: move.from, to: move.to };

        if (clocks) {
          if (this.roomState.whitePlayer) this.roomState.whitePlayer.timeRemainingMs = clocks.whiteMs;
          if (this.roomState.blackPlayer) this.roomState.blackPlayer.timeRemainingMs = clocks.blackMs;
          this.onClockTick(clocks.whiteMs, clocks.blackMs, this.roomState.turn);
        }

        this.roomState.moveHistory.push({
          from: move.from,
          to: move.to,
          san,
          color: (this.roomState.turn === 'w' ? 'b' : 'w') as PieceColor,
          piece: 'p',
          fen,
          timeRemainingMs: {
            w: clocks?.whiteMs || 0,
            b: clocks?.blackMs || 0,
          },
          timestamp: Date.now(),
        });

        this.checkGameEnd();
        this.onStateUpdate({ ...this.roomState });
        break;
      }

      case 'clock_tick': {
        const { whiteMs, blackMs, turn } = msg.payload;
        if (this.roomState.whitePlayer) this.roomState.whitePlayer.timeRemainingMs = whiteMs;
        if (this.roomState.blackPlayer) this.roomState.blackPlayer.timeRemainingMs = blackMs;
        this.onClockTick(whiteMs, blackMs, turn);
        break;
      }

      case 'game_over': {
        this.roomState.gameOver = msg.payload.details;
        this.roomState.status = 'checkmate';
        this.stopClock();
        this.onStateUpdate({ ...this.roomState });
        break;
      }

      case 'draw_offer': {
        this.onDrawOffer(msg.payload.fromColor);
        break;
      }

      case 'draw_response': {
        if (msg.payload.accept) {
          this.roomState.status = 'draw';
          this.roomState.gameOver = {
            reason: 'draw' as any,
            winner: 'draw',
            message: 'Game drawn by mutual agreement.',
          };
          this.stopClock();
          this.onStateUpdate({ ...this.roomState });
        } else {
          this.onNotification('Draw offer was declined.', 'info');
        }
        break;
      }

      case 'rematch_offer': {
        this.onRematchOffer(msg.payload.fromColor);
        break;
      }

      case 'rematch_accept': {
        this.roomState = msg.payload.roomState;
        this.chess.load(this.roomState.fen);
        if (this.isHost) this.startClock();
        this.onStateUpdate({ ...this.roomState });
        this.onNotification('Rematch started! Good luck.', 'success');
        break;
      }
    }
  }

  public makeMove(payload: ChessMovePayload): boolean {
    if (this.roomState.status !== 'in_progress') return false;
    if (this.roomState.turn !== this.yourColor) return false;

    try {
      const move = this.chess.move({
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion || 'q',
      });
      if (!move) return false;

      const nextFen = this.chess.fen();
      const nextTurn = this.chess.turn() as PieceColor;
      const isCheck = this.chess.inCheck();

      // Add increment
      const incMs = this.timeControl.incrementSeconds * 1000;
      if (this.yourColor === 'w' && this.roomState.whitePlayer) {
        this.roomState.whitePlayer.timeRemainingMs += incMs;
      } else if (this.yourColor === 'b' && this.roomState.blackPlayer) {
        this.roomState.blackPlayer.timeRemainingMs += incMs;
      }

      const clocks = {
        whiteMs: this.roomState.whitePlayer?.timeRemainingMs || 0,
        blackMs: this.roomState.blackPlayer?.timeRemainingMs || 0,
      };

      this.roomState.fen = nextFen;
      this.roomState.turn = nextTurn;
      this.roomState.isCheck = isCheck;
      this.roomState.lastMove = { from: move.from, to: move.to };

      this.roomState.moveHistory.push({
        from: move.from,
        to: move.to,
        san: move.san,
        color: this.yourColor,
        piece: move.piece,
        captured: move.captured,
        fen: nextFen,
        timeRemainingMs: {
          w: clocks.whiteMs,
          b: clocks.blackMs,
        },
        timestamp: Date.now(),
      });

      this.broadcast({
        type: 'move',
        payload: {
          move: payload,
          san: move.san,
          fen: nextFen,
          clocks,
        },
      });

      this.checkGameEnd();
      this.onStateUpdate({ ...this.roomState });
      return true;
    } catch (e) {
      console.warn('Move error:', e);
      return false;
    }
  }

  private checkGameEnd() {
    if (this.chess.isCheckmate()) {
      const winner = (this.roomState.turn === 'w' ? 'b' : 'w') as PieceColor;
      this.roomState.status = 'checkmate';
      this.roomState.gameOver = {
        reason: 'checkmate',
        winner,
        message: `Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins!`,
      };
      this.stopClock();
      this.broadcast({
        type: 'game_over',
        payload: { details: this.roomState.gameOver },
      });
    } else if (this.chess.isDraw()) {
      let reason: GameOverDetails['reason'] = 'stalemate';
      if (this.chess.isStalemate()) reason = 'stalemate';
      else if (this.chess.isThreefoldRepetition()) reason = 'threefold_repetition';
      else if (this.chess.isInsufficientMaterial()) reason = 'insufficient_material';

      this.roomState.status = 'draw';
      this.roomState.gameOver = {
        reason,
        winner: 'draw',
        message: `Game drawn by ${reason.replace(/_/g, ' ')}.`,
      };
      this.stopClock();
      this.broadcast({
        type: 'game_over',
        payload: { details: this.roomState.gameOver },
      });
    }
  }

  private startClock() {
    if (!this.isHost || this.clockInterval) return;
    this.clockInterval = setInterval(() => {
      if (this.roomState.status !== 'in_progress') return;

      const turn = this.roomState.turn;
      const player = turn === 'w' ? this.roomState.whitePlayer : this.roomState.blackPlayer;
      if (!player) return;

      player.timeRemainingMs = Math.max(0, player.timeRemainingMs - 1000);

      const whiteMs = this.roomState.whitePlayer?.timeRemainingMs || 0;
      const blackMs = this.roomState.blackPlayer?.timeRemainingMs || 0;

      this.onClockTick(whiteMs, blackMs, turn);
      this.broadcast({
        type: 'clock_tick',
        payload: { whiteMs, blackMs, turn },
      });

      if (player.timeRemainingMs <= 0) {
        const winner = (turn === 'w' ? 'b' : 'w') as PieceColor;
        this.roomState.status = 'timeout';
        this.roomState.gameOver = {
          reason: 'timeout',
          winner,
          message: `${winner === 'w' ? 'White' : 'Black'} wins on time!`,
        };
        this.stopClock();
        this.broadcast({
          type: 'game_over',
          payload: { details: this.roomState.gameOver },
        });
        this.onStateUpdate({ ...this.roomState });
      }
    }, 1000);
  }

  private stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  public resign() {
    const winner = (this.yourColor === 'w' ? 'b' : 'w') as PieceColor;
    this.roomState.status = 'resigned';
    this.roomState.gameOver = {
      reason: 'resignation',
      winner,
      message: `${this.yourColor === 'w' ? 'White' : 'Black'} resigned.`,
    };
    this.stopClock();
    this.broadcast({
      type: 'game_over',
      payload: { details: this.roomState.gameOver },
    });
    this.onStateUpdate({ ...this.roomState });
  }

  public offerDraw() {
    this.broadcast({
      type: 'draw_offer',
      payload: { fromColor: this.yourColor },
    });
    this.onNotification('Draw offer sent.', 'info');
  }

  public respondDraw(accept: boolean) {
    this.broadcast({
      type: 'draw_response',
      payload: { accept },
    });
    if (accept) {
      this.roomState.status = 'draw';
      this.roomState.gameOver = {
        reason: 'draw' as any,
        winner: 'draw',
        message: 'Game drawn by mutual agreement.',
      };
      this.stopClock();
      this.onStateUpdate({ ...this.roomState });
    }
  }

  public requestRematch() {
    this.broadcast({
      type: 'rematch_offer',
      payload: { fromColor: this.yourColor },
    });
    this.onNotification('Rematch requested.', 'info');
  }

  public destroy() {
    this.stopClock();
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.connections = [];
  }
}
