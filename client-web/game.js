// 🎮 Mini Militia 2D — Seamless Natural Alpine Warzone & Articulated Combat Engine

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
    this.walkCycle = 0;
    this.recoilOffset = 0;
    this.nearbyGun = null;
    this.pickupNotifications = [];

    this.initDOM();
    this.loadAssets();
    this.initWebSocket();
    this.setupEventListeners();
    this.initGameCanvas();
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

    this.equipPromptBox = document.getElementById('equip-prompt-box');
    this.equipPromptText = document.getElementById('equip-prompt-text');
    this.btnEquipPrompt = document.getElementById('btn-equip-prompt');

    this.tacGrenadeCountEl = document.getElementById('tac-grenade-count');
    this.tacMineCountEl = document.getElementById('tac-mine-count');
    this.tacSmokeCountEl = document.getElementById('tac-smoke-count');
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
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Failed to parse server msg', e);
        }
      };

      this.ws.onclose = () => {
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

      case 'GRENADE_THROW':
        this.handleRemoteGrenade(payload);
        break;

      case 'MINE_PLANT':
        this.handleRemoteMine(payload);
        break;

      case 'SMOKE_SPAWN':
        this.handleRemoteSmoke(payload);
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

    this.btnEquipPrompt.addEventListener('click', () => {
      this.equipNearbyGun();
    });

    document.getElementById('btn-throw-grenade').addEventListener('click', () => this.triggerGrenadeThrow());
    document.getElementById('btn-plant-mine').addEventListener('click', () => this.triggerMinePlant());
    document.getElementById('btn-throw-smoke').addEventListener('click', () => this.triggerSmokeDeploy());
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
      team: 'RED',
      color: '#FF3366',
      isFlying: false,
      isGrounded: false,
      weapon: 'uzi',
      inventory: {
        grenades: 2,
        mines: 1,
        smoke: 1
      }
    };

    this.remotePlayers = new Map();
    this.bullets = [];
    this.grenades = [];
    this.landmines = [];
    this.smokeClouds = [];
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

    // 1. Natural Grassy Ground Bedrock
    this.platforms = [
      { x: 0, y: gy, w: this.worldWidth, h: 120, type: 'GROUND' },

      // 2. Natural Stony Rock Cliffs & Organic Ledges
      { x: 280, y: 880, w: 280, h: 32, type: 'ROCK' },
      { x: 440, y: 660, w: 240, h: 30, type: 'ROCK' },
      { x: 860, y: 780, w: 320, h: 34, type: 'ROCK' },
      { x: 1080, y: 540, w: 260, h: 30, type: 'ROCK' },

      // 3. Central Outpost Stone Shelter House (Left & Right Entrances)
      { x: 1600, y: 840, w: 400, h: 36, type: 'HOUSE_ROOF' },
      { x: 1600, y: 876, w: 26, h: 64, type: 'HOUSE_WALL' },
      { x: 1974, y: 876, w: 26, h: 64, type: 'HOUSE_WALL' },

      // 4. Right Mountain Cliffs & Rocky Outcrops
      { x: 2200, y: 840, w: 280, h: 32, type: 'ROCK' },
      { x: 2460, y: 640, w: 300, h: 34, type: 'ROCK' },
      { x: 2880, y: 760, w: 340, h: 32, type: 'ROCK' },
      { x: 3080, y: 520, w: 260, h: 30, type: 'ROCK' }
    ];

    // 5. Tactical Auto-Pickup Crates (Auto-Collected on Contact)
    this.tacticalPickups = [
      { id: 'pk_g1', type: 'GRENADE', x: 460, y: 620, label: '💣 FRAG GRENADES', available: true },
      { id: 'pk_m1', type: 'MINE', x: 1140, y: 500, label: '⚡ PROXIMITY MINE', available: true },
      { id: 'pk_s1', type: 'SMOKE', x: 2520, y: 600, label: '💨 SMOKE GRENADE', available: true },
      { id: 'pk_hp1', type: 'MEDKIT', x: 2980, y: 720, label: '❤️ MEDICAL CASE', available: true }
    ];

    // Central House Guaranteed Rarest Weapon Pedestal
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

  setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      if (key === 'f') {
        this.equipNearbyGun();
      }

      if (key === 'g') this.triggerGrenadeThrow();
      if (key === 'm') this.triggerMinePlant();
      if (key === 'x') this.triggerSmokeDeploy();
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

            if (isRight && dist > 15) {
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

  triggerGrenadeThrow() {
    const p = this.localPlayer;
    if (p.hp <= 0 || p.inventory.grenades <= 0) return;

    p.inventory.grenades--;
    this.updateTacticalHUD();

    const speed = 14.0;
    const grenade = {
      id: `g_${Date.now()}_${Math.random()}`,
      ownerId: this.myPlayerId,
      x: p.x + Math.cos(p.aimAngle) * 28,
      y: p.y + Math.sin(p.aimAngle) * 28,
      vx: Math.cos(p.aimAngle) * speed,
      vy: Math.sin(p.aimAngle) * speed - 4.0,
      fuse: 100
    };

    this.grenades.push(grenade);
    this.send('GRENADE_THROW', grenade);
  }

  triggerMinePlant() {
    const p = this.localPlayer;
    if (p.hp <= 0 || p.inventory.mines <= 0) return;

    p.inventory.mines--;
    this.updateTacticalHUD();

    const mine = {
      id: `m_${Date.now()}_${Math.random()}`,
      ownerId: this.myPlayerId,
      team: p.team,
      x: p.x,
      y: p.y + 18,
      armed: false,
      armTimer: 60
    };

    this.landmines.push(mine);
    this.send('MINE_PLANT', mine);
  }

  triggerSmokeDeploy() {
    const p = this.localPlayer;
    if (p.hp <= 0 || p.inventory.smoke <= 0) return;

    p.inventory.smoke--;
    this.updateTacticalHUD();

    const smoke = {
      id: `s_${Date.now()}_${Math.random()}`,
      x: p.x + Math.cos(p.aimAngle) * 60,
      y: p.y + Math.sin(p.aimAngle) * 60,
      radius: 80,
      life: 450
    };

    this.smokeClouds.push(smoke);
    this.send('SMOKE_SPAWN', smoke);
  }

  updateTacticalHUD() {
    this.tacGrenadeCountEl.textContent = this.localPlayer.inventory.grenades;
    this.tacMineCountEl.textContent = this.localPlayer.inventory.mines;
    this.tacSmokeCountEl.textContent = this.localPlayer.inventory.smoke;
  }

  equipNearbyGun() {
    if (this.nearbyGun && this.nearbyGun.available) {
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

      // Exchange ground weapon
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
    this.localPlayer.x = 700 + Math.random() * 800;
    this.localPlayer.y = 900;

    this.localPlayer.inventory = { grenades: 2, mines: 1, smoke: 1 };
    this.updateTacticalHUD();

    const meInRoom = this.currentRoom?.players.find(p => p.id === this.myPlayerId);
    this.localPlayer.team = meInRoom?.team || 'RED';
    this.localPlayer.color = this.localPlayer.team === 'BLUE' ? '#00A2FF' : '#FF3366';

    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      this.send('PLAYER_SYNC', {
        x: Math.round(this.localPlayer.x),
        y: Math.round(this.localPlayer.y),
        vx: Math.round(this.localPlayer.vx * 10) / 10,
        vy: Math.round(this.localPlayer.vy * 10) / 10,
        aimAngle: this.localPlayer.aimAngle,
        isFlying: this.localPlayer.isFlying,
        hp: this.localPlayer.hp,
        team: this.localPlayer.team,
        weapon: this.currentWeapon
      });
    }, 33);
  }

  handleRemotePlayerSync(data) {
    if (!this.remotePlayers.has(data.id)) {
      this.remotePlayers.set(data.id, {
        id: data.id,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        aimAngle: data.aimAngle,
        hp: data.hp,
        team: data.team,
        weapon: data.weapon || 'uzi',
        color: data.team === 'BLUE' ? '#00A2FF' : '#FF3366',
        targetX: data.x,
        targetY: data.y,
        walkCycle: 0
      });
    } else {
      const p = this.remotePlayers.get(data.id);
      p.targetX = data.x;
      p.targetY = data.y;
      p.aimAngle = data.aimAngle;
      p.hp = data.hp;
      p.weapon = data.weapon || p.weapon;
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

  handleRemoteGrenade(grenade) {
    this.grenades.push({ ...grenade, fuse: 100 });
  }

  handleRemoteMine(mine) {
    this.landmines.push({ ...mine, armTimer: 60, armed: false });
  }

  handleRemoteSmoke(smoke) {
    this.smokeClouds.push({ ...smoke, life: 450 });
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
    if (data.victimId === this.myPlayerId) {
      this.localPlayer.hp = Math.max(0, this.localPlayer.hp - data.damage);
      if (this.localPlayer.hp <= 0) {
        this.send('PLAYER_KILLED', {
          victimId: this.myPlayerId,
          killerId: data.killerId,
          weapon: 'COMBAT'
        });
        setTimeout(() => this.respawnLocalPlayer(), 3000);
      }
    }
  }

  handleRemoteKill(data) {
    const msg = document.createElement('div');
    msg.className = 'kill-msg';
    msg.textContent = `💥 ${data.killerId} eliminated ${data.victimId}`;
    this.killFeedContainer.appendChild(msg);
    setTimeout(() => msg.remove(), 4000);
  }

  respawnLocalPlayer() {
    this.localPlayer.hp = 100;
    this.localPlayer.x = 700 + Math.random() * 1200;
    this.localPlayer.y = 800;
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;
    this.localPlayer.inventory = { grenades: 2, mines: 1, smoke: 1 };
    this.updateTacticalHUD();
  }

  // ──────────────── SIMULATION & SEAMLESS CAMERA ────────────────
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

        if (shouldShoot && now - lastShootTime > cooldown && this.localPlayer.hp > 0) {
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
    const targetX = this.localPlayer.x - this.canvas.width / 2;
    const targetY = this.localPlayer.y - this.canvas.height / 2;

    // Smooth, cinematic camera tracking (no jerky sudden movements)
    this.camera.x += (targetX - this.camera.x) * 0.08;
    this.camera.y += (targetY - this.camera.y) * 0.08;

    this.camera.x = Math.max(0, Math.min(this.worldWidth - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.worldHeight - this.canvas.height, this.camera.y));
  }

  updatePhysics() {
    const p = this.localPlayer;
    if (p.hp <= 0) return;

    let moveX = 0;
    let thrustY = 0;

    if (this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
    if (this.keys['d'] || this.keys['arrowright']) moveX += 1;
    if (this.keys['w'] || this.keys['arrowup'] || this.keys[' ']) thrustY -= 1;

    if (this.touchJoyLeft.active) {
      moveX = this.touchJoyLeft.vx;
      if (this.touchJoyLeft.vy < -0.2) thrustY = this.touchJoyLeft.vy;
    }

    p.vx += moveX * 0.85;
    p.vx *= 0.89;

    if (Math.abs(p.vx) > 0.3 && p.isGrounded) {
      this.walkCycle += Math.abs(p.vx) * 0.25;
    }

    p.vy += 0.46;

    if (thrustY < 0) {
      p.vy -= 1.15;
      p.vy = Math.max(-9.5, p.vy);
      p.isFlying = true;
      p.isGrounded = false;
      this.spawnJetpackParticle(p.x, p.y + 16, p.aimAngle);
    } else {
      p.isFlying = false;
    }

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
      const worldMouseX = this.mouse.x + this.camera.x;
      const worldMouseY = this.mouse.y + this.camera.y;
      p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
    }

    this.remotePlayers.forEach(rp => {
      rp.targetX = Math.max(soldierRadius + 10, Math.min(this.worldWidth - soldierRadius - 10, rp.targetX));
      rp.targetY = Math.max(soldierRadius + 15, Math.min(gy - soldierRadius, rp.targetY));
      rp.x += (rp.targetX - rp.x) * 0.25;
      rp.y += (rp.targetY - rp.y) * 0.25;
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

      if (b.ownerId !== this.myPlayerId && p.hp > 0) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < soldierRadius + 4) {
          const dmg = b.weapon === 'sniper' ? 70 : b.weapon === 'shotgun' ? 14 : b.weapon === 'rpg' ? 90 : 18;
          this.spawnImpactSparks(b.x, b.y, '#FF3366');

          if (b.weapon === 'rpg') {
            this.createExplosion(b.x, b.y, 95, 95, b.ownerId);
          } else {
            p.hp = Math.max(0, p.hp - dmg);
            this.send('PLAYER_HIT', { victimId: this.myPlayerId, killerId: b.ownerId, damage: dmg });
            if (p.hp <= 0) {
              this.send('PLAYER_KILLED', { victimId: this.myPlayerId, killerId: b.ownerId, weapon: b.weapon });
              setTimeout(() => this.respawnLocalPlayer(), 3000);
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

    // Grenades Update & Platform Bounce
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

    // Landmines
    for (let i = this.landmines.length - 1; i >= 0; i--) {
      const m = this.landmines[i];
      if (!m.armed) {
        m.armTimer--;
        if (m.armTimer <= 0) m.armed = true;
      } else {
        if (m.team !== p.team && p.hp > 0 && Math.hypot(m.x - p.x, m.y - p.y) < 45) {
          this.createExplosion(m.x, m.y, 90, 100, m.ownerId);
          this.landmines.splice(i, 1);
        }
      }
    }

    // Smoke
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const s = this.smokeClouds[i];
      s.life--;
      if (s.life <= 0) this.smokeClouds.splice(i, 1);
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
      if (pk.available && Math.hypot(p.x - pk.x, p.y - pk.y) < 38) {
        pk.available = false;

        if (pk.type === 'GRENADE') { p.inventory.grenades = Math.min(4, p.inventory.grenades + 2); this.addPickupNotification('+2 FRAG GRENADES', '#00E676'); }
        else if (pk.type === 'MINE') { p.inventory.mines = Math.min(3, p.inventory.mines + 1); this.addPickupNotification('+1 PROXIMITY MINE', '#FF3366'); }
        else if (pk.type === 'SMOKE') { p.inventory.smoke = Math.min(3, p.inventory.smoke + 1); this.addPickupNotification('+1 SMOKE GRENADE', '#00E5FF'); }
        else if (pk.type === 'MEDKIT') { p.hp = Math.min(100, p.hp + 50); this.addPickupNotification('+50 HEALTH RESTORED', '#00E676'); }

        this.updateTacticalHUD();
        this.send('PICKUP_COLLECT', { pickupId: pk.id, pickupType: pk.type });
      }
    }

    // Manual [F] Gun Prompt
    this.nearbyGun = null;
    let closestDist = 52;

    for (const gun of this.groundGuns) {
      if (gun.available) {
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
    if (dist <= radius && p.hp > 0) {
      const dmg = Math.round(maxDamage * (1 - dist / radius));
      p.hp = Math.max(0, p.hp - dmg);
      this.send('PLAYER_HIT', { victimId: this.myPlayerId, killerId: attackerId, damage: dmg });
      if (p.hp <= 0) {
        this.send('PLAYER_KILLED', { victimId: this.myPlayerId, killerId: attackerId, weapon: 'EXPLOSIVE' });
        setTimeout(() => this.respawnLocalPlayer(), 3000);
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
        x: p.x + Math.cos(p.aimAngle) * 26,
        y: p.y + Math.sin(p.aimAngle) * 26,
        vx: Math.cos(p.aimAngle) * 18,
        vy: Math.sin(p.aimAngle) * 18,
        weapon: 'uzi',
        ownerId: this.myPlayerId,
        color: '#00E5FF'
      };
      this.bullets.push(bullet);
      this.send('BULLET_FIRE', bullet);
    } else if (wep === 'shotgun') {
      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.35;
        const angle = p.aimAngle + spread;
        const speed = 15 + Math.random() * 3;
        const bullet = {
          x: p.x + Math.cos(angle) * 26,
          y: p.y + Math.sin(angle) * 26,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          weapon: 'shotgun',
          ownerId: this.myPlayerId,
          color: '#FF7B00'
        };
        this.bullets.push(bullet);
        this.send('BULLET_FIRE', bullet);
      }
    } else if (wep === 'sniper') {
      const bullet = {
        x: p.x + Math.cos(p.aimAngle) * 32,
        y: p.y + Math.sin(p.aimAngle) * 32,
        vx: Math.cos(p.aimAngle) * 28,
        vy: Math.sin(p.aimAngle) * 28,
        weapon: 'sniper',
        ownerId: this.myPlayerId,
        color: '#00FF66'
      };
      this.bullets.push(bullet);
      this.send('BULLET_FIRE', bullet);
    } else if (wep === 'rpg') {
      const rocket = {
        x: p.x + Math.cos(p.aimAngle) * 30,
        y: p.y + Math.sin(p.aimAngle) * 30,
        vx: Math.cos(p.aimAngle) * 12,
        vy: Math.sin(p.aimAngle) * 12,
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

  // ──────────────── SEAMLESS RENDERING PIPELINE ────────────────
  renderCanvas() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const camX = this.camera.x;
    const camY = this.camera.y;

    ctx.clearRect(0, 0, W, H);

    // 1. STABLE & CALM DISTANT MOUNTAIN BACKDROP (ZERO MOTION SICKNESS / ZERO SEAMS)
    if (this.assets.loaded && this.assets.bg.complete) {
      const bg = this.assets.bg;

      // Fill viewport with extra margin for ultra-subtle panning
      const scale = Math.max(W / bg.width, H / bg.height) * 1.08;
      const scaledW = bg.width * scale;
      const scaledH = bg.height * scale;

      // Ultra-subtle 2% horizontal parallax, rock-solid vertical lock (no dizzying jumps!)
      const maxCamX = Math.max(1, this.worldWidth - W);
      const bgTravelX = Math.max(0, scaledW - W);
      const bgX = -(camX / maxCamX) * (bgTravelX * 0.25);
      const bgY = (H - scaledH) / 2; // Locked vertically for complete visual stability

      ctx.drawImage(bg, bgX, bgY, scaledW, scaledH);

      // Gentle atmospheric depth haze
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

    // ──────────────── WORLD SPACE ────────────────
    ctx.save();
    ctx.translate(-camX, -camY);

    // 2. Draw Natural Terrain (3D Shaded Cliffs, Rocks, and Stone Shelter)
    for (const plat of this.platforms) {
      if (plat.type === 'GROUND') {
        // Natural Earth & Bedrock
        ctx.fillStyle = '#2C1B10';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Subsoil Layer
        ctx.fillStyle = '#422A18';
        ctx.fillRect(plat.x, plat.y, plat.w, 36);

        // Lush Natural Grass Layer
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(plat.x, plat.y, plat.w, 14);

        // 3D Grass Tufts & Wildflowers
        ctx.fillStyle = '#66BB6A';
        for (let x = 0; x < plat.w; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, plat.y);
          ctx.lineTo(x + 4, plat.y - 7);
          ctx.lineTo(x + 9, plat.y);
          ctx.fill();
        }
      } else if (plat.type === 'ROCK') {
        // Multi-Facet 3D Natural Rock Ledge
        ctx.save();
        // Drop Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(plat.x + 4, plat.y + plat.h, plat.w - 8, 12);

        // Granite Body
        ctx.fillStyle = '#37474F';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Rock Strata Shading
        ctx.fillStyle = '#263238';
        ctx.fillRect(plat.x, plat.y + plat.h - 12, plat.w, 12);

        // Mossy Overhang Top
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(plat.x, plat.y, plat.w, 8);

        // Hanging Vines
        ctx.fillStyle = '#2E7D32';
        for (let x = plat.x + 20; x < plat.x + plat.w - 20; x += 35) {
          ctx.fillRect(x, plat.y + 8, 4, 10 + (x % 7));
        }

        ctx.strokeStyle = '#1E272C';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();
      } else if (plat.type === 'HOUSE_ROOF') {
        // Natural Stone Shelter Roof Slab
        ctx.save();
        ctx.fillStyle = '#263238';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Moss & Turf Top
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(plat.x, plat.y, plat.w, 10);
        ctx.strokeStyle = '#FFD600';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();
      } else if (plat.type === 'HOUSE_WALL') {
        // Stone Masonry Shelter Wall
        ctx.save();
        ctx.fillStyle = '#1E272C';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = '#455A64';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();
      }
    }

    // Draw Central Shelter Interior Aura & Sign
    ctx.save();
    ctx.fillStyle = 'rgba(255, 214, 0, 0.08)';
    ctx.fillRect(1626, 876, 348, 204);
    ctx.font = 'bold 12px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#FFD600';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FFD600';
    ctx.textAlign = 'center';
    ctx.fillText('🏛️ RAREST WEAPON VAULT', 1800, 915);
    ctx.restore();

    // 3. Draw Tactical Auto-Pickups
    for (const pk of this.tacticalPickups) {
      if (pk.available) {
        this.drawTacticalPickup(ctx, pk);
      }
    }

    // 4. Draw Dropped Ground Guns & [F] Prompt
    for (const gun of this.groundGuns) {
      if (gun.available) {
        this.drawGroundGun(ctx, gun);
      }
    }

    // 5. Draw Smoke Clouds
    for (const s of this.smokeClouds) {
      ctx.save();
      const alpha = Math.min(0.65, s.life / 200);
      ctx.fillStyle = `rgba(170, 185, 205, ${alpha})`;
      ctx.shadowBlur = 25;
      ctx.shadowColor = 'rgba(170, 185, 205, 0.5)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Draw Landmines
    for (const m of this.landmines) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = m.armed ? '#FF3366' : '#FFD600';
      ctx.shadowBlur = 10;
      ctx.shadowColor = m.armed ? '#FF3366' : '#FFD600';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 7. Draw Frag Grenades
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

    // 8. Draw Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Draw Bullets & Rockets
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
        this.particles.push({
          x: b.x, y: b.y,
          vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
          color: '#888888', alpha: 0.8, radius: 3
        });
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

    // 10. Draw Remote Articulated Soldiers
    this.remotePlayers.forEach(rp => {
      this.drawArticulatedSoldier(ctx, rp, false, rp.walkCycle || 0, 0);
    });

    // 11. Draw Local Articulated Soldier
    if (this.localPlayer.hp > 0) {
      this.drawArticulatedSoldier(ctx, this.localPlayer, true, this.walkCycle, this.recoilOffset);
    }

    // 12. Draw Floating Notifications
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
  }

  // ──────────────── DRAW GROUND WEAPON & [F] PROMPT ────────────────
  drawGroundGun(ctx, gun) {
    ctx.save();
    ctx.translate(gun.x, gun.y);

    const time = performance.now() * 0.003;
    const bob = Math.sin(time * 2) * 5;
    const isNearby = this.nearbyGun === gun;
    const glowColor = gun.rarity === 'LEGENDARY' ? '#FFD600' : gun.rarity === 'RARE' ? '#00FF66' : gun.rarity === 'UNCOMMON' ? '#FF7B00' : '#00E5FF';

    // Holographic Ground Disc
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

    // Floating 3D Gun Model
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

    // In-World [F] Prompt Badge when nearby
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
      ctx.fillText(`[F] EQUIP ${gun.name.split(' ')[0]}`, 0, 4);
      ctx.restore();
    } else {
      ctx.font = 'bold 9px "Chakra Petch", sans-serif';
      ctx.fillStyle = glowColor;
      ctx.textAlign = 'center';
      ctx.fillText(gun.name, 0, -22 + bob);
    }

    ctx.restore();
  }

  // ──────────────── DRAW TACTICAL AUTO-PICKUPS ────────────────
  drawTacticalPickup(ctx, pk) {
    ctx.save();
    ctx.translate(pk.x, pk.y);

    const time = performance.now() * 0.003;
    const bob = Math.sin(time * 2) * 4;
    const glowColor = pk.type === 'MEDKIT' ? '#00E676' : '#FFD600';

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
    } else if (pk.type === 'SMOKE') {
      ctx.fillStyle = '#4A5568';
      ctx.fillRect(-7, -12, 14, 22);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-7, -3, 14, 5);
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

  // ──────────────── SKELETAL ARTICULATED SOLDIER RIGGING ────────────────
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
    if (facingLeft) {
      ctx.scale(-1, 1);
    }

    let localAim = p.aimAngle;
    if (facingLeft) {
      localAim = Math.PI - p.aimAngle;
    }

    // 1. BACK JETPACK
    ctx.fillStyle = '#222B38';
    ctx.strokeStyle = '#4A5B70';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-20, -12, 10, 24);
    ctx.strokeRect(-20, -12, 10, 24);
    ctx.fillStyle = '#111';
    ctx.fillRect(-22, 12, 6, 6);
    ctx.fillRect(-15, 12, 6, 6);

    // 2. ARTICULATED LEGS & BOOTS
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

    // 3. TORSO & ARMORED CHEST VEST
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

    // 4. HEAD / BALLISTIC HELMET
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

    // 5. ARTICULATED 360° SHOULDER & ARM
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

    // Overhead HUD Tags
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

  // ──────────────── WEAPON GEOMETRY MODELS ────────────────
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
