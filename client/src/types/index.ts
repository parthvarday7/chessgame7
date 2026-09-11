export type PieceColor = 'w' | 'b';

export interface TimeControl {
  initialMinutes: number;
  incrementSeconds: number;
}

export interface Player {
  id: string;
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
    w: string[];
    b: string[];
  };
  lastMove: { from: string; to: string } | null;
  gameOver: GameOverDetails | null;
}

export interface GameNotification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
}
