'use client';

import { Chess, Square } from 'chess.js';
import { ArrowLeftRight } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { ChessMovePayload, PieceColor } from '../types';
import { soundFX } from '../utils/sound';
import { PromotionModal } from './PromotionModal';

interface ChessBoardViewProps {
  fen: string;
  isCheck: boolean;
  turn: PieceColor;
  lastMove: { from: string; to: string } | null;
  yourColor: PieceColor | null;
  isSpectator: boolean;
  isGameActive: boolean;
  onMakeMove: (move: ChessMovePayload) => void;
}

export const ChessBoardView: React.FC<ChessBoardViewProps> = ({
  fen,
  isCheck,
  turn,
  lastMove,
  yourColor,
  isSpectator,
  isGameActive,
  onMakeMove,
}) => {
  // Manual flip state (default: yourColor === 'b' ? 'black' : 'white')
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);

  // Sync orientation when yourColor changes
  useEffect(() => {
    if (yourColor === 'b') {
      setBoardOrientation('black');
    } else {
      setBoardOrientation('white');
    }
  }, [yourColor]);

  // Audio trigger on FEN change / check
  useEffect(() => {
    if (!lastMove) return;
    if (isCheck) {
      soundFX.playCheck();
    } else {
      soundFX.playMove();
    }
  }, [fen, isCheck, lastMove]);

  // Local chess instance for real-time legal move dots
  const game = useMemo(() => new Chess(fen), [fen]);

  // Can the user interact with the board right now?
  const isMyTurn = !isSpectator && yourColor && turn === yourColor && isGameActive;

  // Find king square for check highlight
  const kingSquare = useMemo(() => {
    if (!isCheck) return null;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return p.square;
        }
      }
    }
    return null;
  }, [game, isCheck, turn]);

  // Handle piece drop (drag-and-drop)
  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    if (!isMyTurn) return false;

    // Check if move is legal
    const moves = game.moves({ square: sourceSquare, verbose: true });
    const foundMove = moves.find((m) => m.to === targetSquare);
    if (!foundMove) return false;

    // Check for pawn promotion (rank 8 for white, rank 1 for black)
    const piece = game.get(sourceSquare);
    const isPawnPromotion =
      piece &&
      piece.type === 'p' &&
      ((piece.color === 'w' && targetSquare[1] === '8') ||
        (piece.color === 'b' && targetSquare[1] === '1'));

    if (isPawnPromotion) {
      setPromotionMove({ from: sourceSquare, to: targetSquare });
      return true;
    }

    onMakeMove({ from: sourceSquare, to: targetSquare });
    setSelectedSquare(null);
    setPossibleMoves([]);
    return true;
  };

  // Handle click-to-move
  const onSquareClick = (square: Square) => {
    if (!isMyTurn) return;

    // If a square is already selected, check if clicked square is a valid target
    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }

      if (possibleMoves.includes(square)) {
        // Execute move
        const piece = game.get(selectedSquare);
        const isPawnPromotion =
          piece &&
          piece.type === 'p' &&
          ((piece.color === 'w' && square[1] === '8') ||
            (piece.color === 'b' && square[1] === '1'));

        if (isPawnPromotion) {
          setPromotionMove({ from: selectedSquare, to: square });
          return;
        }

        onMakeMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }
    }

    // Select piece if it belongs to current player
    const piece = game.get(square);
    if (piece && piece.color === yourColor) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setPossibleMoves(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  // Build custom square styles
  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Highlight last move (amber glow)
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(245, 158, 11, 0.35)',
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(245, 158, 11, 0.45)',
      };
    }

    // 2. Highlight selected square (blue glow)
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
      };
    }

    // 3. Highlight legal destination dots
    for (const move of possibleMoves) {
      const isCapture = game.get(move as Square);
      styles[move] = {
        background: isCapture
          ? 'radial-gradient(circle, rgba(239, 68, 68, 0.6) 25%, transparent 26%)'
          : 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 25%, transparent 26%)',
        borderRadius: '50%',
        cursor: 'pointer',
      };
    }

    // 4. Highlight King in check (red danger glow)
    if (kingSquare) {
      styles[kingSquare] = {
        backgroundColor: 'rgba(239, 68, 68, 0.65)',
        boxShadow: 'inset 0 0 15px rgba(239, 68, 68, 0.9)',
      };
    }

    return styles;
  }, [lastMove, selectedSquare, possibleMoves, game, kingSquare]);

  const handlePromotionSelect = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (promotionMove) {
      onMakeMove({
        from: promotionMove.from,
        to: promotionMove.to,
        promotion: piece,
      });
      setPromotionMove(null);
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Board Controls */}
      <div className="w-full max-w-[560px] flex justify-end mb-2">
        <button
          onClick={() =>
            setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))
          }
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition active:scale-95"
          title="Flip board orientation"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          <span>Flip Board</span>
        </button>
      </div>

      {/* Chessboard Container */}
      <div className="w-full max-w-[560px] aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800/80 bg-slate-900 relative">
        <Chessboard
          position={fen}
          boardOrientation={boardOrientation}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          arePiecesDraggable={Boolean(isMyTurn)}
          customSquareStyles={customSquareStyles}
          customDarkSquareStyle={{ backgroundColor: '#739552' }}
          customLightSquareStyle={{ backgroundColor: '#ebecd0' }}
          animationDuration={200}
        />
      </div>

      {/* Pawn Promotion Modal */}
      <PromotionModal
        isOpen={Boolean(promotionMove)}
        color={yourColor || 'w'}
        onSelect={handlePromotionSelect}
        onClose={() => setPromotionMove(null)}
      />
    </div>
  );
};
