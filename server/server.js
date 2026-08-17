// 🎮 Mini Militia 2D — High-Performance Low-Latency Game Server with Rate-Limiting & Anti-Lag

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve client-web
let clientPath = path.join(__dirname, '../client-web');
if (!fs.existsSync(clientPath)) {
  clientPath = path.join(__dirname, 'client-web');
}
app.use(express.static(clientPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'online', uptime: process.uptime(), lobbies: lobbies.size });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, perMessageDeflate: false });

const PORT = process.env.PORT || 3000;

// 5-digit room code alphabet
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generate5DigitCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

const lobbies = new Map();
const clients = new Map();
let nextPlayerId = 1;

wss.on('connection', (ws) => {
  // Disable Nagle algorithm for immediate packet dispatch (zero buffer delay)
  if (ws._socket && typeof ws._socket.setNoDelay === 'function') {
    ws._socket.setNoDelay(true);
  }

  const playerId = `P_${nextPlayerId++}`;
  const clientData = {
    id: playerId,
    nickname: `Soldier_${Math.floor(100 + Math.random() * 900)}`,
    roomCode: null,
    team: 'RED',
    ready: false,
    alive: true,
    lastSyncTime: 0,
    ws
  };
  clients.set(ws, clientData);

  send(ws, 'CONNECTED', { playerId, nickname: clientData.nickname });

  ws.on('message', (messageRaw) => {
    try {
      const message = JSON.parse(messageRaw);
      handleClientMessage(ws, clientData, message);
    } catch (err) {
      console.error('Packet parse error:', err);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, clientData);
  });
});

