import { Server, Socket } from 'socket.io';
import { RoomStore } from '../store/RoomStore';
import {
  CreateRoomPayload,
  GameOverDetails,
  JoinRoomPayload,
  MakeMovePayload,
  OfferDrawPayload,
  PieceColor,
  RequestRematchPayload,
  ResignPayload,
  RespondDrawPayload,
  RespondRematchPayload,
} from '../types';

export function setupSocketHandlers(io: Server, roomStore: RoomStore) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // 1. Create Private Room
    socket.on('create_room', (payload: CreateRoomPayload) => {
      try {
        const { room, creatorPlayer } = roomStore.createRoom(
          socket.id,
          payload,
          // onTick callback
          (roomId, whiteTimeMs, blackTimeMs, turn) => {
            io.to(roomId).emit('clock_tick', { whiteTimeMs, blackTimeMs, turn });
          },
          // onTimeout callback
          (roomId, loser) => {
            const currentRoom = roomStore.getRoom(roomId);
            if (!currentRoom || currentRoom.status !== 'in_progress') return;

            const winner: PieceColor = loser === 'w' ? 'b' : 'w';
            currentRoom.status = 'timeout';
            currentRoom.gameOverDetails = {
              reason: 'timeout',
              winner,
              message: `Time out! ${winner === 'w' ? 'White' : 'Black'} wins on time.`,
            };

            const roomState = roomStore.toRoomState(currentRoom);
            io.to(roomId).emit('game_over', {
              details: currentRoom.gameOverDetails,
              roomState,
            });
          }
        );

        socket.join(room.id);

        const roomState = roomStore.toRoomState(room);

        socket.emit('room_created', {
          roomId: room.id,
          playerId: creatorPlayer.id,
          color: creatorPlayer.color,
        });

        socket.emit('game_joined', {
          roomState,
          yourPlayerId: creatorPlayer.id,
          yourColor: creatorPlayer.color,
          isSpectator: false,
        });

        console.log(`[Room Created] Room: ${room.id} by ${creatorPlayer.username} (${creatorPlayer.color})`);
      } catch (err: any) {
        console.error('[create_room error]', err);
        socket.emit('error_message', { message: 'Failed to create room' });
      }
    });

    // 2. Join Room (Player 2, Reconnect, or Spectator)
    socket.on('join_room', (payload: JoinRoomPayload) => {
      try {
        const result = roomStore.joinRoom(
          payload.roomId,
          socket.id,
          payload.username,
          payload.playerId
        );

        if (!result.success || !result.room) {
          socket.emit('error_message', { message: result.error || 'Failed to join room' });
          return;
        }

        const room = result.room;
        socket.join(room.id);
        const roomState = roomStore.toRoomState(room);

        if (result.isReconnect && result.player) {
          console.log(`[Player Reconnected] Room: ${room.id}, Player: ${result.player.username}`);
          socket.emit('game_joined', {
            roomState,
            yourPlayerId: result.player.id,
            yourColor: result.player.color,
            isSpectator: false,
          });

          io.to(room.id).emit('player_reconnected', {
            color: result.player.color,
            roomState,
          });
          return;
        }

        if (result.role === 'player' && result.player) {
          console.log(`[Player 2 Joined] Room: ${room.id}, Player: ${result.player.username}`);
          socket.emit('game_joined', {
            roomState,
            yourPlayerId: result.player.id,
            yourColor: result.player.color,
            isSpectator: false,
          });

          // Game is now in progress! Notify all
          io.to(room.id).emit('game_started', { roomState });
          return;
        }

        if (result.role === 'spectator' && result.spectator) {
          console.log(`[Spectator Joined] Room: ${room.id}, Spectator: ${result.spectator.username}`);
          socket.emit('game_joined', {
            roomState,
            isSpectator: true,
          });

          socket.to(room.id).emit('spectator_joined', {
            spectator: result.spectator,
            roomState,
          });
        }
      } catch (err: any) {
        console.error('[join_room error]', err);
        socket.emit('error_message', { message: 'Unexpected error joining room' });
      }
    });

    // 3. Make Move
    socket.on('make_move', (payload: MakeMovePayload) => {
      try {
        const room = roomStore.getRoom(payload.roomId);
        if (!room) {
          socket.emit('move_rejected', { error: 'Room not found' });
          return;
        }

        if (room.status !== 'in_progress') {
          socket.emit('move_rejected', { error: 'Game is not currently active' });
          return;
        }

        const player =
          room.whitePlayer?.id === payload.playerId
            ? room.whitePlayer
            : room.blackPlayer?.id === payload.playerId
            ? room.blackPlayer
            : null;

        if (!player) {
          socket.emit('move_rejected', { error: 'Unauthorized player' });
          return;
        }

        const times = room.timer.getTimes();
        const moveResult = room.game.validateAndExecuteMove(
          payload.move,
          player.color,
          { w: times.whiteTimeMs, b: times.blackTimeMs }
        );

        if (!moveResult.success) {
          socket.emit('move_rejected', { error: moveResult.error });
          return;
        }

        // Switch clock turn and add increment
        room.timer.switchTurn();

        // Check if game ended due to checkmate / draw
        if (room.game.isGameOver()) {
          room.timer.stop();
          const details = room.game.getGameOverDetails()!;
          room.status = details.reason === 'checkmate' ? 'checkmate' : 'draw';
          room.gameOverDetails = details;
        }

        const updatedRoomState = roomStore.toRoomState(room);

        // Broadcast validated move and updated state
        io.to(room.id).emit('move_made', {
          move: moveResult.move,
          roomState: updatedRoomState,
        });

        if (room.gameOverDetails) {
          io.to(room.id).emit('game_over', {
            details: room.gameOverDetails,
            roomState: updatedRoomState,
          });
        }
      } catch (err: any) {
        console.error('[make_move error]', err);
        socket.emit('move_rejected', { error: 'Internal server error processing move' });
      }
    });

    // 4. Resign
    socket.on('resign', (payload: ResignPayload) => {
      const result = roomStore.resign(payload.roomId, payload.playerId);
      if (result.success && result.room && result.room.gameOverDetails) {
        const roomState = roomStore.toRoomState(result.room);
        io.to(result.room.id).emit('game_over', {
          details: result.room.gameOverDetails,
          roomState,
        });
      }
    });

    // 5. Draw Offers
    socket.on('offer_draw', (payload: OfferDrawPayload) => {
      const room = roomStore.getRoom(payload.roomId);
      if (!room || room.status !== 'in_progress') return;

      const player =
        room.whitePlayer?.id === payload.playerId
          ? room.whitePlayer
          : room.blackPlayer?.id === payload.playerId
          ? room.blackPlayer
          : null;

      if (!player) return;

      room.drawOfferFrom = player.color;
      socket.to(room.id).emit('draw_offered', { fromColor: player.color });
    });

    socket.on('respond_draw', (payload: RespondDrawPayload) => {
      const room = roomStore.getRoom(payload.roomId);
      if (!room || room.status !== 'in_progress' || !room.drawOfferFrom) return;

      if (payload.accept) {
        room.timer.stop();
        room.status = 'draw';
        room.gameOverDetails = {
          reason: 'stalemate', // mutual agreement
          winner: 'draw',
          message: 'Game drawn by mutual agreement.',
        };
        const roomState = roomStore.toRoomState(room);
        io.to(room.id).emit('game_over', {
          details: room.gameOverDetails,
          roomState,
        });
      } else {
        socket.to(room.id).emit('draw_declined');
      }
      room.drawOfferFrom = null;
    });

    // 6. Rematch Handling
    socket.on('request_rematch', (payload: RequestRematchPayload) => {
      const room = roomStore.getRoom(payload.roomId);
      if (!room || room.status === 'in_progress' || room.status === 'waiting') return;

      room.rematchRequestedBy.add(payload.playerId);

      const player =
        room.whitePlayer?.id === payload.playerId
          ? room.whitePlayer
          : room.blackPlayer?.id === payload.playerId
          ? room.blackPlayer
          : null;

      if (!player) return;

      if (room.rematchRequestedBy.size === 2) {
        // Both players agreed to rematch: swap colors and reset board & timers!
        const temp = room.whitePlayer;
        room.whitePlayer = room.blackPlayer;
        room.blackPlayer = temp;

        if (room.whitePlayer) {
          room.whitePlayer.color = 'w';
          room.whitePlayer.timeRemainingMs = room.timeControl.initialMinutes * 60 * 1000;
        }
        if (room.blackPlayer) {
          room.blackPlayer.color = 'b';
          room.blackPlayer.timeRemainingMs = room.timeControl.initialMinutes * 60 * 1000;
        }

        room.game.reset();
        room.timer = new (require('../game/ChessTimer').ChessTimer)(
          room.timeControl,
          {
            onTick: (w: number, b: number, turn: PieceColor) => {
              io.to(room.id).emit('clock_tick', { whiteTimeMs: w, blackTimeMs: b, turn });
            },
            onTimeout: (loser: PieceColor) => {
              const currentRoom = roomStore.getRoom(room.id);
              if (!currentRoom || currentRoom.status !== 'in_progress') return;

              const winner: PieceColor = loser === 'w' ? 'b' : 'w';
              currentRoom.status = 'timeout';
              currentRoom.gameOverDetails = {
                reason: 'timeout',
                winner,
                message: `Time out! ${winner === 'w' ? 'White' : 'Black'} wins on time.`,
              };

              const state = roomStore.toRoomState(currentRoom);
              io.to(room.id).emit('game_over', {
                details: currentRoom.gameOverDetails,
                roomState: state,
              });
            },
          }
        );

        room.status = 'in_progress';
        room.gameOverDetails = null;
        room.rematchRequestedBy.clear();
        room.timer.start();

        const roomState = roomStore.toRoomState(room);
        io.to(room.id).emit('rematch_started', { roomState });
      } else {
        socket.to(room.id).emit('rematch_offered', { fromColor: player.color });
      }
    });

    // 7. Disconnect Handler
    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] ID: ${socket.id}`);
      const { room, disconnectedPlayer } = roomStore.handleDisconnect(
        socket.id,
        // Grace period expired callback
        (roomId, forfeitingPlayer) => {
          const expiredRoom = roomStore.getRoom(roomId);
          if (expiredRoom && expiredRoom.gameOverDetails) {
            const roomState = roomStore.toRoomState(expiredRoom);
            io.to(roomId).emit('game_over', {
              details: expiredRoom.gameOverDetails,
              roomState,
            });
          }
        }
      );

      if (room && disconnectedPlayer) {
        io.to(room.id).emit('player_disconnected', {
          color: disconnectedPlayer.color,
          username: disconnectedPlayer.username,
          gracePeriodSeconds: 30,
        });
      }
    });
  });
}
