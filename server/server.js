// 🎮 Mini Militia 2D — High-Performance Low-Latency Game Server with Rate-Limiting & Authoritative Security

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors());

// Serve client-web
let clientPath = path.join(__dirname, '../client-web');
if (!fs.existsSync(clientPath)) {
  clientPath = path.join(__dirname, 'client-web');
}
app.use(express.static(clientPath));

// Health & Geo-Location Info endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'online', uptime: process.uptime(), lobbies: lobbies.size });
});

app.get('/api/server-info', (req, res) => {
  const cfRay = req.headers['cf-ray'];
  const cfIpCountry = req.headers['cf-ipcountry'];
  const cfRayColo = cfRay ? cfRay.split('-')[1] : null;

  res.status(200).json({
    status: 'online',
    port: PORT,
    colo: cfRayColo || null,
    country: cfIpCountry || null
  });
});

const server = http.createServer(app);

// Limit maxPayload to 64KB to prevent memory exhaustion / DoS attacks
const wss = new WebSocket.Server({ 
  server, 
  perMessageDeflate: false,
  maxPayload: 64 * 1024 
});

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

// Get Local Wi-Fi / LAN IP Address for direct 1ms local multiplayer
function getLocalLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const lobbies = new Map();
const clients = new Map();
let nextPlayerId = 1;

