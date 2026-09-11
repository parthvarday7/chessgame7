import { PieceColor, TimeControl } from '../types';

export interface TimerCallbacks {
  onTick?: (whiteTimeMs: number, blackTimeMs: number, turn: PieceColor) => void;
  onTimeout: (loser: PieceColor) => void;
}

export class ChessTimer {
  private whiteTimeMs: number;
  private blackTimeMs: number;
  private incrementMs: number;
  private activeTurn: PieceColor = 'w';
  private lastMoveTimestamp: number | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private callbacks: TimerCallbacks;
  private isRunning: boolean = false;

  constructor(timeControl: TimeControl, callbacks: TimerCallbacks) {
    this.whiteTimeMs = timeControl.initialMinutes * 60 * 1000;
    this.blackTimeMs = timeControl.initialMinutes * 60 * 1000;
    this.incrementMs = timeControl.incrementSeconds * 1000;
    this.callbacks = callbacks;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastMoveTimestamp = Date.now();

    // Regular interval to push clock ticks to clients and check for flag-fall
    this.tickInterval = setInterval(() => {
      this.updateElapsedTime();
      this.callbacks.onTick?.(this.whiteTimeMs, this.blackTimeMs, this.activeTurn);

      if (this.activeTurn === 'w' && this.whiteTimeMs <= 0) {
        this.whiteTimeMs = 0;
        this.stop();
        this.callbacks.onTimeout('w');
      } else if (this.activeTurn === 'b' && this.blackTimeMs <= 0) {
        this.blackTimeMs = 0;
        this.stop();
        this.callbacks.onTimeout('b');
      }
    }, 200);
  }

  public switchTurn(): void {
    if (!this.isRunning) return;

    this.updateElapsedTime();

    // Add increment to the player who just finished their turn
    if (this.activeTurn === 'w') {
      this.whiteTimeMs += this.incrementMs;
      this.activeTurn = 'b';
    } else {
      this.blackTimeMs += this.incrementMs;
      this.activeTurn = 'w';
    }

    this.lastMoveTimestamp = Date.now();
    this.callbacks.onTick?.(this.whiteTimeMs, this.blackTimeMs, this.activeTurn);
  }

  private updateElapsedTime(): void {
    if (!this.lastMoveTimestamp || !this.isRunning) return;

    const now = Date.now();
    const elapsed = now - this.lastMoveTimestamp;
    this.lastMoveTimestamp = now;

    if (this.activeTurn === 'w') {
      this.whiteTimeMs = Math.max(0, this.whiteTimeMs - elapsed);
    } else {
      this.blackTimeMs = Math.max(0, this.blackTimeMs - elapsed);
    }
  }

  public stop(): void {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.lastMoveTimestamp = null;
  }

  public getTimes(): { whiteTimeMs: number; blackTimeMs: number; turn: PieceColor } {
    this.updateElapsedTime();
    return {
      whiteTimeMs: this.whiteTimeMs,
      blackTimeMs: this.blackTimeMs,
      turn: this.activeTurn,
    };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}
