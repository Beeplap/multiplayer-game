// 🎮 Mini Militia 2D — Tactical Combat with Yellow Toxic Gas, Sticky Landmines & Crosshair

class MultiplayerGameApp {
  constructor() {
    this.ws = null;
    this.myPlayerId = null;
    this.myNickname = "Commander";
    this.currentRoom = null;
    this.isHost = false;

    // Wide Natural World & Smooth Tracking Camera
    this.worldWidth = 3600;
    this.worldHeight = 1200;
    this.camera = { x: 0, y: 0 };

    this.currentWeapon = 'uzi';
    this.activeThrowable = 'grenade'; // 'grenade' | 'mine' | 'toxic_gas'
    this.walkCycle = 0;
    this.recoilOffset = 0;
    this.nearbyGun = null;
    this.pickupNotifications = [];
    this.respawnTimer = 0;
    this.toxicDamageTick = 0;

    // Dynamic 1x-4x Zoom System
    this.zoomPresets = [
      { label: '1x', scale: 1.0 },
      { label: '2x', scale: 0.72 },
      { label: '3x', scale: 0.50 },
      { label: '4x', scale: 0.35 }
    ];
    this.zoomIndex = 0;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;

    this.initDOM();
    this.detectTouchDevice();
    this.loadAssets();
    this.initWebSocket();
    this.setupEventListeners();
    this.initGameCanvas();
  }

