import { io as ClientSocket } from 'socket.io-client';
import { server } from './server';
import { CreateRoomPayload, GameOverDetails, MoveRecord, RoomState } from './types';

const PORT = 4000;
const SERVER_URL = `http://localhost:${PORT}`;

async function runSimulation() {
  console.log('--- Starting Real-Time Chess Backend Integration Test ---');

  // Wait a moment for server to listen
  await new Promise((res) => setTimeout(res, 500));

  const client1 = ClientSocket(SERVER_URL, { reconnection: false, transports: ['websocket'] });
  const client2 = ClientSocket(SERVER_URL, { reconnection: false, transports: ['websocket'] });

  await Promise.all([
    new Promise<void>((resolve) => client1.on('connect', () => resolve())),
    new Promise<void>((resolve) => client2.on('connect', () => resolve())),
  ]);

  console.log('✓ Both Socket.io clients connected');

  let roomId = '';
  let player1Id = '';
  let player2Id = '';
  let p1Color = '';
  let p2Color = '';

  // 1. Client 1 creates room
  const createPayload: CreateRoomPayload = {
    timeControl: { initialMinutes: 3, incrementSeconds: 2 },
    preferredColor: 'w',
    username: 'GrandmasterAlice',
  };

  const roomCreatedPromise = new Promise<{ roomId: string; playerId: string; color: string }>(
    (resolve) => {
      client1.on('room_created', (data) => resolve(data));
    }
  );

  client1.emit('create_room', createPayload);
  const roomData = await roomCreatedPromise;
  roomId = roomData.roomId;
  player1Id = roomData.playerId;
  p1Color = roomData.color;
  console.log(`✓ Room created: ${roomId} (White: ${player1Id})`);

  // 2. Client 2 joins room
  const gameStartedPromise = new Promise<RoomState>((resolve) => {
    client1.on('game_started', (data) => resolve(data.roomState));
  });

  const p2JoinedPromise = new Promise<{ yourPlayerId: string; yourColor: string }>((resolve) => {
    client2.on('game_joined', (data) =>
      resolve({ yourPlayerId: data.yourPlayerId, yourColor: data.yourColor })
    );
  });

  client2.emit('join_room', {
    roomId,
    username: 'MasterBob',
  });

  const p2Data = await p2JoinedPromise;
  player2Id = p2Data.yourPlayerId;
  p2Color = p2Data.yourColor;
  console.log(`✓ Player 2 joined: ${player2Id} (Color: ${p2Color})`);

  const initialRoomState = await gameStartedPromise;
  console.log(`✓ Game started! Initial FEN: ${initialRoomState.fen}`);

  // 3. Test illegal move (Black tries to move when White is to play)
  const illegalMovePromise = new Promise<string>((resolve) => {
    client2.once('move_rejected', (err) => resolve(err.error));
  });

  client2.emit('make_move', {
    roomId,
    playerId: player2Id,
    move: { from: 'e7', to: 'e5' },
  });

  const rejectedError = await illegalMovePromise;
  console.log(`✓ Turn enforcement verified: Black move correctly rejected ("${rejectedError}")`);

  // 4. Play Scholar's Mate moves
  const moves: Array<{ client: any; playerId: string; from: string; to: string; label: string }> = [
    { client: client1, playerId: player1Id, from: 'e2', to: 'e4', label: '1. e4' },
    { client: client2, playerId: player2Id, from: 'e7', to: 'e5', label: '1... e5' },
    { client: client1, playerId: player1Id, from: 'f1', to: 'c4', label: '2. Bc4' },
    { client: client2, playerId: player2Id, from: 'b8', to: 'c6', label: '2... Nc6' },
    { client: client1, playerId: player1Id, from: 'd1', to: 'h5', label: '3. Qh5' },
    { client: client2, playerId: player2Id, from: 'g8', to: 'f6', label: '3... Nf6' },
    { client: client1, playerId: player1Id, from: 'h5', to: 'f7', label: '4. Qxf7# (Scholar\'s Mate)' },
  ];

  for (const step of moves) {
    const movePromise = new Promise<{ move: MoveRecord; roomState: RoomState }>((resolve) => {
      client1.once('move_made', (data) => resolve(data));
    });

    step.client.emit('make_move', {
      roomId,
      playerId: step.playerId,
      move: { from: step.from, to: step.to },
    });

    const result = await movePromise;
    console.log(`  Played ${step.label} -> SAN: ${result.move.san}`);
  }

  // 5. Verify Checkmate Game Over event
  const gameOverPromise = new Promise<GameOverDetails>((resolve) => {
    client2.once('game_over', (data) => resolve(data.details));
  });

  const gameOver = await gameOverPromise;
  console.log(`✓ Game Over detected correctly:`);
  console.log(`   Reason: ${gameOver.reason}`);
  console.log(`   Winner: ${gameOver.winner}`);
  console.log(`   Message: ${gameOver.message}`);

  if (gameOver.reason === 'checkmate' && gameOver.winner === 'w') {
    console.log('🎉 SUCCESS: All backend chess requirements validated successfully!');
  } else {
    throw new Error(`Unexpected game over result: ${JSON.stringify(gameOver)}`);
  }

  client1.disconnect();
  client2.disconnect();
  server.close();
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error('Test simulation failed:', err);
  process.exit(1);
});
