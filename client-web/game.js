// 🎮 Mini Militia 2D — Articulated Skeletal Soldier & Multi-Weapon Tactical Engine

class MultiplayerGameApp {
  constructor() {
    this.ws = null;
    this.myPlayerId = null;
    this.myNickname = "Commander";
    this.currentRoom = null;
    this.isHost = false;

    this.currentWeapon = 'uzi'; // 'uzi', 'shotgun', 'sniper', 'rpg'
    this.walkCycle = 0;
    this.recoilOffset = 0;

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

    this.tacGrenadeCountEl = document.getElementById('tac-grenade-count');
    this.tacMineCountEl = document.getElementById('tac-mine-count');
    this.tacSmokeCountEl = document.getElementById('tac-smoke-count');
  }

  loadAssets() {
    this.assets = {
      bg: new Image(),
      weapons: new Image(),
      loaded: false
    };

    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) this.assets.loaded = true;
    };

    this.assets.bg.src = 'assets/arena_bunker_bg.jpg';
    this.assets.weapons.src = 'assets/weapons.jpg';

    this.assets.bg.onload = onLoaded;
    this.assets.weapons.onload = onLoaded;
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

    // Weapon Switcher Buttons
    document.querySelectorAll('.weapon-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectWeapon(btn.dataset.weapon);
      });
    });

    // Tactical Item Triggers
    document.getElementById('btn-throw-grenade').addEventListener('click', () => this.triggerGrenadeThrow());
    document.getElementById('btn-plant-mine').addEventListener('click', () => this.triggerMinePlant());
    document.getElementById('btn-throw-smoke').addEventListener('click', () => this.triggerSmokeDeploy());
  }

  selectWeapon(wepKey) {
    this.currentWeapon = wepKey;
    document.querySelectorAll('.weapon-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.weapon === wepKey);
    });

    const names = {
      uzi: 'DUAL SMG UZI',
      shotgun: 'COMBAT SHOTGUN',
      sniper: 'MARKSMAN SNIPER',
      rpg: 'ROCKET LAUNCHER'
    };
    this.hudWeaponName.textContent = names[wepKey] || 'DUAL UZI';
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

  // ──────────────── 2D COMBAT ARENA ENGINE ────────────────
  initGameCanvas() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.localPlayer = {
      id: null,
      x: 300,
      y: 400,
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

    this.platforms = [];
    this.pickups = [];

    this.keys = {};
    this.mouse = { x: 0, y: 0, isDown: false };
    this.touchJoyLeft = { active: false, vx: 0, vy: 0 };
    this.touchJoyRight = { active: false, vx: 0, vy: 0, isAiming: false };

    this.setupInputHandlers();
    this.rebuildArenaLayout();
    this.startRenderLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.rebuildArenaLayout();
  }

  rebuildArenaLayout() {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const groundY = H - 80;

    // Solid Tactical Obstacles & Bunkers
    this.platforms = [
      { x: 0, y: groundY, w: W, h: 80, name: 'Ground' },
      { x: W * 0.08, y: H * 0.68, w: W * 0.22, h: 24, name: 'Left Lower Bunker' },
      { x: W * 0.12, y: H * 0.46, w: W * 0.16, h: 24, name: 'Left High Perch' },
      { x: W * 0.38, y: H * 0.58, w: W * 0.24, h: 26, name: 'Central Catwalk' },
      { x: W * 0.42, y: H * 0.36, w: W * 0.16, h: 22, name: 'Sniper Watchtower' },
      { x: W * 0.70, y: H * 0.68, w: W * 0.22, h: 24, name: 'Right Lower Bunker' },
      { x: W * 0.72, y: H * 0.46, w: W * 0.16, h: 24, name: 'Right High Perch' }
    ];

    this.pickups = [
      { id: 'pk_g1', type: 'GRENADE', x: W * 0.5, y: H * 0.32, label: '💣 GRENADES', available: true },
      { id: 'pk_m1', type: 'MINE', x: W * 0.18, y: H * 0.42, label: '⚡ MINES', available: true },
      { id: 'pk_s1', type: 'SMOKE', x: W * 0.82, y: H * 0.42, label: '💨 SMOKE', available: true },
      { id: 'pk_hp1', type: 'MEDKIT', x: W * 0.5, y: H * 0.54, label: '❤️ MEDKIT', available: true }
    ];
  }

  setupInputHandlers() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // Weapon Keys 1, 2, 3, 4
      if (key === '1') this.selectWeapon('uzi');
      if (key === '2') this.selectWeapon('shotgun');
      if (key === '3') this.selectWeapon('sniper');
      if (key === '4') this.selectWeapon('rpg');

      // Tactical Keys
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

  // ──────────────── TACTICAL ITEMS ────────────────
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

  startInGameMatch(matchData) {
    this.showScreen('game');
    this.rebuildArenaLayout();

    this.localPlayer.id = this.myPlayerId;
    this.localPlayer.hp = 100;
    this.localPlayer.x = this.canvas.width * 0.25 + Math.random() * (this.canvas.width * 0.5);
    this.localPlayer.y = this.canvas.height * 0.5;

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
    const pk = this.pickups.find(p => p.id === data.pickupId);
    if (pk) pk.available = false;
  }

  handleRemotePickupRespawn(data) {
    const pk = this.pickups.find(p => p.id === data.pickupId);
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
    this.localPlayer.x = this.canvas.width * 0.2 + Math.random() * (this.canvas.width * 0.6);
    this.localPlayer.y = this.canvas.height * 0.4;
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;
    this.localPlayer.inventory = { grenades: 2, mines: 1, smoke: 1 };
    this.updateTacticalHUD();
  }

  // ──────────────── SIMULATION & RENDERING ────────────────
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

        const now = performance.now();
        const shouldShoot = this.mouse.isDown || this.touchJoyRight.isAiming;
        const cooldown = fireDelays[this.currentWeapon] || 110;

        if (shouldShoot && now - lastShootTime > cooldown && this.localPlayer.hp > 0) {
          lastShootTime = now;
          this.recoilOffset = 8.0; // Recoil Kickback
          this.fireWeapon();
        }

        // Decay Recoil Kickback
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

    // Running Walk Cycle
    if (Math.abs(p.vx) > 0.3 && p.isGrounded) {
      this.walkCycle += Math.abs(p.vx) * 0.25;
    }

    // Gravity
    p.vy += 0.46;

    // Infinite Jetpack Thrust
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

    // ──────────────── IMPENETRABLE WORLD BOUNDARIES ────────────────
    const soldierRadius = 22;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const groundY = H - 80;

    if (p.x - soldierRadius < 10) { p.x = 10 + soldierRadius; p.vx = 0; }
    if (p.x + soldierRadius > W - 10) { p.x = W - 10 - soldierRadius; p.vx = 0; }
    if (p.y - soldierRadius < 15) { p.y = 15 + soldierRadius; p.vy = 0; }
    if (p.y + soldierRadius > groundY) { p.y = groundY - soldierRadius; p.vy = 0; p.isGrounded = true; }

    // Platform Landing Collisions
    p.isGrounded = p.y + soldierRadius >= groundY - 2;
    for (const plat of this.platforms) {
      if (
        p.x + soldierRadius > plat.x &&
        p.x - soldierRadius < plat.x + plat.w &&
        p.y + soldierRadius >= plat.y &&
        p.y + soldierRadius <= plat.y + 22 &&
        p.vy >= 0
      ) {
        p.y = plat.y - soldierRadius;
        p.vy = 0;
        p.isGrounded = true;
      }
    }

    // Aim Angle
    if (this.touchJoyRight.isAiming) {
      p.aimAngle = Math.atan2(this.touchJoyRight.vy, this.touchJoyRight.vx);
    } else {
      p.aimAngle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
    }

    // Remote Players Clamping & Interpolation
    this.remotePlayers.forEach(rp => {
      rp.targetX = Math.max(soldierRadius + 10, Math.min(W - soldierRadius - 10, rp.targetX));
      rp.targetY = Math.max(soldierRadius + 15, Math.min(groundY - soldierRadius, rp.targetY));
      rp.x += (rp.targetX - rp.x) * 0.25;
      rp.y += (rp.targetY - rp.y) * 0.25;
    });

    // ──────────────── BULLET & SOLID PLATFORM COLLISION (FIXED: NO PENETRATION) ────────────────
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life++;

      // 1. Check Platform / Obstacle Hit (STOP BULLET IMMEDIATELY)
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

      // 2. Check Hit on Local Player
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

      // 3. Despawn at Boundary Edge
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > groundY || b.life > 65) {
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

      // Boundary Bounces
      if (g.x < 15 || g.x > W - 15) {
        g.vx = -g.vx * 0.7;
        g.x = Math.max(15, Math.min(W - 15, g.x));
      }
      if (g.y >= groundY - 8) {
        g.y = groundY - 8;
        g.vy = -g.vy * 0.55;
        g.vx *= 0.75;
      }

      // Platform Bounces
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

    // Pickups
    for (const pk of this.pickups) {
      if (pk.available && Math.hypot(p.x - pk.x, p.y - pk.y) < 36) {
        pk.available = false;
        if (pk.type === 'GRENADE') p.inventory.grenades = Math.min(4, p.inventory.grenades + 2);
        else if (pk.type === 'MINE') p.inventory.mines = Math.min(3, p.inventory.mines + 1);
        else if (pk.type === 'SMOKE') p.inventory.smoke = Math.min(3, p.inventory.smoke + 1);
        else if (pk.type === 'MEDKIT') p.hp = Math.min(100, p.hp + 50);

        this.updateTacticalHUD();
        this.send('PICKUP_COLLECT', { pickupId: pk.id, pickupType: pk.type });
      }
    }
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
      // 6-pellet spread
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

  // ──────────────── RENDERING SKELETAL SOLDIER & WEAPONS ────────────────
  renderCanvas() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const groundY = H - 80;

    // 1. Draw Sci-Fi Outpost Background
    if (this.assets.loaded && this.assets.bg.complete) {
      ctx.drawImage(this.assets.bg, 0, 0, W, H);
    } else {
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Draw Reinforced Catwalk Platforms
    for (const plat of this.platforms) {
      if (plat.name === 'Ground') {
        ctx.fillStyle = '#1A2130';
        ctx.fillRect(0, groundY, W, 80);
        ctx.fillStyle = 'rgba(255, 214, 0, 0.4)';
        for (let x = 0; x < W; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, groundY);
          ctx.lineTo(x + 20, groundY);
          ctx.lineTo(x + 10, groundY + 12);
          ctx.lineTo(x - 10, groundY + 12);
          ctx.fill();
        }
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, groundY, W, 80);
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(24, 34, 52, 0.94)';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Warning LED lights on platform underside
        ctx.fillStyle = '#FF7B00';
        ctx.beginPath();
        ctx.arc(plat.x + 12, plat.y + plat.h + 4, 3, 0, Math.PI * 2);
        ctx.arc(plat.x + plat.w - 12, plat.y + plat.h + 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 3. Draw Tactical Crates
    for (const pk of this.pickups) {
      if (pk.available) {
        ctx.save();
        ctx.translate(pk.x, pk.y);
        const bob = Math.sin(performance.now() * 0.005) * 4;
        ctx.translate(0, bob);

        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFD600';
        ctx.fillStyle = '#FFD600';
        ctx.fillRect(-14, -14, 28, 28);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-14, -14, 28, 28);

        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(-14, -14); ctx.lineTo(14, 14);
        ctx.moveTo(14, -14); ctx.lineTo(-14, 14);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.font = 'bold 9px "Chakra Petch", sans-serif';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.fillText(pk.type.slice(0, 3), 0, 4);
        ctx.restore();
      }
    }

    // 4. Draw Smoke Clouds
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

    // 5. Draw Landmines
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

    // 6. Draw Frag Grenades
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

    // 7. Draw Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Draw Bullets & Rockets
    for (const b of this.bullets) {
      ctx.save();
      if (b.weapon === 'rpg') {
        // Rocket warhead render
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(-12, -4, 20, 8);
        ctx.fillStyle = '#FF3366';
        ctx.beginPath();
        ctx.moveTo(8, -4); ctx.lineTo(14, 0); ctx.lineTo(8, 4);
        ctx.fill();
        // Rocket Smoke Trail
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

    // 9. Draw Remote Articulated Soldiers
    this.remotePlayers.forEach(rp => {
      this.drawArticulatedSoldier(ctx, rp, false, rp.walkCycle || 0, 0);
    });

    // 10. Draw Local Articulated Soldier
    if (this.localPlayer.hp > 0) {
      this.drawArticulatedSoldier(ctx, this.localPlayer, true, this.walkCycle, this.recoilOffset);
    }
  }

  // ──────────────── SKELETAL ARTICULATED SOLDIER RIGGING ────────────────
  drawArticulatedSoldier(ctx, p, isLocal, walkCycle, recoil) {
    ctx.save();
    ctx.translate(p.x, p.y);

    const facingLeft = Math.cos(p.aimAngle) < 0;
    const teamColor = p.team === 'BLUE' ? '#00A2FF' : '#FF3366';
    const visorColor = p.team === 'BLUE' ? '#00E5FF' : '#FFD600';
    const equippedWep = isLocal ? this.currentWeapon : (p.weapon || 'uzi');

    // Laser Sight Guide
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

    // Adjust aim angle relative to facing direction
    let localAim = p.aimAngle;
    if (facingLeft) {
      localAim = Math.PI - p.aimAngle;
    }

    // 1. BACK JETPACK (Dual Cannisters with Exhaust Gimbals)
    ctx.fillStyle = '#222B38';
    ctx.strokeStyle = '#4A5B70';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-20, -12, 10, 24);
    ctx.strokeRect(-20, -12, 10, 24);

    // Jetpack Thruster Nozzles
    ctx.fillStyle = '#111';
    ctx.fillRect(-22, 12, 6, 6);
    ctx.fillRect(-15, 12, 6, 6);

    // 2. ARTICULATED LEGS & COMBAT BOOTS
    const legAngle1 = p.isFlying ? 0.35 : Math.sin(walkCycle) * 0.45;
    const legAngle2 = p.isFlying ? 0.55 : -Math.sin(walkCycle) * 0.45;

    // Back Leg
    ctx.save();
    ctx.translate(-4, 12);
    ctx.rotate(legAngle2);
    ctx.fillStyle = '#1E2530';
    ctx.fillRect(-3, 0, 6, 14); // Thigh
    ctx.fillStyle = '#111822';
    ctx.fillRect(-4, 12, 9, 6);  // Boot
    ctx.restore();

    // 3. TORSO & ARMORED CHEST VEST
    ctx.fillStyle = '#2A3444';
    ctx.fillRect(-10, -10, 20, 22);
    // Team Armor Plate
    ctx.fillStyle = teamColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = teamColor;
    ctx.fillRect(-8, -8, 16, 14);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-8, -8, 16, 14);

    // Tactical Harness Belts
    ctx.fillStyle = '#111';
    ctx.fillRect(-10, 8, 20, 4);

    // Front Leg
    ctx.save();
    ctx.translate(4, 12);
    ctx.rotate(legAngle1);
    ctx.fillStyle = '#2E3847';
    ctx.fillRect(-3, 0, 6, 14); // Thigh
    ctx.fillStyle = '#111822';
    ctx.fillRect(-4, 12, 9, 6);  // Boot
    ctx.restore();

    // 4. HEAD / BALLISTIC HELMET WITH GLOWING VISOR
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate(localAim * 0.25); // Head tilts with aim
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#1E2530';
    ctx.fill();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing Visor
    ctx.fillStyle = visorColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = visorColor;
    ctx.beginPath();
    ctx.roundRect(2, -4, 8, 6, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 5. ARTICULATED 360° SHOULDER & ARM HOLDING EQUIPPED WEAPON
    ctx.save();
    ctx.translate(0, -2);
    ctx.rotate(localAim);
    ctx.translate(-recoil, 0); // Apply Recoil Kickback

    // Upper Arm
    ctx.fillStyle = '#2A3444';
    ctx.fillRect(0, -3, 12, 6);

    // DRAW EQUIPPED WEAPON MODEL
    this.drawWeaponModel(ctx, equippedWep, teamColor);

    // Forearm & Hand Gripping Gun
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
      // Dual SMG Uzi
      ctx.fillStyle = '#1B1F28';
      ctx.fillRect(10, -5, 18, 9);
      ctx.fillStyle = '#0E1116';
      ctx.fillRect(28, -3, 8, 4); // Barrel
      ctx.fillRect(14, 4, 5, 8);  // Magazine
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(12, -4, 12, 2); // Glow strip
    } else if (wep === 'shotgun') {
      // Heavy Combat Shotgun
      ctx.fillStyle = '#232936';
      ctx.fillRect(8, -6, 26, 10);
      ctx.fillStyle = '#111';
      ctx.fillRect(34, -4, 10, 6); // Heavy barrel
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(16, 2, 10, 4); // Ribbed grip
      ctx.fillStyle = '#FF7B00';
      ctx.fillRect(10, -5, 14, 2);
    } else if (wep === 'sniper') {
      // Marksman Sniper Rifle
      ctx.fillStyle = '#1A212D';
      ctx.fillRect(6, -5, 24, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(30, -3, 22, 4); // Long precision barrel
      ctx.fillRect(48, -4, 4, 6);  // Muzzle brake
      // High-tech Optical Scope
      ctx.fillStyle = '#111';
      ctx.fillRect(12, -10, 14, 5);
      ctx.fillStyle = '#00FF66';
      ctx.fillRect(24, -9, 3, 3);  // Laser Scope Lens
    } else if (wep === 'rpg') {
      // Heavy RPG Rocket Launcher Tube
      ctx.fillStyle = '#3B4834';
      ctx.fillRect(4, -8, 30, 14); // Launcher tube
      ctx.fillStyle = '#1A2118';
      ctx.fillRect(34, -7, 6, 12);
      // Warhead Cone
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