  detectTouchDevice() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia("(pointer: coarse)").matches);
    if (isTouch) {
      document.body.classList.add('is-touch-device');
    }
  }

  initDOM() {
    this.screens = {
      menu: document.getElementById('screen-main-menu'),
      lobby: document.getElementById('screen-lobby'),
      game: document.getElementById('screen-game')
    };

    this.nicknameInput = document.getElementById('player-nickname');
    this.serverUrlInput = document.getElementById('server-url');
    this.joinCodeInput = document.getElementById('join-code-input');

    this.displayRoomCodeEl = document.getElementById('display-room-code');
    this.lobbyModeTagEl = document.getElementById('lobby-mode-tag');
    this.redPlayerListEl = document.getElementById('red-player-list');
    this.bluePlayerListEl = document.getElementById('blue-player-list');
    this.redCountEl = document.getElementById('red-count');
    this.blueCountEl = document.getElementById('blue-count');
    this.btnStartMatch = document.getElementById('btn-start-match');
    this.hostSettingsBar = document.getElementById('host-settings-bar');

    this.hudHpFill = document.getElementById('hud-hp-fill');
    this.hudHpVal = document.getElementById('hud-hp-val');
    this.hudWeaponName = document.getElementById('hud-weapon-name');
    this.scoreRedEl = document.getElementById('score-red');
    this.scoreBlueEl = document.getElementById('score-blue');
    this.killFeedContainer = document.getElementById('kill-feed-container');

    this.pingValEl = document.getElementById('ping-val');
    this.hudPingDisplay = document.getElementById('hud-ping-display');

    this.btnZoomToggle = document.getElementById('btn-zoom-toggle');
    this.zoomValTextEl = document.getElementById('zoom-val-text');

    this.equipPromptBox = document.getElementById('equip-prompt-box');
    this.equipPromptText = document.getElementById('equip-prompt-text');
    this.btnEquipPrompt = document.getElementById('btn-equip-prompt');

    this.btnToggleThrowable = document.getElementById('btn-toggle-throwable');
    this.btnThrowActive = document.getElementById('btn-throw-active');
    this.tacActiveIconEl = document.getElementById('tac-active-icon');
    this.tacActiveCountEl = document.getElementById('tac-active-count');
  }

  loadAssets() {
    this.assets = {
      bg: new Image(),
      loaded: false
    };

    this.assets.bg.src = 'assets/natural_warzone_bg.jpg';
    this.assets.bg.onload = () => { this.assets.loaded = true; };
  }

  showScreen(screenKey) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (this.screens[screenKey]) {
      this.screens[screenKey].classList.add('active');
    }
  }

  // ──────────────── WEBSOCKET & NETWORKING ────────────────
  initWebSocket() {
    let wsUrl = this.serverUrlInput.value.trim();
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(' Connected to Game Server:', wsUrl);
        this.send('SET_NICKNAME', { nickname: this.nicknameInput.value });

        // Heartbeat Ping (Every 2 seconds)
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.send('PING', { clientTime: Date.now() });
          }
        }, 2000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Packet parse error', e);
        }
      };

      this.ws.onclose = () => {
        if (this.pingInterval) clearInterval(this.pingInterval);
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.error('WebSocket init error', e);
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  handleServerMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'PONG': {
        if (payload && payload.clientTime) {
          const ping = Math.max(1, Date.now() - payload.clientTime);
          if (this.pingValEl) this.pingValEl.textContent = `${ping} ms`;
          const dot = this.hudPingDisplay?.querySelector('.ping-dot');
          if (dot) {
            dot.className = 'ping-dot' + (ping > 120 ? ' high' : ping > 60 ? ' medium' : '');
          }
        }
        break;
      }

      case 'CONNECTED':
        this.myPlayerId = payload.playerId;
        break;

      case 'LOBBY_CREATED':
      case 'LOBBY_JOIN_SUCCESS':
        this.currentRoom = payload.lobby;
        this.isHost = payload.isHost;
        this.displayRoomCodeEl.textContent = payload.roomCode;
        this.updateLobbyUI(payload.lobby);
        this.showScreen('lobby');
        break;

      case 'LOBBY_UPDATE':
        this.currentRoom = payload.lobby;
        this.isHost = payload.lobby.hostId === this.myPlayerId;
        this.updateLobbyUI(payload.lobby);
        break;

      case 'LOBBY_JOIN_ERROR':
      case 'ERROR_MESSAGE':
        alert(payload.message);
        break;

      case 'MATCH_START':
        this.startInGameMatch(payload);
        break;

      case 'PLAYER_SYNC':
        this.handleRemotePlayerSync(payload);
        break;

      case 'BULLET_FIRE':
        this.handleRemoteBullet(payload);
        break;

      case 'BULLET_BURST':
        this.handleRemoteBulletBurst(payload);
        break;

      case 'GRENADE_THROW':
        this.handleRemoteGrenade(payload);
        break;

      case 'MINE_PLANT':
        this.handleRemoteMine(payload);
        break;

      case 'SMOKE_SPAWN':
        this.handleRemoteToxicSmoke(payload);
        break;

      case 'PICKUP_COLLECT':
        this.handleRemotePickupCollect(payload);
        break;

      case 'PICKUP_RESPAWN':
        this.handleRemotePickupRespawn(payload);
        break;

      case 'PLAYER_HIT':
        this.handleRemoteHit(payload);
        break;

      case 'PLAYER_KILLED':
        this.handleRemoteKill(payload);
        break;

      case 'PLAYER_RESPAWNED':
        this.handleRemoteRespawn(payload);
        break;
    }
  }

  // ──────────────── LOBBY MANAGEMENT ────────────────
  setupEventListeners() {
    document.getElementById('btn-create-lobby').addEventListener('click', () => {
      const nickname = this.nicknameInput.value.trim() || 'Commander';
      this.send('SET_NICKNAME', { nickname });
      this.send('CREATE_LOBBY', { mode: '2v2' });
    });

    document.getElementById('btn-join-lobby').addEventListener('click', () => {
      const code = this.joinCodeInput.value.trim().toUpperCase();
      if (code.length !== 5) {
        alert('Please enter a valid 5-digit room code!');
        return;
      }
      const nickname = this.nicknameInput.value.trim() || 'Commander';
      this.send('SET_NICKNAME', { nickname });
      this.send('JOIN_LOBBY', { roomCode: code });
    });

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      if (this.currentRoom) {
        navigator.clipboard.writeText(this.currentRoom.code);
        alert(`Room Code ${this.currentRoom.code} copied! Share with friends! 🚀`);
      }
    });

    document.getElementById('btn-join-red').addEventListener('click', () => {
      this.send('SET_TEAM', { team: 'RED' });
    });
    document.getElementById('btn-join-blue').addEventListener('click', () => {
      this.send('SET_TEAM', { team: 'BLUE' });
    });

    document.getElementById('btn-toggle-ready').addEventListener('click', () => {
      this.send('TOGGLE_READY');
    });

    this.btnStartMatch.addEventListener('click', () => {
      try {
        const el = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen().catch(() => {});
        }
      } catch (e) {}
      this.send('START_GAME');
    });

    document.getElementById('btn-leave-lobby').addEventListener('click', () => {
      window.location.reload();
    });

    document.querySelectorAll('.mode-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.isHost) return;
        const mode = btn.dataset.mode;
        document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.send('UPDATE_SETTINGS', { mode });
      });
    });

    document.getElementById('btn-exit-game').addEventListener('click', () => {
      this.showScreen('lobby');
    });

    // Fullscreen Toggle
    const toggleFullscreen = () => {
      const el = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    };
    const fsBtn = document.getElementById('btn-fullscreen-toggle');
    if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);

    // Instant Touch Actions
    const bindTouchAction = (el, callback) => {
      if (!el) return;
      el.addEventListener('click', (e) => { e.preventDefault(); callback(); });
      el.addEventListener('touchend', (e) => { e.preventDefault(); callback(); });
    };

    bindTouchAction(this.btnEquipPrompt, () => this.equipNearbyGun());
    bindTouchAction(this.btnToggleThrowable, () => this.cycleThrowable());
    bindTouchAction(this.btnThrowActive, () => this.throwActiveItem());
    bindTouchAction(this.btnZoomToggle, () => this.cycleZoomLevel());
  }

  cycleZoomLevel() {
    this.zoomIndex = (this.zoomIndex + 1) % this.zoomPresets.length;
    this.applyZoom();
  }

  setZoomLevel(idx) {
    this.zoomIndex = Math.max(0, Math.min(this.zoomPresets.length - 1, idx));
    this.applyZoom();
  }

  applyZoom() {
    const preset = this.zoomPresets[this.zoomIndex];
    this.targetZoom = preset.scale;
    if (this.zoomValTextEl) this.zoomValTextEl.textContent = preset.label;
    this.addPickupNotification(`🔍 ZOOM: ${preset.label}`, '#00E5FF');
  }

  updateLobbyUI(lobby) {
    this.lobbyModeTagEl.textContent = `${lobby.mode} ${lobby.mode === 'FFA' ? 'FREE FOR ALL' : 'TDM'}`;

    this.hostSettingsBar.style.display = this.isHost ? 'flex' : 'none';
    this.btnStartMatch.style.display = this.isHost ? 'block' : 'none';

    document.querySelectorAll('.mode-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === lobby.mode);
    });

    this.redPlayerListEl.innerHTML = '';
    this.bluePlayerListEl.innerHTML = '';

    let redCount = 0;
    let blueCount = 0;

    lobby.players.forEach(player => {
      const isMe = player.id === this.myPlayerId;
      const card = document.createElement('div');
      card.className = `roster-card ${isMe ? 'is-me' : ''}`;
      card.innerHTML = `
        <span>${player.nickname} ${isMe ? '(YOU)' : ''}</span>
        <div>
          ${player.isHost ? '<span class="host-badge">HOST</span>' : ''}
          <span>${player.ready ? '✅' : '⏳'}</span>
        </div>
      `;

      if (player.team === 'RED') {
        this.redPlayerListEl.appendChild(card);
        redCount++;
      } else {
        this.bluePlayerListEl.appendChild(card);
        blueCount++;
      }
    });

    const maxPerTeam = lobby.mode === '1v1' ? 1 : 2;
    this.redCountEl.textContent = `${redCount}/${maxPerTeam}`;
    this.blueCountEl.textContent = `${blueCount}/${maxPerTeam}`;
  }

  // ──────────────── NATURAL WARZONE SIMULATION ────────────────
  initGameCanvas() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.localPlayer = {
      id: null,
      x: 700,
      y: 900,
      vx: 0,
      vy: 0,
      aimAngle: 0,
      hp: 100,
      isDead: false,
      team: 'RED',
      color: '#FF3366',
      isFlying: false,
      isGrounded: false,
      weapon: 'uzi',
      inventory: {
        grenades: 2,
        mines: 1,
        toxic_gas: 1
      }
    };

    this.remotePlayers = new Map();
    this.bullets = [];
    this.grenades = [];
    this.landmines = [];
    this.toxicClouds = [];
    this.particles = [];

    this.groundY = 1080;
    this.platforms = [];
    this.groundGuns = [];
    this.tacticalPickups = [];

    this.keys = {};
    this.mouse = { x: 0, y: 0, isDown: false };
    this.touchJoyLeft = { active: false, vx: 0, vy: 0 };
    this.touchJoyRight = { active: false, vx: 0, vy: 0, isAiming: false };

    this.setupInputHandlers();
    this.buildNaturalMap();
    this.startDynamicGunSpawner();
    this.startRenderLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  buildNaturalMap() {
    const gy = this.groundY;

    this.platforms = [
      { x: 0, y: gy, w: this.worldWidth, h: 120, type: 'GROUND' },
      { x: 280, y: 880, w: 280, h: 32, type: 'ROCK' },
      { x: 440, y: 660, w: 240, h: 30, type: 'ROCK' },
      { x: 860, y: 780, w: 320, h: 34, type: 'ROCK' },
      { x: 1080, y: 540, w: 260, h: 30, type: 'ROCK' },
      { x: 1600, y: 840, w: 400, h: 36, type: 'HOUSE_ROOF' },
      { x: 1600, y: 876, w: 26, h: 64, type: 'HOUSE_WALL' },
      { x: 1974, y: 876, w: 26, h: 64, type: 'HOUSE_WALL' },
      { x: 2200, y: 840, w: 280, h: 32, type: 'ROCK' },
      { x: 2460, y: 640, w: 300, h: 34, type: 'ROCK' },
      { x: 2880, y: 760, w: 340, h: 32, type: 'ROCK' },
      { x: 3080, y: 520, w: 260, h: 30, type: 'ROCK' }
    ];

    this.tacticalPickups = [
      { id: 'pk_g1', type: 'GRENADE', x: 460, y: 620, label: '💣 FRAG GRENADES', available: true },
      { id: 'pk_m1', type: 'MINE', x: 1140, y: 500, label: '⚡ PROXIMITY MINE', available: true },
      { id: 'pk_s1', type: 'TOXIC_GAS', x: 2520, y: 600, label: '☣️ TOXIC MUSTARD GAS', available: true },
      { id: 'pk_hp1', type: 'MEDKIT', x: 2980, y: 720, label: '❤️ MEDICAL CASE', available: true }
    ];

    this.groundGuns = [
      {
        id: 'central_legendary',
        type: 'rpg',
        name: 'RPG ROCKET LAUNCHER',
        rarity: 'LEGENDARY',
        x: 1800,
        y: 1030,
        available: true
      }
    ];
  }

  startDynamicGunSpawner() {
    setInterval(() => {
      if (this.screens.game.classList.contains('active')) {
        this.spawnRandomGunDrop();
      }
    }, 12000);
  }

  spawnRandomGunDrop() {
    if (this.groundGuns.length >= 6) return;

    const roll = Math.random();
    let gunType = 'uzi';
    let gunName = 'DUAL SMG UZI';
    let rarity = 'COMMON';

    if (roll < 0.08) {
      gunType = 'rpg';
      gunName = 'RPG ROCKET LAUNCHER';
      rarity = 'LEGENDARY';
    } else if (roll < 0.28) {
      gunType = 'sniper';
      gunName = 'MARKSMAN SNIPER';
      rarity = 'RARE';
    } else if (roll < 0.60) {
      gunType = 'shotgun';
      gunName = 'COMBAT SHOTGUN';
      rarity = 'UNCOMMON';
    }

    const spawnSpots = [
      { x: 380, y: 840 },
      { x: 520, y: 620 },
      { x: 980, y: 740 },
      { x: 1160, y: 500 },
      { x: 2280, y: 800 },
      { x: 2540, y: 600 },
      { x: 2980, y: 720 },
      { x: 3180, y: 480 }
    ];

    const spot = spawnSpots[Math.floor(Math.random() * spawnSpots.length)];
    const newGun = {
      id: `gun_${Date.now()}_${Math.random()}`,
      type: gunType,
      name: gunName,
      rarity,
      x: spot.x,
      y: spot.y,
      available: true
    };

    this.groundGuns.push(newGun);
    this.addPickupNotification(`⚡ NEW ${rarity} ${gunName} DROPPED!`, '#FFD600');
  }

  // ──────────────── KEYBINDINGS & INPUT ────────────────
  setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Key E: Pick / Equip Weapons
      if (key === 'e') this.equipNearbyGun();

      // Key Q: Toggle Active Throwable
      if (key === 'q') this.cycleThrowable();

      // Key F: Throw Active Throwable
      if (key === 'f') this.throwActiveItem();

      // Left Shift / Shift Key: Toggle Zoom Level (1x -> 2x -> 3x -> 4x)
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.cycleZoomLevel();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    this.canvas.addEventListener('mousedown', () => { this.mouse.isDown = true; });
    window.addEventListener('mouseup', () => { this.mouse.isDown = false; });

    this.setupTouchJoysticks();
  }

  setupTouchJoysticks() {
    const leftZone = document.getElementById('joy-left-zone');
    const leftThumb = document.getElementById('joy-left-thumb');
    const rightZone = document.getElementById('joy-right-zone');
    const rightThumb = document.getElementById('joy-right-thumb');

    const bindJoystick = (zone, thumb, joyObj, isRight) => {
      let touchId = null;
      let startX = 0, startY = 0;

      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        const rect = zone.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        joyObj.active = true;
      });

      zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchId) {
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            const dist = Math.hypot(dx, dy);
            const maxRadius = 45;
            const clampedDist = Math.min(dist, maxRadius);
            const angle = Math.atan2(dy, dx);

            const thumbX = Math.cos(angle) * clampedDist;
            const thumbY = Math.sin(angle) * clampedDist;

            thumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
            joyObj.vx = thumbX / maxRadius;
            joyObj.vy = thumbY / maxRadius;

            if (isRight && dist > 14) {
              joyObj.isAiming = true;
            }
          }
        }
      });

      const endTouch = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchId) {
            touchId = null;
            thumb.style.transform = `translate(0px, 0px)`;
            joyObj.active = false;
            joyObj.vx = 0;
            joyObj.vy = 0;
            if (isRight) joyObj.isAiming = false;
          }
        }
      };

      zone.addEventListener('touchend', endTouch);
      zone.addEventListener('touchcancel', endTouch);
    };

    bindJoystick(leftZone, leftThumb, this.touchJoyLeft, false);
    bindJoystick(rightZone, rightThumb, this.touchJoyRight, true);
  }

  // ──────────────── THROWABLE TOGGLE & FIRING ────────────────
  cycleThrowable() {
    const types = ['grenade', 'mine', 'toxic_gas'];
    const nextIdx = (types.indexOf(this.activeThrowable) + 1) % types.length;
    this.activeThrowable = types[nextIdx];
    this.updateTacticalHUD();
  }

  throwActiveItem() {
    if (this.activeThrowable === 'grenade') this.triggerGrenadeThrow();
    else if (this.activeThrowable === 'mine') this.triggerMineThrow();
    else if (this.activeThrowable === 'toxic_gas') this.triggerToxicGasDeploy();
  }

  triggerGrenadeThrow() {
    const p = this.localPlayer;
    if (p.isDead || p.hp <= 0 || p.inventory.grenades <= 0) return;

    p.inventory.grenades--;
    this.updateTacticalHUD();

    const speed = 14.0;
    const grenade = {
      id: `g_${Date.now()}_${Math.random()}`,
      ownerId: this.myPlayerId,
      x: Math.round(p.x + Math.cos(p.aimAngle) * 28),
      y: Math.round(p.y + Math.sin(p.aimAngle) * 28),
      vx: Math.round(Math.cos(p.aimAngle) * speed * 10) / 10,
      vy: Math.round((Math.sin(p.aimAngle) * speed - 4.0) * 10) / 10,
      fuse: 100
    };

    this.grenades.push(grenade);
    this.send('GRENADE_THROW', grenade);
  }

  triggerMineThrow() {
    const p = this.localPlayer;
    if (p.isDead || p.hp <= 0 || p.inventory.mines <= 0) return;

    p.inventory.mines--;
    this.updateTacticalHUD();

    const speed = 12.0;
    const mine = {
      id: `m_${Date.now()}_${Math.random()}`,
      ownerId: this.myPlayerId,
      team: p.team,
      x: Math.round(p.x + Math.cos(p.aimAngle) * 24),
      y: Math.round(p.y + Math.sin(p.aimAngle) * 24),
      vx: Math.round(Math.cos(p.aimAngle) * speed * 10) / 10,
      vy: Math.round((Math.sin(p.aimAngle) * speed - 3.0) * 10) / 10,
      stuck: false,
      armed: false,
      armTimer: 45
    };

    this.landmines.push(mine);
    this.send('MINE_PLANT', mine);
  }

  triggerToxicGasDeploy() {
    const p = this.localPlayer;
    if (p.isDead || p.hp <= 0 || p.inventory.toxic_gas <= 0) return;

    p.inventory.toxic_gas--;
    this.updateTacticalHUD();

    const smoke = {
      id: `s_${Date.now()}_${Math.random()}`,
      x: Math.round(p.x + Math.cos(p.aimAngle) * 60),
      y: Math.round(p.y + Math.sin(p.aimAngle) * 60),
      radius: 90,
      life: 450,
      ownerId: this.myPlayerId
    };

    this.toxicClouds.push(smoke);
    this.send('SMOKE_SPAWN', smoke);
  }

  updateTacticalHUD() {
    const inv = this.localPlayer.inventory;
    if (this.activeThrowable === 'grenade') {
      this.tacActiveIconEl.textContent = '💣';
      this.tacActiveCountEl.textContent = inv.grenades;
    } else if (this.activeThrowable === 'mine') {
      this.tacActiveIconEl.textContent = '⚡';
      this.tacActiveCountEl.textContent = inv.mines;
    } else if (this.activeThrowable === 'toxic_gas') {
      this.tacActiveIconEl.textContent = '☣️';
      this.tacActiveCountEl.textContent = inv.toxic_gas;
    }
  }

  equipNearbyGun() {
    if (this.nearbyGun && this.nearbyGun.available && !this.localPlayer.isDead) {
      const oldWeapon = this.currentWeapon;
      this.currentWeapon = this.nearbyGun.type;

      const names = {
        uzi: 'DUAL SMG UZI',
        shotgun: 'COMBAT SHOTGUN',
        sniper: 'MARKSMAN SNIPER',
        rpg: 'ROCKET LAUNCHER'
      };
      this.hudWeaponName.textContent = names[this.currentWeapon] || 'DUAL UZI';

      this.addPickupNotification(`+EQUIPPED ${this.nearbyGun.name}`, '#00E5FF');

      // Auto Adjust Zoom View for Weapon (Sniper: 4x wide, RPG: 3x wide, SMG/Shotgun: 1x)
      if (this.currentWeapon === 'sniper') {
        this.setZoomLevel(3); // 4x Scope View
      } else if (this.currentWeapon === 'rpg') {
        this.setZoomLevel(2); // 3x Wide Blast View
      } else {
        this.setZoomLevel(0); // 1x Standard Close View
      }

      // Swap ground weapon
      this.nearbyGun.type = oldWeapon;
      this.nearbyGun.name = names[oldWeapon] || 'WEAPON';
      this.nearbyGun.rarity = oldWeapon === 'rpg' ? 'LEGENDARY' : oldWeapon === 'sniper' ? 'RARE' : oldWeapon === 'shotgun' ? 'UNCOMMON' : 'COMMON';

      this.equipPromptBox.classList.add('hidden');
    }
  }

  startInGameMatch(matchData) {
    this.showScreen('game');
    this.buildNaturalMap();

    this.localPlayer.id = this.myPlayerId;
    this.localPlayer.hp = 100;
    this.localPlayer.isDead = false;
    this.localPlayer.x = 700 + Math.random() * 800;
    this.localPlayer.y = 900;
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;

    this.localPlayer.inventory = { grenades: 2, mines: 1, toxic_gas: 1 };
    this.activeThrowable = 'grenade';
    this.updateTacticalHUD();

    const meInRoom = this.currentRoom?.players.find(p => p.id === this.myPlayerId);
    this.localPlayer.team = meInRoom?.team || 'RED';
    this.localPlayer.color = this.localPlayer.team === 'BLUE' ? '#00A2FF' : '#FF3366';

    // 20Hz Compact Delta Sync
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.localPlayer.hp > 0 && !this.localPlayer.isDead) {
        this.send('PLAYER_SYNC', {
          x: Math.round(this.localPlayer.x),
          y: Math.round(this.localPlayer.y),
          vx: Math.round(this.localPlayer.vx * 10) / 10,
          vy: Math.round(this.localPlayer.vy * 10) / 10,
          aim: Math.round(this.localPlayer.aimAngle * 100) / 100,
          fly: this.localPlayer.isFlying ? 1 : 0,
          hp: Math.round(this.localPlayer.hp),
          wep: this.currentWeapon
        });
      }
    }, 50);
  }

  handleRemotePlayerSync(data) {
    if (!this.remotePlayers.has(data.id)) {
      this.remotePlayers.set(data.id, {
        id: data.id,
        x: data.x,
        y: data.y,
        vx: data.vx || 0,
        vy: data.vy || 0,
        aimAngle: data.aim || 0,
        hp: data.hp !== undefined ? data.hp : 100,
        team: data.team || 'RED',
        weapon: data.wep || 'uzi',
        color: data.team === 'BLUE' ? '#00A2FF' : '#FF3366',
        targetX: data.x,
        targetY: data.y,
        isDead: false,
        walkCycle: 0
      });
    } else {
      const p = this.remotePlayers.get(data.id);
      p.targetX = data.x;
      p.targetY = data.y;
      p.vx = data.vx || 0;
      p.vy = data.vy || 0;
      p.aimAngle = data.aim !== undefined ? data.aim : p.aimAngle;
      p.hp = data.hp !== undefined ? data.hp : p.hp;
      p.weapon = data.wep || p.weapon;
      if (Math.abs(data.vx) > 0.5) p.walkCycle = (p.walkCycle || 0) + 0.2;
    }
  }

  handleRemoteBullet(bullet) {
    this.bullets.push({
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      weapon: bullet.weapon || 'uzi',
      ownerId: bullet.ownerId,
      color: bullet.color || '#FFD600',
      life: 0
    });
  }

  handleRemoteBulletBurst(data) {
    if (!data.bullets || !Array.isArray(data.bullets)) return;
    for (const b of data.bullets) {
      this.bullets.push({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        weapon: 'shotgun',
        ownerId: data.ownerId,
        color: '#FF7B00',
        life: 0
      });
    }
  }

  handleRemoteGrenade(grenade) {
    this.grenades.push({ ...grenade, fuse: 100 });
  }

  handleRemoteMine(mine) {
    this.landmines.push({ ...mine, armTimer: 45, armed: false, stuck: false });
  }

  handleRemoteToxicSmoke(smoke) {
    this.toxicClouds.push({ ...smoke, life: 450 });
  }

  handleRemotePickupCollect(data) {
    const pk = this.tacticalPickups.find(p => p.id === data.pickupId);
    if (pk) pk.available = false;
  }

  handleRemotePickupRespawn(data) {
    const pk = this.tacticalPickups.find(p => p.id === data.pickupId);
    if (pk) pk.available = true;
  }

  handleRemoteHit(data) {
    if (data.victimId === this.myPlayerId && !this.localPlayer.isDead) {
      this.localPlayer.hp = Math.max(0, this.localPlayer.hp - data.damage);
      if (this.localPlayer.hp <= 0) {
        this.triggerLocalDeath(data.killerId, 'COMBAT');
      }
    }
  }

  handleRemoteKill(data) {
    if (data.scores) {
      if (this.scoreRedEl) this.scoreRedEl.textContent = data.scores.RED || 0;
      if (this.scoreBlueEl) this.scoreBlueEl.textContent = data.scores.BLUE || 0;
    }

    const rp = this.remotePlayers.get(data.victimId);
    if (rp) {
      rp.isDead = true;
      rp.hp = 0;
    }

    const msg = document.createElement('div');
    msg.className = 'kill-msg';
    msg.textContent = `💥 ${data.killerId} eliminated ${data.victimId}`;
    this.killFeedContainer.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }

  handleRemoteRespawn(data) {
    const rp = this.remotePlayers.get(data.id);
    if (rp) {
      rp.isDead = false;
      rp.hp = 100;
      rp.x = data.x;
      rp.y = data.y;
      rp.targetX = data.x;
      rp.targetY = data.y;
    }
  }

  triggerLocalDeath(killerId, weapon) {
    if (this.localPlayer.isDead) return;
    this.localPlayer.isDead = true;
    this.localPlayer.hp = 0;

    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      this.particles.push({
        x: this.localPlayer.x,
        y: this.localPlayer.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#FF3366',
        alpha: 1.0,
        radius: 4 + Math.random() * 4
      });
    }

    this.send('PLAYER_KILLED', {
      victimId: this.myPlayerId,
      killerId,
      weapon
    });

    this.respawnTimer = 3;
    const countdown = setInterval(() => {
      this.respawnTimer--;
      if (this.respawnTimer <= 0) {
        clearInterval(countdown);
        this.respawnLocalPlayer();
      }
    }, 1000);
  }

  respawnLocalPlayer() {
    this.localPlayer.hp = 100;
    this.localPlayer.isDead = false;
    this.localPlayer.x = 700 + Math.random() * 1200;
    this.localPlayer.y = 800;
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;
    this.localPlayer.inventory = { grenades: 2, mines: 1, toxic_gas: 1 };
    this.updateTacticalHUD();

    this.send('RESPAWN_REQUEST', {
      x: Math.round(this.localPlayer.x),
      y: Math.round(this.localPlayer.y)
    });
  }

  // ──────────────── SIMULATION LOOP ────────────────
  startRenderLoop() {
    let lastShootTime = 0;

    const fireDelays = {
      uzi: 110,
      shotgun: 380,
      sniper: 650,
      rpg: 850
    };

    const loop = () => {
      if (this.screens.game.classList.contains('active')) {
        this.updatePhysics();
        this.updateCamera();

        const now = performance.now();
        const shouldShoot = this.mouse.isDown || this.touchJoyRight.isAiming;
        const cooldown = fireDelays[this.currentWeapon] || 110;

        if (shouldShoot && now - lastShootTime > cooldown && this.localPlayer.hp > 0 && !this.localPlayer.isDead) {
          lastShootTime = now;
          this.recoilOffset = 8.0;
          this.fireWeapon();
        }

        if (this.recoilOffset > 0) {
          this.recoilOffset *= 0.82;
        }

        this.renderCanvas();
        this.updateHUD();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateCamera() {
    this.currentZoom += (this.targetZoom - this.currentZoom) * 0.08;

    const targetX = this.localPlayer.x;
    const targetY = this.localPlayer.y;

    this.camera.x += (targetX - this.camera.x) * 0.08;
    this.camera.y += (targetY - this.camera.y) * 0.08;

    const halfVisW = (this.canvas.width / 2) / this.currentZoom;
    const halfVisH = (this.canvas.height / 2) / this.currentZoom;

    this.camera.x = Math.max(halfVisW, Math.min(this.worldWidth - halfVisW, this.camera.x));
    this.camera.y = Math.max(halfVisH, Math.min(this.worldHeight - halfVisH, this.camera.y));
  }

  updatePhysics() {
    const p = this.localPlayer;
    if (p.isDead || p.hp <= 0) return;

    let moveX = 0;
    let thrustY = 0;

    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;
    if (this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) thrustY -= 1;

    if (this.touchJoyLeft.active) {
      moveX = this.touchJoyLeft.vx;
      if (this.touchJoyLeft.vy < -0.15) thrustY = this.touchJoyLeft.vy;
    }

    // Balanced Tactical Movement Physics (Crisp, controllable, non-slippery)
    p.vx += moveX * 0.58;
    p.vx *= 0.86;

    if (Math.abs(p.vx) > 0.3 && p.isGrounded) {
      this.walkCycle += Math.abs(p.vx) * 0.22;
    }

    p.vy += 0.38;

    if (thrustY < 0) {
      p.vy -= 0.76;
      p.vy = Math.max(-6.5, p.vy);
      p.isFlying = true;
      p.isGrounded = false;
      this.spawnJetpackParticle(p.x, p.y + 16, p.aimAngle);
    } else {
      p.isFlying = false;
    }

    p.vy = Math.min(7.5, p.vy);

    p.x += p.vx;
    p.y += p.vy;

    // ──────────────── WORLD BOUNDARIES ────────────────
    const soldierRadius = 22;
    const gy = this.groundY;

    if (p.x - soldierRadius < 10) { p.x = 10 + soldierRadius; p.vx = 0; }
    if (p.x + soldierRadius > this.worldWidth - 10) { p.x = this.worldWidth - 10 - soldierRadius; p.vx = 0; }
    if (p.y - soldierRadius < 15) { p.y = 15 + soldierRadius; p.vy = 0; }
    if (p.y + soldierRadius > gy) { p.y = gy - soldierRadius; p.vy = 0; p.isGrounded = true; }

    p.isGrounded = p.y + soldierRadius >= gy - 2;
    for (const plat of this.platforms) {
      if (
        p.x + soldierRadius > plat.x &&
        p.x - soldierRadius < plat.x + plat.w &&
        p.y + soldierRadius >= plat.y &&
        p.y + soldierRadius <= plat.y + 24 &&
        p.vy >= 0
      ) {
        p.y = plat.y - soldierRadius;
        p.vy = 0;
        p.isGrounded = true;
      }
    }

    if (this.touchJoyRight.isAiming) {
      p.aimAngle = Math.atan2(this.touchJoyRight.vy, this.touchJoyRight.vx);
    } else {
      const worldMouseX = this.camera.x + (this.mouse.x - this.canvas.width / 2) / this.currentZoom;
      const worldMouseY = this.camera.y + (this.mouse.y - this.canvas.height / 2) / this.currentZoom;
      p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    }

    // Dead-Reckoning for Remote Players
    this.remotePlayers.forEach(rp => {
      if (!rp.isDead) {
        rp.targetX += rp.vx * 0.5;
        rp.targetY += rp.vy * 0.5;
        rp.targetX = Math.max(soldierRadius + 10, Math.min(this.worldWidth - soldierRadius - 10, rp.targetX));
        rp.targetY = Math.max(soldierRadius + 15, Math.min(gy - soldierRadius, rp.targetY));
        rp.x += (rp.targetX - rp.x) * 0.28;
        rp.y += (rp.targetY - rp.y) * 0.28;
      }
    });

    // ──────────────── BULLET & PLATFORM COLLISION ────────────────
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life++;

      let hitPlatform = false;
      for (const plat of this.platforms) {
        if (
          b.x >= plat.x && b.x <= plat.x + plat.w &&
          b.y >= plat.y && b.y <= plat.y + plat.h
        ) {
          hitPlatform = true;
          this.spawnImpactSparks(b.x, b.y, b.color);
          if (b.weapon === 'rpg') {
            this.createExplosion(b.x, b.y, 95, 95, b.ownerId);
          }
          break;
        }
      }

      if (hitPlatform) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Hit Local Player
      if (b.ownerId !== this.myPlayerId && p.hp > 0 && !p.isDead) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < soldierRadius + 4) {
          const dmg = b.weapon === 'sniper' ? 70 : b.weapon === 'shotgun' ? 14 : b.weapon === 'rpg' ? 90 : 18;
          this.spawnImpactSparks(b.x, b.y, '#FF3366');

          if (b.weapon === 'rpg') {
            this.createExplosion(b.x, b.y, 95, 95, b.ownerId);
          } else {
            p.hp = Math.max(0, p.hp - dmg);
            if (p.hp <= 0) {
              this.triggerLocalDeath(b.ownerId, b.weapon);
            }
          }

          this.bullets.splice(i, 1);
          continue;
        }
      }

      if (b.x < 0 || b.x > this.worldWidth || b.y < 0 || b.y > gy || b.life > 75) {
        this.bullets.splice(i, 1);
      }
    }

    // ──────────────── GRENADES UPDATE ────────────────
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy += 0.42;
      g.x += g.vx;
      g.y += g.vy;
      g.fuse--;

      if (g.x < 15 || g.x > this.worldWidth - 15) {
        g.vx = -g.vx * 0.7;
        g.x = Math.max(15, Math.min(this.worldWidth - 15, g.x));
      }
      if (g.y >= gy - 8) {
        g.y = gy - 8;
        g.vy = -g.vy * 0.55;
        g.vx *= 0.75;
      }

      for (const plat of this.platforms) {
        if (
          g.x >= plat.x && g.x <= plat.x + plat.w &&
          g.y >= plat.y && g.y <= plat.y + plat.h
        ) {
          g.y = plat.y - 6;
          g.vy = -g.vy * 0.5;
          g.vx *= 0.75;
          break;
        }
      }

      if (g.fuse <= 0) {
        this.createExplosion(g.x, g.y, 85, 85, g.ownerId);
        this.grenades.splice(i, 1);
      }
    }

    // ──────────────── LANDMINES (STICKY GROUND & AIR IMPACT DETONATION) ────────────────
    for (let i = this.landmines.length - 1; i >= 0; i--) {
      const m = this.landmines[i];

      if (!m.stuck) {
        // Airborne physics
        m.vy = (m.vy || 0) + 0.38;
        m.x += (m.vx || 0);
        m.y += m.vy;

        // DIRECT BODY CONTACT IN AIR -> INSTANT DETONATION
        if (m.ownerId !== this.myPlayerId && p.hp > 0 && !p.isDead && Math.hypot(m.x - p.x, m.y - p.y) < 28) {
          this.createExplosion(m.x, m.y, 90, 100, m.ownerId);
          this.landmines.splice(i, 1);
          continue;
        }

        // Stick to ground floor
        if (m.y >= gy - 6) {
          m.y = gy - 6;
          m.vx = 0;
          m.vy = 0;
          m.stuck = true;
        }

        // Stick to platforms
        for (const plat of this.platforms) {
          if (
            m.x >= plat.x && m.x <= plat.x + plat.w &&
            m.y >= plat.y - 6 && m.y <= plat.y + 14
          ) {
            m.y = plat.y - 6;
            m.vx = 0;
            m.vy = 0;
            m.stuck = true;
            break;
          }
        }
      } else {
        // Sticked on ground -> Arming & Triggering
        if (!m.armed) {
          m.armTimer--;
          if (m.armTimer <= 0) m.armed = true;
        } else {
          // Armed proximity trigger
          if (m.team !== p.team && p.hp > 0 && !p.isDead && Math.hypot(m.x - p.x, m.y - p.y) < 45) {
            this.createExplosion(m.x, m.y, 90, 100, m.ownerId);
            this.landmines.splice(i, 1);
          }
        }
      }
    }

    // ──────────────── YELLOW TOXIC GAS (CONTINUOUS HP DRAIN) ────────────────
    this.toxicDamageTick++;
    for (let i = this.toxicClouds.length - 1; i >= 0; i--) {
      const s = this.toxicClouds[i];
      s.life--;

      // Spawn ambient toxic particles
      if (Math.random() < 0.4) {
        this.particles.push({
          x: s.x + (Math.random() - 0.5) * s.radius * 1.5,
          y: s.y + (Math.random() - 0.5) * s.radius * 1.2,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.5 - Math.random() * 1.0,
          color: Math.random() > 0.4 ? '#FFE500' : '#88DD00',
          alpha: 0.8,
          radius: 6 + Math.random() * 8
        });
      }

      // HP Drain on Local Player inside toxic cloud
      if (p.hp > 0 && !p.isDead && Math.hypot(p.x - s.x, p.y - s.y) < s.radius + 15) {
        if (this.toxicDamageTick % 18 === 0) {
          const toxicDmg = 3;
          p.hp = Math.max(0, p.hp - toxicDmg);
          this.addPickupNotification('-3 HP (☣️ TOXIC GAS)', '#FFE500');

          if (p.hp <= 0) {
            this.triggerLocalDeath(s.ownerId || 'TOXIC', 'TOXIC_GAS');
          }
        }
      }

      if (s.life <= 0) this.toxicClouds.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.03;
      if (pt.alpha <= 0) this.particles.splice(i, 1);
    }

    // Auto-Pickups
    for (const pk of this.tacticalPickups) {
      if (pk.available && !p.isDead && Math.hypot(p.x - pk.x, p.y - pk.y) < 38) {
        pk.available = false;

        if (pk.type === 'GRENADE') { p.inventory.grenades = Math.min(4, p.inventory.grenades + 2); this.addPickupNotification('+2 FRAG GRENADES', '#00E676'); }
        else if (pk.type === 'MINE') { p.inventory.mines = Math.min(3, p.inventory.mines + 1); this.addPickupNotification('+1 PROXIMITY MINE', '#FF3366'); }
        else if (pk.type === 'TOXIC_GAS') { p.inventory.toxic_gas = Math.min(3, p.inventory.toxic_gas + 1); this.addPickupNotification('+1 TOXIC GAS BOMB', '#FFE500'); }
        else if (pk.type === 'MEDKIT') { p.hp = Math.min(100, p.hp + 50); this.addPickupNotification('+50 HEALTH RESTORED', '#00E676'); }

        this.updateTacticalHUD();
        this.send('PICKUP_COLLECT', { pickupId: pk.id, pickupType: pk.type });
      }
    }

    // Manual [E] Gun Prompt
    this.nearbyGun = null;
    let closestDist = 52;

    for (const gun of this.groundGuns) {
      if (gun.available && !p.isDead) {
        const dist = Math.hypot(p.x - gun.x, p.y - gun.y);
        if (dist < closestDist) {
          closestDist = dist;
          this.nearbyGun = gun;
        }
      }
    }

    if (this.nearbyGun) {
      this.equipPromptBox.classList.remove('hidden');
      this.equipPromptText.textContent = `EQUIP ${this.nearbyGun.name}`;
    } else {
      this.equipPromptBox.classList.add('hidden');
    }

    for (let i = this.pickupNotifications.length - 1; i >= 0; i--) {
      const notif = this.pickupNotifications[i];
      notif.y -= 0.8;
      notif.alpha -= 0.02;
      if (notif.alpha <= 0) this.pickupNotifications.splice(i, 1);
    }
  }

  addPickupNotification(text, color) {
    this.pickupNotifications.push({
      text,
      color,
      x: this.localPlayer.x,
      y: this.localPlayer.y - 45,
      alpha: 1.0
    });
  }

  createExplosion(x, y, radius, maxDamage, attackerId) {
    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#FF3366' : '#FFD600',
        alpha: 1.0,
        radius: 5 + Math.random() * 6
      });
    }

    const p = this.localPlayer;
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist <= radius && p.hp > 0 && !p.isDead) {
      const dmg = Math.round(maxDamage * (1 - dist / radius));
      p.hp = Math.max(0, p.hp - dmg);
      if (p.hp <= 0) {
        this.triggerLocalDeath(attackerId, 'EXPLOSIVE');
      }
    }
  }

  spawnImpactSparks(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color || '#FFD600',
        alpha: 1.0,
        radius: 2 + Math.random() * 2
      });
    }
  }

  fireWeapon() {
    const p = this.localPlayer;
    const wep = this.currentWeapon;

    if (wep === 'uzi') {
      const bullet = {
        x: Math.round(p.x + Math.cos(p.aimAngle) * 26),
        y: Math.round(p.y + Math.sin(p.aimAngle) * 26),
        vx: Math.round(Math.cos(p.aimAngle) * 18 * 10) / 10,
        vy: Math.round(Math.sin(p.aimAngle) * 18 * 10) / 10,
        weapon: 'uzi',
        ownerId: this.myPlayerId,
        color: '#00E5FF'
      };
      this.bullets.push(bullet);
      this.send('BULLET_FIRE', bullet);
    } else if (wep === 'shotgun') {
      const burst = [];
      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.35;
        const angle = p.aimAngle + spread;
        const speed = 15 + Math.random() * 3;
        const pellet = {
          x: Math.round(p.x + Math.cos(angle) * 26),
          y: Math.round(p.y + Math.sin(angle) * 26),
          vx: Math.round(Math.cos(angle) * speed * 10) / 10,
          vy: Math.round(Math.sin(angle) * speed * 10) / 10
        };
        this.bullets.push({ ...pellet, weapon: 'shotgun', ownerId: this.myPlayerId, color: '#FF7B00', life: 0 });
        burst.push(pellet);
      }
      this.send('BULLET_BURST', { bullets: burst });
    } else if (wep === 'sniper') {
      const bullet = {
        x: Math.round(p.x + Math.cos(p.aimAngle) * 32),
        y: Math.round(p.y + Math.sin(p.aimAngle) * 32),
        vx: Math.round(Math.cos(p.aimAngle) * 28 * 10) / 10,
        vy: Math.round(Math.sin(p.aimAngle) * 28 * 10) / 10,
        weapon: 'sniper',
        ownerId: this.myPlayerId,
        color: '#00FF66'
      };
      this.bullets.push(bullet);
      this.send('BULLET_FIRE', bullet);
    } else if (wep === 'rpg') {
      const rocket = {
        x: Math.round(p.x + Math.cos(p.aimAngle) * 30),
        y: Math.round(p.y + Math.sin(p.aimAngle) * 30),
        vx: Math.round(Math.cos(p.aimAngle) * 12 * 10) / 10,
        vy: Math.round(Math.sin(p.aimAngle) * 12 * 10) / 10,
        weapon: 'rpg',
        ownerId: this.myPlayerId,
        color: '#FF3366'
      };
      this.bullets.push(rocket);
      this.send('BULLET_FIRE', rocket);
    }
  }

  spawnJetpackParticle(x, y, aimAngle) {
    const facingLeft = Math.cos(aimAngle) < 0;
    const nozzleOffset = facingLeft ? 14 : -14;

    this.particles.push({
      x: x + nozzleOffset + (Math.random() - 0.5) * 4,
      y: y + 16,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 3 + Math.random() * 3,
      color: Math.random() > 0.5 ? '#00E5FF' : '#FF7B00',
      alpha: 1.0,
      radius: 4 + Math.random() * 4
    });
  }

  // ──────────────── RENDERING ────────────────
  renderCanvas() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const camX = this.camera.x;
    const camY = this.camera.y;

    // 1. Stable Photorealistic Mountain Backdrop with Smooth Parallax
    if (this.assets.loaded && this.assets.bg.complete) {
      const bg = this.assets.bg;

      const scale = Math.max(W / bg.width, H / bg.height) * 1.08;
      const scaledW = bg.width * scale;
      const scaledH = bg.height * scale;

      const maxCamX = Math.max(1, this.worldWidth - W);
      const bgTravelX = Math.max(0, scaledW - W);
      const bgX = -(Math.max(0, camX - W / 2) / maxCamX) * (bgTravelX * 0.25);
      const bgY = (H - scaledH) / 2;

      ctx.drawImage(bg, bgX, bgY, scaledW, scaledH);

      const mistGrad = ctx.createLinearGradient(0, H * 0.55, 0, H);
      mistGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      mistGrad.addColorStop(0.7, 'rgba(180, 205, 215, 0.12)');
      mistGrad.addColorStop(1, 'rgba(30, 45, 35, 0.35)');
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#1A2E20';
      ctx.fillRect(0, 0, W, H);
    }

    // ──────────────── WORLD SPACE (DYNAMIC 1x-4x ZOOM) ────────────────
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.currentZoom, this.currentZoom);
    ctx.translate(-camX, -camY);

    // 2. Render Wooden Outpost Bunker Back-Wall & Interior First (Behind players)
    this.drawWoodenOutpostBack(ctx, 1580, 840, 440, 240);

    // 3. Render Rock Platforms & Ground Terrain
    for (const plat of this.platforms) {
      if (plat.type === 'GROUND') {
        this.drawGroundTerrain(ctx, plat);
      } else if (plat.type === 'ROCK') {
        this.drawRockPlatform(ctx, plat);
      }
    }

    // 4. Render Wooden Outpost Front Log Structure & Roof (3D Interlocking Timber Logs)
    this.drawWoodenOutpostFront(ctx, 1580, 840, 440, 240);

    // 5. Tactical Pickups
    for (const pk of this.tacticalPickups) {
      if (pk.available) this.drawTacticalPickup(ctx, pk);
    }

    // 6. Dropped Guns
    for (const gun of this.groundGuns) {
      if (gun.available) this.drawGroundGun(ctx, gun);
    }

    // 5. Yellow Toxic Gas Clouds
    for (const s of this.toxicClouds) {
      ctx.save();
      const alpha = Math.min(0.7, s.life / 180);
      const grad = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, s.radius);
      grad.addColorStop(0, `rgba(255, 230, 0, ${alpha * 0.9})`);
      grad.addColorStop(0.6, `rgba(200, 220, 0, ${alpha * 0.6})`);
      grad.addColorStop(1, `rgba(100, 180, 0, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // Biohazard Icon in Toxic Core
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
      ctx.textAlign = 'center';
      ctx.fillText('☣️', s.x, s.y + 6);
      ctx.restore();
    }

    // 6. Sticky Landmines
    for (const m of this.landmines) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = m.armed ? '#FF3366' : '#FFD600';
      ctx.shadowBlur = 12;
      ctx.shadowColor = m.armed ? '#FF3366' : '#FFD600';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pulsing LED Core
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Frag Grenades
    for (const g of this.grenades) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = '#00E676';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00E676';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Bullets & Rockets
    for (const b of this.bullets) {
      ctx.save();
      if (b.weapon === 'rpg') {
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(-12, -4, 20, 8);
        ctx.fillStyle = '#FF3366';
        ctx.beginPath();
        ctx.moveTo(8, -4); ctx.lineTo(14, 0); ctx.lineTo(8, 4);
        ctx.fill();
      } else {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.weapon === 'sniper' ? 4 : 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 10. Remote Soldiers
    this.remotePlayers.forEach(rp => {
      if (!rp.isDead && rp.hp > 0) {
        this.drawArticulatedSoldier(ctx, rp, false, rp.walkCycle || 0, 0);
      }
    });

    // 11. Local Soldier
    if (!this.localPlayer.isDead && this.localPlayer.hp > 0) {
      this.drawArticulatedSoldier(ctx, this.localPlayer, true, this.walkCycle, this.recoilOffset);
    } else if (this.localPlayer.isDead) {
      ctx.save();
      ctx.font = 'bold 16px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#FF3366';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FF3366';
      ctx.textAlign = 'center';
      ctx.fillText(`💀 ELIMINATED • RESPAWNING IN ${Math.max(1, this.respawnTimer)}s...`, this.localPlayer.x, this.localPlayer.y - 20);
      ctx.restore();
    }

    // 12. Floating Notifications
    for (const notif of this.pickupNotifications) {
      ctx.save();
      ctx.globalAlpha = notif.alpha;
      ctx.font = 'bold 12px "Chakra Petch", sans-serif';
      ctx.fillStyle = notif.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = notif.color;
      ctx.textAlign = 'center';
      ctx.fillText(notif.text, notif.x, notif.y);
      ctx.restore();
    }

    ctx.restore(); // END WORLD SPACE

    // ──────────────── SCREEN SPACE: TACTICAL GAME CROSSHAIR ────────────────
    this.drawTacticalCrosshair(ctx, this.mouse.x, this.mouse.y);
  }

  // ──────────────── AUTHENTIC MINI MILITIA STYLIZED RENDERING ────────────────

  // 1. Stylized Jungle & Alpine Battlefield Backdrop
  drawStylizedBackdrop(ctx, W, H, camX, camY) {
    // A. Soft Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#7EC8E3');
    skyGrad.addColorStop(0.45, '#BEE3ED');
    skyGrad.addColorStop(0.85, '#E8F5E9');
    skyGrad.addColorStop(1, '#C8E6C9');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // B. Distant Parallax Mountain Layer 1 (Far hills)
    ctx.save();
    const farOffsetX = -(camX * 0.06) % 900;
    ctx.fillStyle = '#81C784';
    ctx.beginPath();
    ctx.moveTo(-100, H);
    for (let x = -100; x <= W + 200; x += 180) {
      const peakY = H * 0.38 + Math.sin((x - farOffsetX) * 0.005) * 55 + Math.cos((x - farOffsetX) * 0.012) * 35;
      ctx.quadraticCurveTo(x + 90, peakY, x + 180, H * 0.42 + Math.sin((x + 180 - farOffsetX) * 0.006) * 45);
    }
    ctx.lineTo(W + 200, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // C. Midground Parallax Jungle Hills (Rounded Canopies & Treeline)
    ctx.save();
    const midOffsetX = -(camX * 0.14) % 800;
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(-100, H);
    for (let x = -100; x <= W + 200; x += 140) {
      const canopyY = H * 0.52 + Math.sin((x - midOffsetX) * 0.008) * 45 + Math.cos((x - midOffsetX) * 0.018) * 25;
      // Draw rounded jungle tree canopy bumps
      ctx.quadraticCurveTo(x + 70, canopyY - 30, x + 140, canopyY);
    }
    ctx.lineTo(W + 200, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // D. Foreground Lush Jungle Tree Canopy Foliage (Near Treeline)
    ctx.save();
    const nearOffsetX = -(camX * 0.22) % 600;
    ctx.fillStyle = '#2E7D32';
    ctx.beginPath();
    ctx.moveTo(-100, H);
    for (let x = -100; x <= W + 200; x += 110) {
      const nearY = H * 0.65 + Math.sin((x - nearOffsetX) * 0.01) * 35;
      ctx.quadraticCurveTo(x + 55, nearY - 25, x + 110, nearY);
    }
    ctx.lineTo(W + 200, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. Wooden Outpost Bunker: Back Wall & Interior (Rendered Behind Players)
  drawWoodenOutpostBack(ctx, x, y, w, h) {
    ctx.save();

    // A. Vertical Weathered Wooden Planks
    const plankWidth = 28;
    const plankColors = ['#5D4037', '#6D4C41', '#54382F', '#4E342E', '#63453A'];
    let colorIdx = 0;

    for (let px = x + 34; px < x + w - 34; px += plankWidth) {
      const curW = Math.min(plankWidth, (x + w - 34) - px);
      ctx.fillStyle = plankColors[colorIdx % plankColors.length];
      ctx.fillRect(px, y + 42, curW, h - 42);

      // Plank Shadow / Separation Groove
      ctx.strokeStyle = '#26170E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, y + 42);
      ctx.lineTo(px, y + h);
      ctx.stroke();

      // Subtle Wood Grain Texture Lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + curW * 0.3, y + 48);
      ctx.bezierCurveTo(px + curW * 0.7, y + 90, px + curW * 0.2, y + 140, px + curW * 0.5, y + h - 10);
      ctx.stroke();

      // Iron Nails / Rivets
      ctx.fillStyle = '#1A110B';
      ctx.beginPath();
      ctx.arc(px + curW / 2, y + 54, 2, 0, Math.PI * 2);
      ctx.arc(px + curW / 2, y + h - 16, 2, 0, Math.PI * 2);
      ctx.fill();

      colorIdx++;
    }

    // B. 3 Iconic Bunker Window Openings (Sky view through windows)
    const windows = [
      { x: x + 72, y: y + 86, w: 68, h: 54 },
      { x: x + 186, y: y + 86, w: 68, h: 54 },
      { x: x + 300, y: y + 86, w: 68, h: 54 }
    ];

    for (const win of windows) {
      // Clear opening so background mountain vista shows through windows
      ctx.clearRect(win.x, win.y, win.w, win.h);

      // Window Interior Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(win.x, win.y, win.w, 8);
      ctx.fillRect(win.x, win.y, 8, win.h);

      // Vertical Iron Security Bars
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(win.x + win.w * 0.35, win.y);
      ctx.lineTo(win.x + win.w * 0.35, win.y + win.h);
      ctx.moveTo(win.x + win.w * 0.65, win.y);
      ctx.lineTo(win.x + win.w * 0.65, win.y + win.h);
      ctx.stroke();

      // Metallic Bar Highlight
      ctx.strokeStyle = '#78909C';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(win.x + win.w * 0.35 - 1, win.y);
      ctx.lineTo(win.x + win.w * 0.35 - 1, win.y + win.h);
      ctx.moveTo(win.x + win.w * 0.65 - 1, win.y);
      ctx.lineTo(win.x + win.w * 0.65 - 1, win.y + win.h);
      ctx.stroke();

      // Heavy Wooden Window Frame Outline
      ctx.strokeStyle = '#2A180E';
      ctx.lineWidth = 4;
      ctx.strokeRect(win.x, win.y, win.w, win.h);
    }

    // C. Horizontal Wooden Cross-Beam Support
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(x + 34, y + 154, w - 68, 24);
    ctx.strokeStyle = '#21130B';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 34, y + 154, w - 68, 24);

    // Cross-Beam Bolts
    for (let bx = x + 50; bx < x + w - 50; bx += 40) {
      ctx.fillStyle = '#78909C';
      ctx.beginPath();
      ctx.arc(bx, y + 166, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1E272C';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // D. Hanging Ceiling Lantern & Warm Golden Bunker Glow
    const lanternX = x + w / 2;
    const lanternY = y + 50;

    // Golden Radial Ambient Light
    const lanternLight = ctx.createRadialGradient(lanternX, lanternY + 20, 10, lanternX, lanternY + 60, 160);
    lanternLight.addColorStop(0, 'rgba(255, 214, 0, 0.35)');
    lanternLight.addColorStop(0.5, 'rgba(255, 171, 0, 0.15)');
    lanternLight.addColorStop(1, 'rgba(255, 171, 0, 0)');
    ctx.fillStyle = lanternLight;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY + 60, 160, 0, Math.PI * 2);
    ctx.fill();

    // Lantern Chain & Cage
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lanternX, y + 42);
    ctx.lineTo(lanternX, lanternY);
    ctx.stroke();

    // Lantern Body
    ctx.fillStyle = '#FFD54F';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD54F';
    ctx.fillRect(lanternX - 6, lanternY, 12, 16);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    ctx.strokeRect(lanternX - 6, lanternY, 12, 16);

    // E. Heavy Wooden Weapon Supply Pedestal Table (Where Rocket Launcher Rests)
    const pedX = x + w / 2 - 75;
    const pedY = y + h - 45;
    const pedW = 150;
    const pedH = 45;

    // Pedestal Body (Wooden Crate Chest)
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(pedX, pedY, pedW, pedH);

    // Diagonal Cross Braces
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pedX + 6, pedY + 6);
    ctx.lineTo(pedX + pedW - 6, pedY + pedH - 6);
    ctx.moveTo(pedX + pedW - 6, pedY + 6);
    ctx.lineTo(pedX + 6, pedY + pedH - 6);
    ctx.stroke();

    // Metal Corner Brackets & Rivets
    ctx.fillStyle = '#37474F';
    ctx.fillRect(pedX, pedY, 14, 14);
    ctx.fillRect(pedX + pedW - 14, pedY, 14, 14);
    ctx.fillRect(pedX, pedY + pedH - 14, 14, 14);
    ctx.fillRect(pedX + pedW - 14, pedY + pedH - 14, 14, 14);

    ctx.strokeStyle = '#1F130B';
    ctx.lineWidth = 3;
    ctx.strokeRect(pedX, pedY, pedW, pedH);

    // Golden Halo Ring on Pedestal Table
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#FFD600';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, pedY + 4, 45, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Outpost Banner Label
    ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#FFD600';
    ctx.textAlign = 'center';
    ctx.fillText('★ OUTPOST BUNKER VAULT ★', x + w / 2, y + 74);

    ctx.restore();
  }

  // 3. Wooden Outpost Bunker: Front 3D Interlocking Timber Logs & Roof
  drawWoodenOutpostFront(ctx, x, y, w, h) {
    ctx.save();

    // ──────────────── A. TOP ROOF: 3D STACKED TIMBER LOGS ────────────────
    const numRoofLogs = 3;
    const logHeight = 14;

    for (let i = 0; i < numRoofLogs; i++) {
      const logY = y + i * logHeight;
      const logStartX = x - 14;
      const logEndX = x + w + 14;
      const logW = logEndX - logStartX;

      // 3D Cylindrical Log Gradient
      const logGrad = ctx.createLinearGradient(0, logY, 0, logY + logHeight);
      logGrad.addColorStop(0, '#BCAAA4');
      logGrad.addColorStop(0.25, '#8D6E63');
      logGrad.addColorStop(0.7, '#5D4037');
      logGrad.addColorStop(1, '#3E2723');

      ctx.fillStyle = logGrad;
      ctx.fillRect(logStartX, logY, logW, logHeight);

      // Bark Texture Lines & Knot Swirls
      ctx.strokeStyle = 'rgba(30, 15, 8, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(logStartX + 20, logY + 4);
      ctx.lineTo(logStartX + logW * 0.45, logY + 4);
      ctx.moveTo(logStartX + logW * 0.55, logY + 9);
      ctx.lineTo(logStartX + logW - 20, logY + 9);
      ctx.stroke();

      // Circular Cut Log Ends (Left End)
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.ellipse(logStartX, logY + logHeight / 2, 8, logHeight / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Tree Ring
      ctx.beginPath();
      ctx.ellipse(logStartX, logY + logHeight / 2, 4, (logHeight / 2) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Circular Cut Log Ends (Right End)
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.ellipse(logEndX, logY + logHeight / 2, 8, logHeight / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Tree Ring
      ctx.beginPath();
      ctx.ellipse(logEndX, logY + logHeight / 2, 4, (logHeight / 2) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Black Cartoon Contour Outline
      ctx.strokeStyle = '#1F130B';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(logStartX, logY, logW, logHeight);
    }

    // Green Moss / Comic Grass on Top of the Roof Logs
    ctx.fillStyle = '#7CB342';
    for (let gx = x - 10; gx <= x + w + 10; gx += 14) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + 4, y - 6);
      ctx.lineTo(gx + 8, y);
      ctx.fill();
      ctx.strokeStyle = '#1F130B';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ──────────────── B. SUPPORT COLUMNS (STACKED VERTICAL LOGS) ────────────────
    const colWidth = 38;
    const colHeight = 84; // Leaves lower opening for walking inside!

    // Left Column
    this.drawVerticalLogPillar(ctx, x, y + 42, colWidth, colHeight, true);

    // Right Column
    this.drawVerticalLogPillar(ctx, x + w - colWidth, y + 42, colWidth, colHeight, false);

    // Diagonal 45° Timber Braces Under Roof
    this.drawDiagonalTimberStrut(ctx, x + colWidth, y + 42, 40, 40, true);
    this.drawDiagonalTimberStrut(ctx, x + w - colWidth - 40, y + 42, 40, 40, false);

    ctx.restore();
  }

  // Helper: Draw Vertical Stacked Log Pillar
  drawVerticalLogPillar(ctx, px, py, pw, ph, isLeft) {
    ctx.save();

    // Vertical Log Cylinder Gradient
    const colGrad = ctx.createLinearGradient(px, 0, px + pw, 0);
    colGrad.addColorStop(0, '#BCAAA4');
    colGrad.addColorStop(0.3, '#8D6E63');
    colGrad.addColorStop(0.8, '#5D4037');
    colGrad.addColorStop(1, '#3E2723');

    ctx.fillStyle = colGrad;
    ctx.fillRect(px, py, pw, ph);

    // Bark Texture
    ctx.strokeStyle = 'rgba(25, 12, 6, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.35, py + 8);
    ctx.lineTo(px + pw * 0.35, py + ph - 8);
    ctx.moveTo(px + pw * 0.7, py + 16);
    ctx.lineTo(px + pw * 0.7, py + ph - 16);
    ctx.stroke();

    // Circular Cut Log Notches along the Pillar
    for (let ny = py + 16; ny <= py + ph - 16; ny += 28) {
      const notchX = isLeft ? px - 4 : px + pw + 4;
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.arc(notchX, ny, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5D4037';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(notchX, ny, 3.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#1F130B';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Steel Reinforcement Corner Band
    ctx.fillStyle = '#37474F';
    ctx.fillRect(px - 2, py + ph - 14, pw + 4, 10);
    ctx.fillStyle = '#CFD8DC';
    ctx.beginPath();
    ctx.arc(px + 8, py + ph - 9, 2.5, 0, Math.PI * 2);
    ctx.arc(px + pw - 8, py + ph - 9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Black Cartoon Outline
    ctx.strokeStyle = '#1F130B';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);

    ctx.restore();
  }

  // Helper: Draw Diagonal Timber Strut Brace
  drawDiagonalTimberStrut(ctx, sx, sy, sw, sh, isLeft) {
    ctx.save();
    ctx.fillStyle = '#6D4C41';
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + sw, sy);
      ctx.lineTo(sx, sy + sh);
    } else {
      ctx.moveTo(sx + sw, sy);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx + sw, sy + sh);
    }
    ctx.closePath();
    ctx.fill();

    // Iron Carriage Bolt
    ctx.fillStyle = '#90A4AE';
    ctx.beginPath();
    ctx.arc(isLeft ? sx + 12 : sx + sw - 12, sy + 12, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1F130B';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Natural Rock Platform (Authentic Hand-Drawn Earthy Stones & Cartoon Grass)
  drawRockPlatform(ctx, plat) {
    ctx.save();

    // A. Drop Shadow Beneath Platform
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.roundRect(plat.x + 4, plat.y + plat.h, plat.w - 8, 14, 6);
    ctx.fill();

    // B. Earthy Rock Stone Polygon Body
    const rockGrad = ctx.createLinearGradient(0, plat.y, 0, plat.y + plat.h);
    rockGrad.addColorStop(0, '#948472');
    rockGrad.addColorStop(0.4, '#7D6E5D');
    rockGrad.addColorStop(1, '#5E5042');

    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 6);
    ctx.fill();

    // C. Stone Fissure & Crack Lines
    ctx.strokeStyle = '#3E342B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(plat.x + plat.w * 0.25, plat.y + 10);
    ctx.lineTo(plat.x + plat.w * 0.28, plat.y + 22);
    ctx.lineTo(plat.x + plat.w * 0.35, plat.y + 28);
    ctx.moveTo(plat.x + plat.w * 0.68, plat.y + 8);
    ctx.lineTo(plat.x + plat.w * 0.72, plat.y + 24);
    ctx.stroke();

    // D. Embedded Rounded River Stones / Pebbles (Along Bottom & Sides)
    const pebbleOffsets = [
      { x: 12, y: plat.h - 4, r: 8 },
      { x: 34, y: plat.h - 2, r: 6 },
      { x: 62, y: plat.h - 5, r: 9 },
      { x: plat.w * 0.45, y: plat.h - 3, r: 7 },
      { x: plat.w * 0.60, y: plat.h - 5, r: 9 },
      { x: plat.w * 0.78, y: plat.h - 3, r: 7 },
      { x: plat.w - 38, y: plat.h - 4, r: 8 },
      { x: plat.w - 14, y: plat.h - 2, r: 6 }
    ];

    for (const p of pebbleOffsets) {
      if (p.x < plat.w) {
        ctx.fillStyle = '#B5A593';
        ctx.beginPath();
        ctx.arc(plat.x + p.x, plat.y + p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        // Shaded Rim
        ctx.fillStyle = '#6E5F50';
        ctx.beginPath();
        ctx.arc(plat.x + p.x + 1.5, plat.y + p.y + 1.5, p.r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#2A2219';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(plat.x + p.x, plat.y + p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // E. Heavy Black Cartoon Contour Outline
    ctx.strokeStyle = '#2A2219';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(plat.x, plat.y, plat.w, plat.h, 6);
    ctx.stroke();

    // F. Thick Vibrant Multi-Layered Cartoon Grass on Top
    // Layer 1: Dark Green Under-Shadow Grass
    ctx.fillStyle = '#33691E';
    for (let gx = plat.x; gx <= plat.x + plat.w - 6; gx += 10) {
      ctx.beginPath();
      ctx.moveTo(gx, plat.y + 2);
      ctx.lineTo(gx + 4, plat.y - 8);
      ctx.lineTo(gx + 8, plat.y + 2);
      ctx.fill();
    }

    // Layer 2: Bright Vibrant Lime Grass Blades with Black Outline
    ctx.fillStyle = '#7CB342';
    for (let gx = plat.x; gx <= plat.x + plat.w - 8; gx += 12) {
      ctx.beginPath();
      ctx.moveTo(gx, plat.y);
      ctx.lineTo(gx + 5, plat.y - 10);
      ctx.lineTo(gx + 10, plat.y);
      ctx.fill();

      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore();
  }

  // 5. Natural Ground Terrain (Deep Subterranean Earth & Continuous Top Grass)
  drawGroundTerrain(ctx, plat) {
    ctx.save();

    // A. Subterranean Soil Strata Layers
    // Layer 1: Deep Bedrock
    ctx.fillStyle = '#211007';
    ctx.fillRect(plat.x, plat.y + 45, plat.w, plat.h - 45);

    // Layer 2: Rich Mid Soil
    ctx.fillStyle = '#321C0E';
    ctx.fillRect(plat.x, plat.y + 18, plat.w, 28);

    // Layer 3: Top Organic Humus Layer
    ctx.fillStyle = '#4A2E19';
    ctx.fillRect(plat.x, plat.y, plat.w, 18);

    // B. Embedded Rock Strata & Mineral Pebbles in Soil
    ctx.fillStyle = '#7D6E5D';
    for (let sx = 0; sx < plat.w; sx += 85) {
      ctx.beginPath();
      ctx.arc(plat.x + sx + 25, plat.y + 35, 7, 0, Math.PI * 2);
      ctx.arc(plat.x + sx + 65, plat.y + 65, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#211007';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // C. Continuous Stylized Cartoon Grass Along Ground Ridge
    // Dark base grass
    ctx.fillStyle = '#33691E';
    for (let gx = 0; gx < plat.w; gx += 8) {
      ctx.beginPath();
      ctx.moveTo(plat.x + gx, plat.y);
      ctx.lineTo(plat.x + gx + 3, plat.y - 7);
      ctx.lineTo(plat.x + gx + 7, plat.y);
      ctx.fill();
    }

    // Bright primary grass blades
    ctx.fillStyle = '#689F38';
    for (let gx = 0; gx < plat.w; gx += 11) {
      ctx.beginPath();
      ctx.moveTo(plat.x + gx, plat.y);
      ctx.lineTo(plat.x + gx + 4, plat.y - 11);
      ctx.lineTo(plat.x + gx + 9, plat.y);
      ctx.fill();

      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ──────────────── TACTICAL CROSSHAIR DRAWING ────────────────
  drawTacticalCrosshair(ctx, mx, my) {
    if (mx <= 0 && my <= 0) return;

    ctx.save();
    ctx.translate(mx, my);

    // Outer Circle Ring
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00E5FF';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Precision Cross Lines
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Top
    ctx.moveTo(0, -18); ctx.lineTo(0, -8);
    // Bottom
    ctx.moveTo(0, 8); ctx.lineTo(0, 18);
    // Left
    ctx.moveTo(-18, 0); ctx.lineTo(-8, 0);
    // Right
    ctx.moveTo(8, 0); ctx.lineTo(18, 0);
    ctx.stroke();

    // Center Red Target Dot
    ctx.fillStyle = '#FF3366';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FF3366';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawGroundGun(ctx, gun) {
    ctx.save();
    ctx.translate(gun.x, gun.y);

    const time = performance.now() * 0.003;
    const bob = Math.sin(time * 2) * 5;
    const isNearby = this.nearbyGun === gun;
    const glowColor = gun.rarity === 'LEGENDARY' ? '#FFD600' : gun.rarity === 'RARE' ? '#00FF66' : gun.rarity === 'UNCOMMON' ? '#FF7B00' : '#00E5FF';

    ctx.save();
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(0, 36, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 214, 0, 0.12)';
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = isNearby ? 3 : 1.5;
    ctx.shadowBlur = isNearby ? 16 : 8;
    ctx.shadowColor = glowColor;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(0, bob);
    ctx.shadowBlur = 14;
    ctx.shadowColor = glowColor;

    if (gun.type === 'shotgun') {
      ctx.fillStyle = '#222834';
      ctx.fillRect(-20, -5, 40, 9);
      ctx.fillStyle = '#111';
      ctx.fillRect(20, -3, 10, 5);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(-6, 2, 14, 4);
    } else if (gun.type === 'sniper') {
      ctx.fillStyle = '#1C2330';
      ctx.fillRect(-24, -5, 36, 7);
      ctx.fillStyle = '#000';
      ctx.fillRect(12, -3, 24, 4);
      ctx.fillStyle = '#00FF66';
      ctx.fillRect(6, -10, 4, 4);
    } else if (gun.type === 'rpg') {
      ctx.fillStyle = '#3E4D38';
      ctx.fillRect(-22, -7, 38, 12);
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.moveTo(16, -7); ctx.lineTo(26, -1); ctx.lineTo(16, 5);
      ctx.fill();
    } else {
      ctx.fillStyle = '#1B1F28';
      ctx.fillRect(-12, -5, 24, 9);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-10, -4, 16, 2);
    }
    ctx.restore();

    // [E] Equip Prompt in World Space
    if (isNearby) {
      ctx.save();
      ctx.translate(0, -34 + bob);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#FFD600';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFD600';
      ctx.beginPath();
      ctx.roundRect(-58, -12, 116, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#FFD600';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] EQUIP ${gun.name.split(' ')[0]}`, 0, 4);
      ctx.restore();
    } else {
      ctx.font = 'bold 9px "Chakra Petch", sans-serif';
      ctx.fillStyle = glowColor;
      ctx.textAlign = 'center';
      ctx.fillText(gun.name, 0, -22 + bob);
    }

    ctx.restore();
  }

  drawTacticalPickup(ctx, pk) {
    ctx.save();
    ctx.translate(pk.x, pk.y);

    const time = performance.now() * 0.003;
    const bob = Math.sin(time * 2) * 4;
    const glowColor = pk.type === 'MEDKIT' ? '#00E676' : pk.type === 'TOXIC_GAS' ? '#FFE500' : '#FFD600';

    ctx.save();
    ctx.translate(0, bob);
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;

    if (pk.type === 'GRENADE') {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#2E5934';
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (pk.type === 'MINE') {
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fillStyle = '#2A2D34';
      ctx.fill();
      ctx.strokeStyle = '#FF3366';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (pk.type === 'TOXIC_GAS') {
      ctx.fillStyle = '#4A5520';
      ctx.fillRect(-7, -12, 14, 22);
      ctx.fillStyle = '#FFE500';
      ctx.fillRect(-7, -3, 14, 5);
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#000';
      ctx.fillText('☣️', -4, -4);
    } else if (pk.type === 'MEDKIT') {
      ctx.fillStyle = '#1F2430';
      ctx.fillRect(-13, -11, 26, 20);
      ctx.strokeStyle = '#FFF';
      ctx.strokeRect(-13, -11, 26, 20);
      ctx.fillStyle = '#00E676';
      ctx.fillRect(-2, -7, 4, 12);
      ctx.fillRect(-6, -3, 12, 4);
    }
    ctx.restore();

    ctx.font = 'bold 9px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText(pk.label, 0, -20 + bob);

    ctx.restore();
  }

  drawArticulatedSoldier(ctx, p, isLocal, walkCycle, recoil) {
    ctx.save();
    ctx.translate(p.x, p.y);

    const facingLeft = Math.cos(p.aimAngle) < 0;
    const teamColor = p.team === 'BLUE' ? '#00A2FF' : '#FF3366';
    const visorColor = p.team === 'BLUE' ? '#00E5FF' : '#FFD600';
    const equippedWep = isLocal ? this.currentWeapon : (p.weapon || 'uzi');

    if (isLocal) {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(p.aimAngle) * 350, Math.sin(p.aimAngle) * 350);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();
    if (facingLeft) ctx.scale(-1, 1);

    let localAim = p.aimAngle;
    if (facingLeft) localAim = Math.PI - p.aimAngle;

    // 1. JETPACK
    ctx.fillStyle = '#222B38';
    ctx.strokeStyle = '#4A5B70';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-20, -12, 10, 24);
    ctx.strokeRect(-20, -12, 10, 24);
    ctx.fillStyle = '#111';
    ctx.fillRect(-22, 12, 6, 6);
    ctx.fillRect(-15, 12, 6, 6);

    // 2. LEGS
    const legAngle1 = p.isFlying ? 0.35 : Math.sin(walkCycle) * 0.45;
    const legAngle2 = p.isFlying ? 0.55 : -Math.sin(walkCycle) * 0.45;

    ctx.save();
    ctx.translate(-4, 12);
    ctx.rotate(legAngle2);
    ctx.fillStyle = '#1E2530';
    ctx.fillRect(-3, 0, 6, 14);
    ctx.fillStyle = '#111822';
    ctx.fillRect(-4, 12, 9, 6);
    ctx.restore();

    // 3. TORSO
    ctx.fillStyle = '#2A3444';
    ctx.fillRect(-10, -10, 20, 22);
    ctx.fillStyle = teamColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = teamColor;
    ctx.fillRect(-8, -8, 16, 14);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -8, 16, 14);
    ctx.fillStyle = '#111';
    ctx.fillRect(-10, 8, 20, 4);

    ctx.save();
    ctx.translate(4, 12);
    ctx.rotate(legAngle1);
    ctx.fillStyle = '#2E3847';
    ctx.fillRect(-3, 0, 6, 14);
    ctx.fillStyle = '#111822';
    ctx.fillRect(-4, 12, 9, 6);
    ctx.restore();

    // 4. HELMET
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate(localAim * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#1E2530';
    ctx.fill();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = visorColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = visorColor;
    ctx.beginPath();
    ctx.roundRect(2, -4, 8, 6, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 5. SHOULDER & WEAPON
    ctx.save();
    ctx.translate(0, -2);
    ctx.rotate(localAim);
    ctx.translate(-recoil, 0);

    ctx.fillStyle = '#2A3444';
    ctx.fillRect(0, -3, 12, 6);

    this.drawWeaponModel(ctx, equippedWep, teamColor);

    ctx.fillStyle = '#1E2530';
    ctx.fillRect(8, -2, 8, 5);

    ctx.restore();
    ctx.restore();

    // Overhead HUD
    ctx.shadowBlur = 0;
    ctx.font = 'bold 11px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.fillText(isLocal ? 'YOU' : p.id, 0, -36);

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(-18, -30, 36, 5);
    ctx.fillStyle = teamColor;
    ctx.fillRect(-18, -30, (p.hp / 100) * 36, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-18, -30, 36, 5);

    ctx.restore();
  }

  drawWeaponModel(ctx, wep, teamColor) {
    ctx.save();
    if (wep === 'uzi') {
      ctx.fillStyle = '#1B1F28';
      ctx.fillRect(10, -5, 18, 9);
      ctx.fillStyle = '#0E1116';
      ctx.fillRect(28, -3, 8, 4);
      ctx.fillRect(14, 4, 5, 8);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(12, -4, 12, 2);
    } else if (wep === 'shotgun') {
      ctx.fillStyle = '#232936';
      ctx.fillRect(8, -6, 26, 10);
      ctx.fillStyle = '#111';
      ctx.fillRect(34, -4, 10, 6);
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(16, 2, 10, 4);
      ctx.fillStyle = '#FF7B00';
      ctx.fillRect(10, -5, 14, 2);
    } else if (wep === 'sniper') {
      ctx.fillStyle = '#1A212D';
      ctx.fillRect(6, -5, 24, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(30, -3, 22, 4);
      ctx.fillRect(48, -4, 4, 6);
      ctx.fillStyle = '#111';
      ctx.fillRect(12, -10, 14, 5);
      ctx.fillStyle = '#00FF66';
      ctx.fillRect(24, -9, 3, 3);
    } else if (wep === 'rpg') {
      ctx.fillStyle = '#3B4834';
      ctx.fillRect(4, -8, 30, 14);
      ctx.fillStyle = '#1A2118';
      ctx.fillRect(34, -7, 6, 12);
      ctx.fillStyle = '#FF3366';
      ctx.beginPath();
      ctx.moveTo(40, -8); ctx.lineTo(50, -1); ctx.lineTo(40, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  updateHUD() {
    const p = this.localPlayer;
    this.hudHpFill.style.width = `${Math.max(0, p.hp)}%`;
    this.hudHpVal.textContent = Math.round(p.hp);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MultiplayerGameApp();
});
