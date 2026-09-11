import crypto from 'crypto';
import { ChessGame } from '../game/ChessGame';
import { ChessTimer } from '../game/ChessTimer';
import {
  CreateRoomPayload,
  GameOverDetails,
  PieceColor,
  Player,
  RoomState,
  Spectator,
} from '../types';

export interface InternalRoom {
  id: string;
  game: ChessGame;
  timer: ChessTimer;
  timeControl: CreateRoomPayload['timeControl'];
  whitePlayer: Player | null;
  blackPlayer: Player | null;
  spectators: Spectator[];
  status: RoomState['status'];
  gameOverDetails: GameOverDetails | null;
  disconnectGraceTimer: NodeJS.Timeout | null;
  drawOfferFrom: PieceColor | null;
  rematchRequestedBy: Set<string>; // player IDs
  createdAt: number;
}

export class RoomStore {
  private rooms: Map<string, InternalRoom> = new Map();
  // Reverse lookup: socketId -> { roomId, isPlayer: boolean, playerId?: string }
  private socketRoomMap: Map<string, { roomId: string; isPlayer: boolean; playerId?: string }> =
    new Map();

  public generateRoomId(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars (I, 1, O, 0)
    let id = '';
    do {
      id = '';
      const bytes = crypto.randomBytes(length);
      for (let i = 0; i < length; i++) {
        id += chars[bytes[i] % chars.length];
      }
    } while (this.rooms.has(id));
    return id;
  }

  public createRoom(
    socketId: string,
    payload: CreateRoomPayload,
    onTick: (roomId: string, whiteTimeMs: number, blackTimeMs: number, turn: PieceColor) => void,
    onTimeout: (roomId: string, loser: PieceColor) => void
  ): { room: InternalRoom; creatorPlayer: Player } {
    const roomId = this.generateRoomId();
    const playerId = crypto.randomUUID();
    const username = payload.username?.trim() || 'Player 1';

    // Determine color preference
    let assignedColor: PieceColor = 'w';
    if (payload.preferredColor === 'b') {
      assignedColor = 'b';
    } else if (payload.preferredColor === 'random') {
      assignedColor = Math.random() < 0.5 ? 'w' : 'b';
    }

    const creatorPlayer: Player = {
      id: playerId,
      socketId,
      username,
      color: assignedColor,
      connected: true,
      timeRemainingMs: payload.timeControl.initialMinutes * 60 * 1000,
    };

    const timer = new ChessTimer(payload.timeControl, {
      onTick: (w, b, turn) => onTick(roomId, w, b, turn),
      onTimeout: (loser) => onTimeout(roomId, loser),
    });

    const room: InternalRoom = {
      id: roomId,
      game: new ChessGame(),
      timer,
      timeControl: payload.timeControl,
      whitePlayer: assignedColor === 'w' ? creatorPlayer : null,
      blackPlayer: assignedColor === 'b' ? creatorPlayer : null,
      spectators: [],
      status: 'waiting',
      gameOverDetails: null,
      disconnectGraceTimer: null,
      drawOfferFrom: null,
      rematchRequestedBy: new Set(),
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.socketRoomMap.set(socketId, { roomId, isPlayer: true, playerId });

    return { room, creatorPlayer };
  }

  public getRoom(roomId: string): InternalRoom | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  public getMappingBySocket(socketId: string) {
    return this.socketRoomMap.get(socketId);
  }

  public removeSocketMapping(socketId: string): void {
    this.socketRoomMap.delete(socketId);
  }

  public joinRoom(
    roomId: string,
    socketId: string,
    username?: string,
    reconnectingPlayerId?: string
  ): {
    success: boolean;
    room?: InternalRoom;
    role?: 'player' | 'spectator';
    player?: Player;
    spectator?: Spectator;
    isReconnect?: boolean;
    error?: string;
  } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // 1. Reconnection check by playerId
    if (reconnectingPlayerId) {
      if (room.whitePlayer && room.whitePlayer.id === reconnectingPlayerId) {
        // White player reconnecting
        room.whitePlayer.socketId = socketId;
        room.whitePlayer.connected = true;
        room.whitePlayer.disconnectedAt = undefined;

        if (room.disconnectGraceTimer) {
          clearTimeout(room.disconnectGraceTimer);
          room.disconnectGraceTimer = null;
        }

        this.socketRoomMap.set(socketId, { roomId: room.id, isPlayer: true, playerId: room.whitePlayer.id });
        return { success: true, room, role: 'player', player: room.whitePlayer, isReconnect: true };
      }

      if (room.blackPlayer && room.blackPlayer.id === reconnectingPlayerId) {
        // Black player reconnecting
        room.blackPlayer.socketId = socketId;
        room.blackPlayer.connected = true;
        room.blackPlayer.disconnectedAt = undefined;

        if (room.disconnectGraceTimer) {
          clearTimeout(room.disconnectGraceTimer);
          room.disconnectGraceTimer = null;
        }

        this.socketRoomMap.set(socketId, { roomId: room.id, isPlayer: true, playerId: room.blackPlayer.id });
        return { success: true, room, role: 'player', player: room.blackPlayer, isReconnect: true };
      }
    }

    // 2. Joining as second player if an open seat exists
    if (!room.whitePlayer || !room.blackPlayer) {
      const neededColor: PieceColor = room.whitePlayer ? 'b' : 'w';
      const newPlayerId = crypto.randomUUID();
      const playerName = username?.trim() || `Player 2`;

      const newPlayer: Player = {
        id: newPlayerId,
        socketId,
        username: playerName,
        color: neededColor,
        connected: true,
        timeRemainingMs: room.timeControl.initialMinutes * 60 * 1000,
      };

      if (neededColor === 'w') {
        room.whitePlayer = newPlayer;
      } else {
        room.blackPlayer = newPlayer;
      }

      // Both players are present now! Start the game and clock
      room.status = 'in_progress';
      room.timer.start();

      this.socketRoomMap.set(socketId, { roomId: room.id, isPlayer: true, playerId: newPlayerId });

      return { success: true, room, role: 'player', player: newPlayer, isReconnect: false };
    }

    // 3. Joining as spectator if both player seats are occupied
    const spectatorId = crypto.randomUUID();
    const spectator: Spectator = {
      id: spectatorId,
      socketId,
      username: username?.trim() || `Spectator ${room.spectators.length + 1}`,
    };

    room.spectators.push(spectator);
    this.socketRoomMap.set(socketId, { roomId: room.id, isPlayer: false });

    return { success: true, room, role: 'spectator', spectator, isReconnect: false };
  }

