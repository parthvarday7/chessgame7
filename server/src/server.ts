import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket/handlers';
import { RoomStore } from './store/RoomStore';

const app = express();
const server = http.createServer(app);

// CORS configuration allowing local frontend development
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST'],
  })
);

app.use(express.json());

// In-memory room store singleton
const roomStore = new RoomStore();

// Socket.io initialization with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Setup WebSocket event handlers
setupSocketHandlers(io, roomStore);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Room info API endpoint for fast validation
app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomStore.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  return res.json(roomStore.toRoomState(room));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[Chess Server] Authoritative backend running on port ${PORT}`);
  console.log(`[Chess Server] Real-time WebSocket endpoint ready`);
});

export { app, io, roomStore, server };