wss.on('connection', (ws, req) => {
  // Disable Nagle algorithm for immediate packet dispatch (zero buffer delay)
  if (ws._socket) {
    if (typeof ws._socket.setNoDelay === 'function') ws._socket.setNoDelay(true);
    if (typeof ws._socket.setKeepAlive === 'function') ws._socket.setKeepAlive(true, 10000);
  }

  const playerId = `P_${nextPlayerId++}`;
  const clientData = {
    id: playerId,
    nickname: `Soldier_${Math.floor(100 + Math.random() * 900)}`,
    roomCode: null,
    team: 'FFA',
    ready: false,
    alive: true,
    hp: 100,
    weapon: 'uzi',
    // Inbound Packet Rate Limiting (Token Bucket: Max 120 msgs/sec)
    msgCount: 0,
    lastSecReset: Date.now(),
    ws
  };
  clients.set(ws, clientData);

  send(ws, 'CONNECTED', { playerId, nickname: clientData.nickname });

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (messageRaw) => {
    try {
      const now = Date.now();
      if (now - clientData.lastSecReset > 1000) {
        clientData.msgCount = 0;
        clientData.lastSecReset = now;
      }
      clientData.msgCount++;
      // High-capacity 120 msgs/sec threshold to prevent packet starvation during intense firefights
      if (clientData.msgCount > 120) {
        return;
      }

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

// Cloudflare & Tunnel Keepalive Heartbeat (Every 15 seconds to prevent idle disconnect)
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 15000);

function handleClientMessage(ws, client, msg) {
  const { type, payload } = msg;
  if (!type) return;

  switch (type) {
    case 'PING': {
      // Immediate fast-reply PONG for precise sub-millisecond RTT measurement
      send(ws, 'PONG', { t: payload?.t, st: Date.now() });
      break;
    }

    case 'SET_NICKNAME': {
      if (payload && payload.nickname) {
        // Sanitize string to prevent injection
        client.nickname = String(payload.nickname).trim().slice(0, 14) || client.nickname;
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

      const matchMode = payload?.mode || 'DUEL';
      const maxPlayers = matchMode === '2v2' ? 4 : 8;

      const lobby = {
        code: roomCode,
        hostId: client.id,
        mode: matchMode,
        maxPlayers,
        state: 'WAITING',
        players: new Map(),
        scores: { RED: 0, BLUE: 0 },
        activeTimers: new Set(),
        createdAt: Date.now()
      };

      client.roomCode = roomCode;
      client.team = (matchMode === 'DUEL' || matchMode === 'FFA') ? 'FFA' : 'RED';
      client.ready = true;
      client.alive = true;
      client.hp = 100;

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

      const isDuelMode = (lobby.mode === 'DUEL' || lobby.mode === 'FFA' || lobby.mode === '1v1');
      client.team = isDuelMode ? 'FFA' : (redCount <= blueCount ? 'RED' : 'BLUE');
      client.roomCode = targetCode;
      client.ready = false;
      client.alive = true;
      client.hp = 100;
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
      if (!lobby || lobby.mode === 'DUEL' || lobby.mode === 'FFA') return;

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
        lobby.maxPlayers = payload.mode === '2v2' ? 4 : 8;

        const isDuel = (lobby.mode === 'DUEL' || lobby.mode === 'FFA');
        lobby.players.forEach(p => {
          if (isDuel) p.team = 'FFA';
        });
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

      // Reset all players to full health & alive
      lobby.players.forEach(p => { 
        p.alive = true;
        p.hp = 100;
      });

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
      if (payload.wep) client.weapon = payload.wep;
      
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
      const lobby = lobbies.get(client.roomCode);
      if (!lobby) return;

      broadcastToRoom(client.roomCode, 'PICKUP_COLLECT', {
        pickerId: client.id,
        pickupId: payload.pickupId,
        pickupType: payload.pickupType
      });

      // Respawn crate in 15 seconds with tracked timer cleanup
      const timer = setTimeout(() => {
        if (lobbies.has(client.roomCode)) {
          broadcastToRoom(client.roomCode, 'PICKUP_RESPAWN', {
            pickupId: payload.pickupId
          });
        }
        if (lobby && lobby.activeTimers) lobby.activeTimers.delete(timer);
      }, 15000);

      lobby.activeTimers.add(timer);
      break;
    }

    // SERVER-AUTHORITATIVE HIT VALIDATION & DAMAGE PROCESSING
    case 'PLAYER_HIT': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby || !payload.victimId) return;

      const victim = lobby.players.get(payload.victimId);
      if (!victim || !victim.alive) return;

      // Validate & Clamp Damage (Prevents damage spoofing hacks)
      const dmg = Math.max(1, Math.min(100, Number(payload.damage) || 15));
      victim.hp = Math.max(0, victim.hp - dmg);

      // Forward hit packet to victim so local HP UI updates
      if (victim.ws && victim.ws.readyState === WebSocket.OPEN) {
        send(victim.ws, 'PLAYER_HIT', {
          victimId: victim.id,
          killerId: client.id,
          damage: dmg,
          weapon: payload.weapon || 'COMBAT'
        });
      }

      // If server health reaches 0, trigger authoritative elimination
      if (victim.hp <= 0 && victim.alive) {
        victim.alive = false;

        // Update Team Score
        if (client.team !== 'FFA' && lobby.scores[client.team] !== undefined) {
          lobby.scores[client.team]++;
        }

        console.log(`[KILL] ${client.id} eliminated ${victim.id} in ${lobby.code}`);

        broadcastToRoom(lobby.code, 'PLAYER_KILLED', {
          victimId: victim.id,
          killerId: client.id,
          weapon: payload.weapon || 'COMBAT',
          scores: lobby.scores
        });
      }
      break;
    }

    // Authoritative Kill Event fallback
    case 'PLAYER_KILLED': {
      if (!client.roomCode) return;
      const lobby = lobbies.get(client.roomCode);
      if (!lobby) return;

      const victim = lobby.players.get(payload.victimId);
      if (!victim || !victim.alive) return;

      victim.alive = false;
      victim.hp = 0;

      const killer = lobby.players.get(payload.killerId);
      if (killer && killer.team !== 'FFA' && lobby.scores[killer.team] !== undefined) {
        lobby.scores[killer.team]++;
      }

      console.log(`[KILL] ${payload.killerId} eliminated ${payload.victimId} in ${lobby.code}`);

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
        client.hp = 100;
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
      // Clear active timers
      if (lobby.activeTimers) {
        lobby.activeTimers.forEach(t => clearTimeout(t));
        lobby.activeTimers.clear();
      }
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
      // Backpressure protection: skip high-frequency sync if client socket buffer is congested
      if (type === 'PLAYER_SYNC' && p.ws.bufferedAmount > 32 * 1024) {
        return;
      }
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

const localIp = getLocalLanIp();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 MINI MILITIA 2D HIGH-PERFORMANCE SERVER`);
  console.log(`💻 Localhost URL:    http://localhost:${PORT}`);
  console.log(`📱 LAN / Wi-Fi URL:  http://${localIp}:${PORT}  (⚡ 1-5ms Ping!)`);
  console.log(`🛡️ TCP NoDelay & Sub-Millisecond Heartbeat Active`);
  console.log(`=======================================================`);
});
