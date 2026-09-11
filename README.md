# ♟️ Real-Time Online Chess

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)]()
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)]()
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101.svg)]()
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, full-stack real-time chess platform featuring server-authoritative move validation, high-precision Blitz & Rapid clocks, instant spectator connections, and 30-second disconnect recovery.

---

## 🌟 Key Features

- **🛡️ Server-Authoritative Logic**: Every move is validated server-side via `chess.js`. Client move calculations are never trusted.
- **⏱️ Authoritative Clocks**: Millisecond-accurate server timers with dynamic increments (e.g., 3+2 Blitz) and instant flag-fall detection on timeout.
- **🔄 Reconnect Grace Period**: 30-second reconnect window for disconnected players to rejoin without forfeiting.
- **👥 Room & Spectator Management**: Private rooms with 6-character codes (`UYSJ3U`), automatic or random White/Black seating, and unlimited spectator connections.
- **🎨 Modern Glassmorphic UI**: Sleek dark theme built with Tailwind CSS, responsive chessboard (`react-chessboard`), legal move hint dots, check danger highlights, and pawn promotion dialog.
- **🔊 Web Audio Synthesizer**: Native zero-asset Web Audio API producing realistic sound effects for moves, captures, check, and victory.
- **🎉 Victory Celebration**: Confetti animation on checkmate, mutual draw proposals, and rematch workflows.

---

## 🏗️ Architecture

```
├── server/                     # Node.js + TypeScript + Express + Socket.io + chess.js
│   ├── src/
│   │   ├── types/index.ts      # WebSocket event contracts & data models
│   │   ├── game/
│   │   │   ├── ChessGame.ts    # Game rules & endgame detection (checkmate, stalemate, 50-move)
│   │   │   └── ChessTimer.ts   # Authoritative clock with delta tracking & flag-fall
│   │   ├── store/
│   │   │   └── RoomStore.ts    # In-memory room manager, 6-char codes, grace periods
│   │   ├── socket/
│   │   │   └── handlers.ts     # Complete WebSocket lifecycle handlers
│   │   ├── server.ts           # HTTP & Socket.io server bootstrap
│   │   └── test-simulation.ts  # Automated E2E integration test (Scholar's Mate)
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
└── client/                     # Next.js 14 (App Router) + React + TypeScript + Tailwind
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx        # Lobby: Create Game (time controls) & Join Game
    │   │   ├── game/[roomId]/  # Main Game Room screen
    │   │   └── globals.css     # Glassmorphic utilities & custom scrollbars
    │   ├── hooks/
    │   │   └── useChessGame.ts # Custom hook for real-time WebSocket state & clocks
    │   ├── components/
    │   │   ├── ChessBoardView.tsx # react-chessboard wrapper, legal dots, check highlight
    │   │   ├── PlayerCard.tsx  # Player avatars, connection pulse, clock, captured pieces
    │   │   ├── MoveHistory.tsx # Scrollable PGN algebraic notation table
    │   │   ├── GameOverModal.tsx # Victory celebration & rematch workflow
    │   │   ├── PromotionModal.tsx # Pawn promotion selector (Q, R, B, N)
    │   │   └── ShareLink.tsx   # 1-click room URL & code copy
    │   └── utils/
    │       └── sound.ts        # Web Audio API synthesizer
    ├── Dockerfile
    ├── package.json
    └── tailwind.config.ts
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 20+
- npm

### 1. Run the Server
```bash
cd online-chess/server
npm install
npm run dev
```
Server will start on `http://localhost:4000`.

### 2. Run the Client
```bash
cd online-chess/client
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated E2E Testing

The project includes an end-to-end simulation test that connects two Socket.io clients, creates a room, verifies turn enforcement, executes Scholar's Mate, and validates checkmate detection:

```bash
cd online-chess/server
npm run test:sim
```

---

## 🌐 Deploy to Production

### Option A: Vercel (Frontend) + Render / Railway (Backend)

1. **Deploy Backend (`server/`) to Render or Railway**:
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/server.js`
   - Set environment variable: `PORT=4000`

2. **Deploy Frontend (`client/`) to Vercel**:
   - Set environment variable: `NEXT_PUBLIC_SOCKET_URL=https://your-server-backend.onrender.com`
   - Root Directory: `online-chess/client`

### Option B: Docker Compose (Single Command)
```bash
cd online-chess
docker-compose up --build
```

---

## 📜 License

MIT License. Free to use, modify, and distribute.
