# Real-time Chess Full-Stack Implementation Plan

This document outlines the architecture and implementation steps for a full-stack real-time, two-player online chess application.
- **Backend:** Node.js, TypeScript, Socket.io, and `chess.js`.
- **Frontend:** Next.js (React), TypeScript, Tailwind CSS, `react-chessboard`, `socket.io-client`.

## User Review Required

> [!IMPORTANT]
> The current plan uses an **in-memory store** (Map/Set) for active rooms and timers, as well as native `setTimeout`/`setInterval` for the timer ticks. This is perfectly suitable for a single-node deployment and simple testing. However, if you plan to scale this to multiple nodes in the future, we would need to migrate to Redis (for state, pub/sub for socket.io, and possibly for distributed timers). Please confirm if the single-node in-memory approach is acceptable for now.

> [!NOTE]
> The default time control is set to 10+0 (Rapid), but the room creation payload can easily be extended to support custom time controls.

## Open Questions

> [!CAUTION]
> 1. **Time Control Definitions:** Should players be able to specify the time control when creating a room, or should we hardcode a few options (e.g., Bullet 1+0, Blitz 3+2, Rapid 10+0)?
> 2. **Authentication:** Currently, player identities are tied to their socket IDs (and possibly an ephemeral session ID in case of reconnect). Do you require any persistent user authentication (e.g., JWTs, DB integration) or are anonymous ephemeral users fine?
> 3. **Timer Precision:** Is standard Node.js `setInterval` (approximate millisecond precision) acceptable for the clock, or do you need a highly precise tick-based loop (usually not necessary for anything above 1+0 bullet)?

## Proposed Changes

We will organize the code into a modular architecture within the `src/` directory.

### Project Setup
- Initialize standard `package.json` with Node.js and TypeScript.
- Install dependencies: `express`, `socket.io`, `chess.js`, `cors`.
- Install dev dependencies: `typescript`, `ts-node`, `nodemon`, `@types/node`, `@types/express`.

### Core Architecture

#### `src/server.ts`
- Entry point of the application.
- Initializes Express server and Socket.io server.
- Registers the main socket connection handler.

#### `src/store/roomStore.ts`
- In-memory data structures (`Map`) to keep track of active rooms.
- Defines the `Room` interface containing player details, board state, timers, and spectators.

#### `src/game/ChessGame.ts`
- A class wrapping `chess.js` instance for a specific room.
- Handles move validation, applying moves, checking game-over states (checkmate, stalemate, draw).
- Generates FEN strings to broadcast to clients.

#### `src/game/Timer.ts`
- Manages the server-authoritative clock for both players.
- Handles decrements, increment additions, and triggers flag-fall callbacks when time runs out.

#### `src/socket/handlers.ts`
- Typed socket event handlers mapping to standard chess actions:
  - `create_room`: Creates a new game instance and returns short ID.
  - `join_room`: Connects player 2 or assigns as spectator.
  - `make_move`: Receives SAN/UCI move, validates, updates state, emits board update.
  - `disconnect` & `reconnect`: Handles graceful disconnects with a 30s grace period timeout.

## Verification Plan

### Automated/Manual Testing
- I will create a temporary simple Node.js client script (`test-client.ts`) that uses `socket.io-client` to:
  - Connect to the server.
  - Create a room.
  - Connect a second client to join the room.
  - Play a short sequence of moves (e.g., Scholar's Mate) to verify move validation, state broadcasting, and game-over detection.
  - Test disconnect/reconnect logic.