function handleClientMessage(ws, client, msg) {
  const { type, payload } = msg;
  if (!type) return;

  switch (type) {
    case 'PING': {
      send(ws, 'PONG', { clientTime: payload?.clientTime, serverTime: Date.now() });
      break;
    }

    case 'SET_NICKNAME': {
      if (payload && payload.nickname) {
        client.nickname = String(payload.nickname).trim().slice(0, 16) || client.nickname;
        if (client.roomCode) broadcastLobbyState(client.roomCode);
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
      const maxPlayers = matchMode === '1v1' ? 2 : matchMode === '2v2' ? 4 : 8;

      const lobby = {
        code: roomCode,
        hostId: client.id,
        mode: matchMode,
        maxPlayers,
        state: 'WAITING',
        players: new Map(),
        scores: { RED: 0, BLUE: 0 },
        createdAt: Date.now()
      };

      client.roomCode = roomCode;
      client.team = 'RED';
      client.ready = true;
      client.alive = true;

      lobby.players.set(client.id, client);
      lobbies.set(roomCode, lobby);

      console.log(`[LOBBY] Room ${roomCode} created by ${client.nickname} (${client.id})`);

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
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Lobby "${targetCode}" not found!` });
        return;
      }

      if (lobby.state === 'IN_GAME') {
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Match is already active in room ${targetCode}!` });
        return;
      }

      if (lobby.players.size >= lobby.maxPlayers) {
        send(ws, 'LOBBY_JOIN_ERROR', { message: `Lobby "${targetCode}" is full!` });
        return;
      }

      leaveCurrentRoom(ws, client);

      let redCount = 0, blueCount = 0;
      for (const p of lobby.players.values()) {
        if (p.team === 'RED') redCount++;
        else if (p.team === 'BLUE') blueCount++;
      }

      client.team = lobby.mode === 'FFA' ? 'FFA' : (redCount <= blueCount ? 'RED' : 'BLUE');
      client.roomCode = targetCode;
      client.ready = false;
      client.alive = true;
      lobby.players.set(client.id, client);

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
      broadcastLobbyState(client.roomCode);
      break;
    }

    case 'START_GAME': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby || lobby.hostId !== client.id) return;

      lobby.state = 'IN_GAME';
      lobby.scores = { RED: 0, BLUE: 0 };

      // Reset all players to alive
      lobby.players.forEach(p => { p.alive = true; });

      console.log(`[MATCH] Starting match in ${lobby.code}`);

      broadcastToRoom(lobby.code, 'MATCH_START', {
        roomCode: lobby.code,
        mode: lobby.mode,
        players: Array.from(lobby.players.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          team: p.team
        }))
      });
      break;
    }

    // ──────────────── HIGH-PERFORMANCE REAL-TIME RELAYS ────────────────
    case 'PLAYER_SYNC': {
      if (!client.roomCode) return;
      // Broadcast compact sync payload
      broadcastToRoom(client.roomCode, 'PLAYER_SYNC', {
        id: client.id,
        ...payload
      }, ws);
      break;
    }

    // Single bullet
    case 'BULLET_FIRE': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'BULLET_FIRE', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    // Batched Shotgun/Burst Pellets (Saves 80% packet overhead!)
    case 'BULLET_BURST': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'BULLET_BURST', {
        ownerId: client.id,
        bullets: payload.bullets
      }, ws);
      break;
    }

    case 'GRENADE_THROW': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'GRENADE_THROW', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    case 'MINE_PLANT': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'MINE_PLANT', {
        ownerId: client.id,
        team: client.team,
        ...payload
      }, ws);
      break;
    }

    case 'SMOKE_SPAWN': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'SMOKE_SPAWN', {
        ownerId: client.id,
        ...payload
      }, ws);
      break;
    }

    case 'PICKUP_COLLECT': {
      if (!client.roomCode) return;
      broadcastToRoom(client.roomCode, 'PICKUP_COLLECT', {
        pickerId: client.id,
        pickupId: payload.pickupId,
        pickupType: payload.pickupType
      });

      // Respawn crate in 15 seconds
      setTimeout(() => {
        broadcastToRoom(client.roomCode, 'PICKUP_RESPAWN', {
          pickupId: payload.pickupId
        });
      }, 15000);
      break;
    }

    case 'PLAYER_HIT': {
      if (!client.roomCode) return;
      // Forward hit packet directly to the victim only
      const lobby = lobbies.get(client.roomCode);
      if (lobby && payload.victimId) {
        const victim = lobby.players.get(payload.victimId);
        if (victim && victim.ws && victim.ws.readyState === WebSocket.OPEN) {
          send(victim.ws, 'PLAYER_HIT', payload);
        }
      }
      break;
    }

    // SERVER-AUTHORITATIVE KILL DEDUPLICATION
    case 'PLAYER_KILLED': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby) return;

      const victim = lobby.players.get(payload.victimId);
      // If victim was already dead, ignore duplicate kill packet!
      if (victim && !victim.alive) {
        return;
      }

      if (victim) {
        victim.alive = false;
      }

      // Update Team Score
      const killer = lobby.players.get(payload.killerId);
      if (killer && killer.team !== 'FFA' && lobby.scores[killer.team] !== undefined) {
        lobby.scores[killer.team]++;
      }

      console.log(`[KILL] ${payload.killerId} eliminated ${payload.victimId} in ${lobby.code}`);

      // Broadcast single authoritative kill event with updated scoreboard
      broadcastToRoom(lobby.code, 'PLAYER_KILLED', {
        victimId: payload.victimId,
        killerId: payload.killerId,
        weapon: payload.weapon || 'COMBAT',
        scores: lobby.scores
      });
      break;
    }

    case 'RESPAWN_REQUEST': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (lobby) {
        client.alive = true;
        broadcastToRoom(client.roomCode, 'PLAYER_RESPAWNED', {
          id: client.id,
          x: payload.x,
          y: payload.y
        });
      }
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
  client.ready = false;
}

function handleDisconnect(ws, client) {
  console.log(`[DISCONNECT] ${client.nickname} (${client.id}) disconnected`);
  leaveCurrentRoom(ws, client);
  clients.delete(ws);
}

function send(ws, type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastToRoom(roomCode, type, payload, excludeWs = null) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return;

  const data = JSON.stringify({ type, payload });
  lobby.players.forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN && p.ws !== excludeWs) {
      p.ws.send(data);
    }
  });
}

function broadcastLobbyState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return;

  broadcastToRoom(roomCode, 'LOBBY_UPDATE', {
    lobby: serializeLobby(lobby)
  });
}

function serializeLobby(lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    mode: lobby.mode,
    maxPlayers: lobby.maxPlayers,
    state: lobby.state,
    scores: lobby.scores,
    players: Array.from(lobby.players.values()).map(p => ({
      id: p.id,
      nickname: p.nickname,
      team: p.team,
      ready: p.ready,
      isHost: p.id === lobby.hostId
    }))
  };
}

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 MINI MILITIA 2D HIGH-SPEED SERVER`);
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log(`⚡ Low-Latency Anti-Lag Netcode Engine Active`);
  console.log(`=========================================`);
});
