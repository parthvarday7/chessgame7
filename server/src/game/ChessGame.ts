import { Chess } from 'chess.js';
import { ChessMovePayload, GameOverDetails, MoveRecord, PieceColor } from '../types';

export class ChessGame {
  private chess: Chess;
  private moveHistory: MoveRecord[] = [];

  constructor(fen?: string) {
    this.chess = new Chess(fen);
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getTurn(): PieceColor {
    return this.chess.turn() as PieceColor;
  }

  public isInCheck(): boolean {
    return this.chess.inCheck();
  }

  public isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  public getGameOverDetails(): GameOverDetails | null {
    if (!this.chess.isGameOver()) return null;

    if (this.chess.isCheckmate()) {
      const winner: PieceColor = this.chess.turn() === 'w' ? 'b' : 'w';
      return {
        reason: 'checkmate',
        winner,
        message: `Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins.`,
      };
    }

    if (this.chess.isStalemate()) {
      return {
        reason: 'stalemate',
        winner: 'draw',
        message: 'Draw by stalemate.',
      };
    }

    if (this.chess.isThreefoldRepetition()) {
      return {
        reason: 'threefold_repetition',
        winner: 'draw',
        message: 'Draw by threefold repetition.',
      };
    }

    if (this.chess.isInsufficientMaterial()) {
      return {
        reason: 'insufficient_material',
        winner: 'draw',
        message: 'Draw by insufficient material.',
      };
    }

    if (this.chess.isDraw()) {
      return {
        reason: '50_move_rule',
        winner: 'draw',
        message: 'Draw by 50-move rule.',
      };
    }

    return {
      reason: 'stalemate',
      winner: 'draw',
      message: 'Game drawn.',
    };
  }

  public validateAndExecuteMove(
    movePayload: ChessMovePayload,
    playerColor: PieceColor,
    timeRemainingMs: { w: number; b: number }
  ): { success: true; move: MoveRecord } | { success: false; error: string } {
    // Ensure it is the player's turn
    if (this.chess.turn() !== playerColor) {
      return { success: false, error: 'Not your turn' };
    }

    try {
      // Execute the move on chess.js
      const result = this.chess.move({
        from: movePayload.from,
        to: movePayload.to,
        promotion: movePayload.promotion || 'q',
      });

      if (!result) {
        return { success: false, error: 'Illegal move' };
      }

      const moveRecord: MoveRecord = {
        from: result.from,
        to: result.to,
        san: result.san,
        color: result.color as PieceColor,
        piece: result.piece,
        captured: result.captured,
        fen: this.chess.fen(),
        timeRemainingMs: { ...timeRemainingMs },
        timestamp: Date.now(),
      };

      this.moveHistory.push(moveRecord);

      return { success: true, move: moveRecord };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid move' };
    }
  }

  public getMoveHistory(): MoveRecord[] {
    return [...this.moveHistory];
  }

  public getLastMove(): { from: string; to: string } | null {
    if (this.moveHistory.length === 0) return null;
    const last = this.moveHistory[this.moveHistory.length - 1];
    return { from: last.from, to: last.to };
  }

  public getCapturedPieces(): { w: string[]; b: string[] } {
    // Starting army
    const initialPieces: Record<string, number> = {
      p: 8, n: 2, b: 2, r: 2, q: 1,
      P: 8, N: 2, B: 2, R: 2, Q: 1,
    };

    const currentPieces: Record<string, number> = {
      p: 0, n: 0, b: 0, r: 0, q: 0,
      P: 0, N: 0, B: 0, R: 0, Q: 0,
    };

    const board = this.chess.board();
    for (const row of board) {
      for (const square of row) {
        if (square && square.type !== 'k') {
          const key = square.color === 'w' ? square.type.toUpperCase() : square.type.toLowerCase();
          currentPieces[key] = (currentPieces[key] || 0) + 1;
        }
      }
    }

    const capturedByWhite: string[] = []; // Black pieces captured
    for (const piece of ['p', 'n', 'b', 'r', 'q']) {
      const missing = (initialPieces[piece] || 0) - (currentPieces[piece] || 0);
      for (let i = 0; i < missing; i++) {
        capturedByWhite.push(piece);
      }
    }

    const capturedByBlack: string[] = []; // White pieces captured
    for (const piece of ['P', 'N', 'B', 'R', 'Q']) {
      const missing = (initialPieces[piece] || 0) - (currentPieces[piece] || 0);
      for (let i = 0; i < missing; i++) {
        capturedByBlack.push(piece.toLowerCase());
      }
    }

    return {
      w: capturedByWhite,
      b: capturedByBlack,
    };
  }

  public reset(): void {
    this.chess.reset();
    this.moveHistory = [];
  }
}
