// 🎮 Mini Militia 2D — 5-Digit Private Lobby & Real-Time Relay Server
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve the web client
app.use(express.static(path.join(__dirname, '../client-web')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Unique 5-Digit Room Code Generator
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generate5DigitCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

// In-Memory Lobbies & Active Clients
const lobbies = new Map();
const clients = new Map();
let nextPlayerId = 1;

wss.on('connection', (ws) => {
  const playerId = `P_${nextPlayerId++}`;
  const clientData = {
    id: playerId,
    nickname: `Soldier_${Math.floor(100 + Math.random() * 900)}`,
    roomCode: null,
    team: 'RED',
    ready: false,
    ws
  };
  clients.set(ws, clientData);

  send(ws, 'CONNECTED', { playerId, nickname: clientData.nickname });

  ws.on('message', (messageRaw) => {
    try {
      const message = JSON.parse(messageRaw);
      handleClientMessage(ws, clientData, message);
    } catch (err) {
      console.error('Error parsing client message:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, clientData);
  });
});

function handleClientMessage(ws, client, msg) {
  const { type, payload } = msg;

  switch (type) {
    case 'SET_NICKNAME': {
      if (payload && payload.nickname) {
        client.nickname = String(payload.nickname).trim().slice(0, 16) || client.nickname;
        if (client.roomCode) {
          broadcastLobbyState(client.roomCode);
        }
      }
      break;
    }

    case 'CREATE_LOBBY': {
      leaveCurrentRoom(ws, client);

      let roomCode = generate5DigitCode();
      while (lobbies.has(roomCode)) {
        roomCode = generate5DigitCode();
      }

      const matchMode = payload?.mode || '2v2';
      const maxPlayers = matchMode === '1v1' ? 2 : matchMode === '2v2' ? 4 : (payload?.maxPlayers || 8);

      const lobby = {
        code: roomCode,
        hostId: client.id,
        mode: matchMode,
        maxPlayers,
        map: 'Outpost Bunker',
        timeLimitSec: 300,
        killLimit: 15,
        state: 'WAITING',
        players: new Map(),
        createdAt: Date.now()
      };

      client.roomCode = roomCode;
      client.team = 'RED';
      client.ready = true;

      lobby.players.set(client.id, client);
      lobbies.set(roomCode, lobby);

      console.log(`[LOBBY] Created private lobby ${roomCode} by ${client.nickname} (${client.id})`);

      send(ws, 'LOBBY_CREATED', {
        roomCode,
        isHost: true,
        lobby: serializeLobby(lobby)
      });
      break;
    }

    case 'JOIN_LOBBY': {
      const targetCode = (payload?.roomCode || '').toUpperCase().trim();
      const lobby = lobbies.get(targetCode);

      if (!lobby) {
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Lobby "${targetCode}" not found. Verify the 5-digit code!` });
        return;
      }

      if (lobby.state === 'IN_GAME') {
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Match is already active in room ${targetCode}!` });
        return;
      }

      if (lobby.players.size >= lobby.maxPlayers) {
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Lobby "${targetCode}" is full (${lobby.maxPlayers}/${lobby.maxPlayers})!` });
        return;
      }

      leaveCurrentRoom(ws, client);

      let redCount = 0;
      let blueCount = 0;
      for (const p of lobby.players.values()) {
        if (p.team === 'RED') redCount++;
        else if (p.team === 'BLUE') blueCount++;
      }

      client.team = lobby.mode === 'FFA' ? 'FFA' : (redCount <= blueCount ? 'RED' : 'BLUE');
      client.roomCode = targetCode;
      client.ready = false;
      lobby.players.set(client.id, client);

      console.log(`[LOBBY] ${client.nickname} joined lobby ${targetCode}`);

      send(ws, 'LOBBY_JOIN_SUCCESS', {
        roomCode: targetCode,
        isHost: lobby.hostId === client.id,
        lobby: serializeLobby(lobby)
      });

      broadcastLobbyState(targetCode);
      break;
    }

    case 'SET_TEAM': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby || lobby.mode === 'FFA') return;

      client.team = payload?.team === 'BLUE' ? 'BLUE' : 'RED';
      broadcastLobbyState(client.roomCode);
      break;
    }

    case 'TOGGLE_READY': {
      if (!client.roomCode) return;
      client.ready = !client.ready;
      broadcastLobbyState(client.roomCode);
      break;
    }

    case 'UPDATE_SETTINGS': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby || lobby.hostId !== client.id) return;

      if (payload.mode) {
        lobby.mode = payload.mode;
        lobby.maxPlayers = payload.mode === '1v1' ? 2 : payload.mode === '2v2' ? 4 : 8;
      }
      if (payload.map) lobby.map = payload.map;
      if (payload.killLimit) lobby.killLimit = Number(payload.killLimit);
      if (payload.timeLimitSec) lobby.timeLimitSec = Number(payload.timeLimitSec);

      broadcastLobbyState(client.roomCode);
      break;
    }

    case 'START_GAME': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby || lobby.hostId !== client.id) return;

      lobby.state = 'IN_GAME';
      console.log(`[MATCH] Starting match in lobby ${lobby.code} (${lobby.mode})`);

      broadcastToRoom(lobby.code, 'MATCH_START', {
        roomCode: lobby.code,
        mode: lobby.mode,
        map: lobby.map,
        timeLimitSec: lobby.timeLimitSec,
        killLimit: lobby.killLimit,
        players: Array.from(lobby.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          team: p.team
        }))
      });
      break;
    }

    // ──────────────── IN-GAME REAL-TIME COMBAT RELAYS ────────────────
    case 'PLAYER_SYNC': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PLAYER_SYNC', {
        id: client.id,
        ...payload
      }, ws);
      break;
    }

    // Primary infinite bullets
    case 'BULLET_FIRE': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'BULLET_FIRE', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    // Tactical Item 1: Frag Grenade Throw
    case 'GRENADE_THROW': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'GRENADE_THROW', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    // Tactical Item 2: Proximity Landmine Plant
    case 'MINE_PLANT': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'MINE_PLANT', {
        ownerId: client.id,
        team: client.team,
        ...payload
      }, ws);
      break;
    }

    // Tactical Item 3: Smoke Bomb Deploy
    case 'SMOKE_SPAWN': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'SMOKE_SPAWN', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    // Map Item Pickup & Respawn Cycle
    case 'PICKUP_COLLECT': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PICKUP_COLLECT', {
        pickerId: client.id,
        pickupId: payload.pickupId,
        pickupType: payload.pickupType
      });

      // Schedule crate respawn in 15 seconds
      setTimeout(() => {
        broadcastToRoom(client.roomCode, 'PICKUP_RESPAWN', {
          pickupId: payload.pickupId
        });
      }, 15000);
      break;
    }

    case 'PLAYER_HIT': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PLAYER_HIT', payload);
      break;
    }

    case 'PLAYER_KILLED': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PLAYER_KILLED', {
        victimId: payload.victimId,
        killerId: payload.killerId,
        weapon: payload.weapon
      });
      break;
    }

    case 'RESPAWN_REQUEST': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PLAYER_RESPAWNED', {
        id: client.id,
        ...payload
      });
      break;
    }
  }
}

function leaveCurrentRoom(ws, client) {
  if (!client.roomCode) return;
  const lobby = lobbies.get(client.roomCode);
  if (lobby) {
    lobby.players.delete(client.id);
    if (lobby.players.size === 0) {
      lobbies.delete(client.roomCode);
      console.log(`[LOBBY] Room ${client.roomCode} closed`);
    } else {
      if (lobby.hostId === client.id) {
        const nextHost = lobby.players.values().next().value;
        lobby.hostId = nextHost.id;
        nextHost.ready = true;
      }
      broadcastLobbyState(client.roomCode);
    }
  }
  client.roomCode = null;
}

function handleDisconnect(ws, client) {
  leaveCurrentRoom(ws, client);
  clients.delete(ws);
  console.log(`[DISCONNECT] Player ${client.id} disconnected`);
}

function serializeLobby(lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    mode: lobby.mode,
    maxPlayers: lobby.maxPlayers,
    map: lobby.map,
    timeLimitSec: lobby.timeLimitSec,
    killLimit: lobby.killLimit,
    state: lobby.state,
    players: Array.from(lobby.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      team: p.team,
      ready: p.ready,
      isHost: p.id === lobby.hostId
    }))
  };
}

function broadcastLobbyState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return;
  broadcastToRoom(roomCode, 'LOBBY_UPDATE', { lobby: serializeLobby(lobby) });
}

function broadcastToRoom(roomCode, type, payload, excludeWs = null) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return;
  const data = JSON.stringify({ type, payload });

  for (const player of lobby.players.values()) {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function send(ws, type, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

server.listen(PORT, () => {
  console.log(`🚀 Mini Militia Game Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
});