  public handleDisconnect(
    socketId: string,
    onGracePeriodExpire: (roomId: string, forfeitingPlayer: Player) => void
  ): {
    room?: InternalRoom;
    disconnectedPlayer?: Player;
    isSpectator?: boolean;
  } {
    const mapping = this.socketRoomMap.get(socketId);
    if (!mapping) return {};

    const room = this.rooms.get(mapping.roomId);
    this.socketRoomMap.delete(socketId);

    if (!room) return {};

    if (!mapping.isPlayer) {
      // Spectator disconnected
      room.spectators = room.spectators.filter((s) => s.socketId !== socketId);
      return { room, isSpectator: true };
    }

    // Find disconnected player
    const player =
      room.whitePlayer?.id === mapping.playerId
        ? room.whitePlayer
        : room.blackPlayer?.id === mapping.playerId
        ? room.blackPlayer
        : null;

    if (!player) return { room };

    player.connected = false;
    player.disconnectedAt = Date.now();

    // If game is in progress, begin 30 second grace period countdown
    if (room.status === 'in_progress') {
      if (room.disconnectGraceTimer) {
        clearTimeout(room.disconnectGraceTimer);
      }

      room.disconnectGraceTimer = setTimeout(() => {
        if (!player.connected && room.status === 'in_progress') {
          // Grace period elapsed, forfeit game
          const winner: PieceColor = player.color === 'w' ? 'b' : 'w';
          room.status = 'abandoned';
          room.timer.stop();
          room.gameOverDetails = {
            reason: 'abandonment',
            winner,
            message: `${player.username} (${player.color === 'w' ? 'White' : 'Black'}) forfeited due to disconnection.`,
          };
          onGracePeriodExpire(room.id, player);
        }
      }, 30000);
    }

    return { room, disconnectedPlayer: player };
  }

  public resign(roomId: string, playerId: string): { success: boolean; room?: InternalRoom; error?: string } {
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) return { success: false, error: 'Room not found' };
    if (room.status !== 'in_progress') return { success: false, error: 'Game not in progress' };

    const player =
      room.whitePlayer?.id === playerId ? room.whitePlayer : room.blackPlayer?.id === playerId ? room.blackPlayer : null;

    if (!player) return { success: false, error: 'Player not in this game' };

    const winner: PieceColor = player.color === 'w' ? 'b' : 'w';
    room.status = 'resigned';
    room.timer.stop();
    room.gameOverDetails = {
      reason: 'resignation',
      winner,
      message: `${player.username} (${player.color === 'w' ? 'White' : 'Black'}) resigned. ${winner === 'w' ? 'White' : 'Black'} wins!`,
    };

    return { success: true, room };
  }

  public toRoomState(room: InternalRoom): RoomState {
    const times = room.timer.getTimes();

    if (room.whitePlayer) {
      room.whitePlayer.timeRemainingMs = times.whiteTimeMs;
    }
    if (room.blackPlayer) {
      room.blackPlayer.timeRemainingMs = times.blackTimeMs;
    }

    return {
      roomId: room.id,
      fen: room.game.getFen(),
      turn: room.game.getTurn(),
      isCheck: room.game.isInCheck(),
      status: room.status,
      timeControl: room.timeControl,
      whitePlayer: room.whitePlayer ? { ...room.whitePlayer } : null,
      blackPlayer: room.blackPlayer ? { ...room.blackPlayer } : null,
      spectators: [...room.spectators],
      moveHistory: room.game.getMoveHistory(),
      capturedPieces: room.game.getCapturedPieces(),
      lastMove: room.game.getLastMove(),
      gameOver: room.gameOverDetails,
    };
  }
}
