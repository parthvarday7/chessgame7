export type PieceColor = 'w' | 'b';

export interface TimeControl {
  initialMinutes: number;
  incrementSeconds: number;
}

export interface Player {
  id: string;             // Persistent session/player ID
  socketId: string;
  username: string;
  color: PieceColor;
  connected: boolean;
  timeRemainingMs: number;
  disconnectedAt?: number;
}

export interface Spectator {
  id: string;
  socketId: string;
  username: string;
}

export type GameStatus =
  | 'waiting'
  | 'in_progress'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'timeout'
  | 'resigned'
  | 'abandoned';

export type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'threefold_repetition'
  | 'insufficient_material'
  | '50_move_rule'
  | 'timeout'
  | 'resignation'
  | 'abandonment';

export interface GameOverDetails {
  reason: GameOverReason;
  winner: PieceColor | 'draw';
  message: string;
}

export interface ChessMovePayload {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface MoveRecord {
  from: string;
  to: string;
  san: string;
  color: PieceColor;
  piece: string;
  captured?: string;
  fen: string;
  timeRemainingMs: {
    w: number;
    b: number;
  };
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  fen: string;
  turn: PieceColor;
  isCheck: boolean;
  status: GameStatus;
  timeControl: TimeControl;
  whitePlayer: Player | null;
  blackPlayer: Player | null;
  spectators: Spectator[];
  moveHistory: MoveRecord[];
  capturedPieces: {
    w: string[]; // Pieces captured by White (i.e. black pieces)
    b: string[]; // Pieces captured by Black (i.e. white pieces)
  };
  lastMove: { from: string; to: string } | null;
  gameOver: GameOverDetails | null;
}

// Client-to-Server Event Payloads
export interface CreateRoomPayload {
  timeControl: TimeControl;
  preferredColor?: 'w' | 'b' | 'random';
  username?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  username?: string;
  playerId?: string; // For reconnection
}

export interface MakeMovePayload {
  roomId: string;
  playerId: string;
  move: ChessMovePayload;
}

export interface ResignPayload {
  roomId: string;
  playerId: string;
}

export interface OfferDrawPayload {
  roomId: string;
  playerId: string;
}

export interface RespondDrawPayload {
  roomId: string;
  playerId: string;
  accept: boolean;
}

export interface RequestRematchPayload {
  roomId: string;
  playerId: string;
}

export interface RespondRematchPayload {
  roomId: string;
  playerId: string;
  accept: boolean;
}
