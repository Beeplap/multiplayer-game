// 🎮 WEGETHER — 2D Tactical Combat with Yellow Toxic Gas, Sticky Landmines & Crosshair

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

    // Balanced 1x-4x Tactical Zoom Presets (Optimized field of view without shrinking terrain)
    this.zoomPresets = [
      { label: '1x', scale: 1.0 },
      { label: '2x', scale: 0.90 },
      { label: '3x', scale: 0.80 },
      { label: '4x', scale: 0.70 }
    ];
    this.zoomIndex = 0;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;

    this.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 900;
    this.lastRenderedHp = -1;

    // ──────────────── SWARM SURVIVAL & AI COMPANION ENGINE ────────────────
    this.gameMode = 'MULTIPLAYER'; // 'MULTIPLAYER' | 'SWARM_SURVIVAL'
    this.swarmBots = [];
    this.aiCompanion = null;
    this.swarmState = {
      wave: 1,
      score: 0,
      highScore: parseInt(localStorage.getItem('wegether_highscore') || '0', 10),
      highestWave: parseInt(localStorage.getItem('wegether_highest_wave') || '1', 10),
      botsRemaining: 0,
      waveActive: false,
      waveDelayTimer: 0
    };

    // ──────────────── AUDIO & CUSTOMIZATION ENGINE ────────────────
    this.sfxEnabled = true;
    this.audioCtx = null;
    this.sfxVolume = parseFloat(localStorage.getItem('wegether_sfx_vol') || '0.8');
    this.hapticsEnabled = localStorage.getItem('wegether_haptics') !== 'false';
    this.joystickSize = localStorage.getItem('wegether_joy_size') || 'normal';
    this.myNickname = localStorage.getItem('wegether_callsign') || 'Commander';
    this.soldierColor = localStorage.getItem('wegether_armor_color') || '#FF3366';
    
    // Floating damage numbers & hitmarker indicators
    this.floatingTexts = [];
    this.hitmarkerTimer = 0;
    this.totalKills = 0;

    this.initDOM();
    this.detectTouchDevice();
    this.loadAssets();
    this.initWebSocket();
    this.setupEventListeners();
    this.initGameCanvas();
    this.updateHighScoreUI();
    this.applyJoystickSize(this.joystickSize);
    this.initMenuSoldierCanvas();
  }

  // ──────────────── PROCEDURAL WEBAUDIO SOUND SYNTHESIZER ────────────────
  initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playMenuClick() {
    if (!this.sfxEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch (e) {}
  }

  playHitmarkerSound() {
    if (!this.sfxEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.2 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
  }

  playShootSound(wep = 'uzi') {
    if (!this.sfxEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const vol = this.sfxVolume;

      if (wep === 'uzi') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        gain.gain.setValueAtTime(0.14 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (wep === 'shotgun') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
        gain.gain.setValueAtTime(0.35 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (wep === 'sniper') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
        gain.gain.setValueAtTime(0.25 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (wep === 'rpg') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
        gain.gain.setValueAtTime(0.35 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {}
  }

  playExplosionSound() {
    if (!this.sfxEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 0.45);
      gain.gain.setValueAtTime(0.38 * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  }

  playWaveClearSound() {
    if (!this.sfxEnabled) return;
    this.initAudio();
    if (!this.audioCtx) return;
    try {
      const ctx = this.audioCtx;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const now = ctx.currentTime + i * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      });
    } catch (e) {}
  }

  setGlow(ctx, color, blur) {
    if (!this.isMobile && blur > 0) {
      ctx.shadowBlur = blur;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }
  }

  detectTouchDevice() {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia("(pointer: coarse)").matches) || this.isMobile;
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

    this.modalMpHub = document.getElementById('modal-multiplayer-hub');
    this.modalArmory = document.getElementById('modal-armory');
    this.modalControls = document.getElementById('modal-controls-guide');
    this.modalPause = document.getElementById('modal-pause');
    this.modalDebrief = document.getElementById('modal-debrief');
    this.modalSettings = document.getElementById('modal-settings');
    this.lowHpVignette = document.getElementById('low-hp-vignette');

    this.menuHighScoreEl = document.getElementById('menu-high-score');
    this.menuHighestWaveEl = document.getElementById('menu-highest-wave');
    this.displayCallsignEl = document.getElementById('display-callsign');

    this.swarmHudOverlay = document.getElementById('swarm-hud-overlay');
    this.hudMultiplayerScore = document.getElementById('hud-multiplayer-score');
    this.swarmWaveNumEl = document.getElementById('swarm-wave-num');
    this.swarmBotsAliveEl = document.getElementById('swarm-bots-alive');
    this.swarmScoreValEl = document.getElementById('swarm-score-val');
    this.swarmWaveBanner = document.getElementById('swarm-wave-banner');
    this.waveBannerTitle = document.getElementById('wave-banner-title');
    this.waveBannerSubtitle = document.getElementById('wave-banner-subtitle');

    this.nicknameInput = document.getElementById('player-nickname');
    this.joinCodeInput = document.getElementById('join-code-input');

    if (this.nicknameInput && this.myNickname) {
      this.nicknameInput.value = this.myNickname;
    }
    if (this.displayCallsignEl && this.myNickname) {
      this.displayCallsignEl.textContent = this.myNickname;
    }

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

    this.serverAddressTextEl = document.getElementById('connected-server-address');
    this.serverStatusDotEl = document.getElementById('server-status-dot');

    // Restore selected color swatch
    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === this.soldierColor);
    });
  }

  applyJoystickSize(size = 'normal') {
    this.joystickSize = size;
    localStorage.setItem('wegether_joy_size', size);
    const zones = document.querySelectorAll('.joystick-zone');
    const bases = document.querySelectorAll('.joystick-base');
    const thumbs = document.querySelectorAll('.joystick-thumb');

    let basePx = '100px', thumbPx = '44px', zonePx = '140px';
    if (size === 'compact') {
      basePx = '80px'; thumbPx = '36px'; zonePx = '110px';
    } else if (size === 'large') {
      basePx = '120px'; thumbPx = '52px'; zonePx = '160px';
    }

    zones.forEach(z => { z.style.width = zonePx; z.style.height = zonePx; });
    bases.forEach(b => { b.style.width = basePx; b.style.height = basePx; });
    thumbs.forEach(t => { t.style.width = thumbPx; t.style.height = thumbPx; });
  }

  initMenuSoldierCanvas() {
    this.menuSoldierCanvas = document.getElementById('menu-soldier-canvas');
    if (this.menuSoldierCanvas) {
      this.menuSoldierCtx = this.menuSoldierCanvas.getContext('2d');
      this.renderMenuSoldier();
    }
  }

  renderMenuSoldier() {
    if (!this.menuSoldierCtx || !this.menuSoldierCanvas) return;
    const ctx = this.menuSoldierCtx;
    const W = this.menuSoldierCanvas.width;
    const H = this.menuSoldierCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const dummySoldier = {
      x: W / 2,
      y: H / 2 + 10,
      aimAngle: 0.15,
      color: this.soldierColor || '#FF3366',
      team: 'RED',
      isFlying: false,
      nickname: this.myNickname || 'Commander'
    };

    ctx.save();
    this.drawArticulatedSoldier(ctx, dummySoldier, true, 0, 0);
    ctx.restore();
  }

  updateHighScoreUI() {
    if (this.menuHighScoreEl) this.menuHighScoreEl.textContent = `${this.swarmState.highScore.toLocaleString()} PTS`;
    if (this.menuHighestWaveEl) this.menuHighestWaveEl.textContent = `WAVE ${this.swarmState.highestWave}`;
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

  // ──────────────── WEBSOCKET & AUTOMATIC NETWORKING ────────────────
  getAutoServerUrl() {
    // 1. If running as a local file or no host, default to local dev server
    if (window.location.protocol === 'file:' || !window.location.host) {
      return 'ws://localhost:3000';
    }
    // 2. Automatic Secure / Insecure Protocol detection based on HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 3. Connect to the exact domain and port where the game is hosted (Render, Localhost, etc.)
    return `${protocol}//${window.location.host}`;
  }

  showToast(title, subtitle, icon = '📋') {
    const toast = document.getElementById('toast-popup');
    const titleEl = document.getElementById('toast-title');
    const subEl = document.getElementById('toast-subtitle');
    const iconEl = toast?.querySelector('.toast-icon');

    if (toast && titleEl && subEl) {
      titleEl.textContent = title;
      subEl.textContent = subtitle;
      if (iconEl) iconEl.textContent = icon;

      toast.classList.remove('hidden');
      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 2800);
    }
  }

  async detectServerLocation() {
    const host = (window.location.hostname || '').toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      return 'LOCALHOST (DEV)';
    }
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
      return `LOCAL WI-FI (${host})`;
    }

    const COLO_CITIES = {
      BOM: 'MUMBAI',
      KTM: 'KATHMANDU',
      CCU: 'KOLKATA',
      DEL: 'NEW DELHI',
      HYD: 'HYDERABAD',
      BLR: 'BENGALURU',
      MAA: 'CHENNAI',
      SIN: 'SINGAPORE',
      DXB: 'DUBAI',
      LHR: 'LONDON',
      FRA: 'FRANKFURT',
      IAD: 'VIRGINIA (US)',
      ORD: 'CHICAGO (US)',
      SJC: 'SAN JOSE (US)',
      LAX: 'LOS ANGELES',
      NRT: 'TOKYO',
      HKG: 'HONG KONG',
      BKK: 'BANGKOK'
    };

    // 1. Direct Cloudflare Edge Trace (Reads nearest Point of Presence airport code)
    if (host.includes('trycloudflare.com') || host.includes('cloudflare')) {
      try {
        const res = await fetch('/cdn-cgi/trace');
        if (res.ok) {
          const text = await res.text();
          const matchColo = text.match(/colo=([A-Z]{3})/i);
          const matchLoc = text.match(/loc=([A-Z]{2})/i);
          if (matchColo && matchColo[1]) {
            const colo = matchColo[1].toUpperCase();
            const city = COLO_CITIES[colo] || colo;
            const country = matchLoc && matchLoc[1] ? `, ${matchLoc[1].toUpperCase()}` : '';
            return `CLOUDFLARE (${city}${country})`;
          }
        }
      } catch (e) {}
      return 'CLOUDFLARE (MUMBAI/ASIA)';
    }

    // 2. Server-Side Geo API Fallback
    try {
      const res = await fetch('/api/server-info');
      if (res.ok) {
        const data = await res.json();
        if (data.colo && COLO_CITIES[data.colo.toUpperCase()]) {
          return `CLOUDFLARE (${COLO_CITIES[data.colo.toUpperCase()]})`;
        }
      }
    } catch (e) {}

    if (host.includes('onrender.com') || host.includes('render')) {
      return 'RENDER CLOUD (FRANKFURT/US)';
    }
    if (host.includes('loca.lt') || host.includes('localtunnel')) {
      return 'LOCALTUNNEL (US RELAY)';
    }
    return host.toUpperCase();
  }

  async updateServerStatusUI(wsUrl) {
    if (this.serverAddressTextEl) {
      const locationText = await this.detectServerLocation();
      this.serverAddressTextEl.textContent = `${locationText} • ONLINE`;
      this.serverAddressTextEl.title = `WebSocket: ${wsUrl}`;
    }
  }

  initWebSocket() {
    const wsUrl = this.getAutoServerUrl();

    if (this.serverAddressTextEl) {
      this.serverAddressTextEl.textContent = 'CONNECTING...';
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('⚡ Connected to Game Server:', wsUrl);
        if (this.serverStatusDotEl) this.serverStatusDotEl.className = 'status-indicator-dot online';
        this.updateServerStatusUI(wsUrl);

        this.send('SET_NICKNAME', { nickname: this.nicknameInput.value });

        // High-Precision Sub-Millisecond Heartbeat Ping (Every 1.2 seconds)
        this.currentPing = 0;
        this.lastPingSentAt = performance.now();
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.send('PING', { t: this.lastPingSentAt });

        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.lastPingSentAt = performance.now();
            this.send('PING', { t: this.lastPingSentAt });
          }
        }, 1200);
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
        if (this.serverStatusDotEl) this.serverStatusDotEl.className = 'status-indicator-dot';
        if (this.serverAddressTextEl) this.serverAddressTextEl.textContent = 'RECONNECTING...';
        if (this.pingInterval) clearInterval(this.pingInterval);
        setTimeout(() => this.initWebSocket(), 2000);
      };
    } catch (e) {
      console.error('WebSocket init error', e);
      if (this.serverStatusDotEl) this.serverStatusDotEl.className = 'status-indicator-dot';
      if (this.serverAddressTextEl) this.serverAddressTextEl.textContent = 'OFFLINE (CHECK SERVER)';
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
        if (this.lastPingSentAt) {
          const rawRtt = Math.max(1, Math.round(performance.now() - this.lastPingSentAt));
          // Exponential Moving Average (EMA) smoothing to eliminate false spikes and give stable network ping
          this.currentPing = this.currentPing === 0 ? rawRtt : Math.round(this.currentPing * 0.75 + rawRtt * 0.25);

          if (this.pingValEl) this.pingValEl.textContent = `${this.currentPing} ms`;
          const dot = this.hudPingDisplay?.querySelector('.ping-dot');
          if (dot) {
            dot.className = 'ping-dot' + (this.currentPing > 220 ? ' high' : this.currentPing > 120 ? ' medium' : '');
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

  // ──────────────── LOBBY & GAME HUB MANAGEMENT ────────────────
  setupEventListeners() {
    // 1. QUICK PLAY SWARM SURVIVAL
    const btnQuickPlay = document.getElementById('btn-quick-play-swarm');
    if (btnQuickPlay) {
      btnQuickPlay.addEventListener('click', () => {
        this.playMenuClick();
        this.startQuickPlaySwarm();
      });
    }

    // 2. MULTIPLAYER HUB MODAL
    const btnOpenMpHub = document.getElementById('btn-open-multiplayer-hub');
    const btnCloseMpHub = document.getElementById('btn-close-mp-hub');
    if (btnOpenMpHub && this.modalMpHub) {
      btnOpenMpHub.addEventListener('click', () => {
        this.playMenuClick();
        this.modalMpHub.classList.remove('hidden');
      });
    }
    if (btnCloseMpHub && this.modalMpHub) {
      btnCloseMpHub.addEventListener('click', () => {
        this.playMenuClick();
        this.modalMpHub.classList.add('hidden');
      });
    }

    // 3. ARMORY & LOADOUT MODAL
    const openArmory = () => {
      this.playMenuClick();
      if (this.modalArmory) this.modalArmory.classList.remove('hidden');
    };
    const dockArmory = document.getElementById('dock-btn-armory');
    const quickArmory = document.getElementById('btn-quick-armory');
    const closeArmory = document.getElementById('btn-close-armory');
    if (dockArmory) dockArmory.addEventListener('click', openArmory);
    if (quickArmory) quickArmory.addEventListener('click', openArmory);
    if (closeArmory && this.modalArmory) {
      closeArmory.addEventListener('click', () => {
        this.playMenuClick();
        this.modalArmory.classList.add('hidden');
      });
    }

    // 4. CONTROLS GUIDE MODAL
    const openControls = () => {
      this.playMenuClick();
      if (this.modalControls) this.modalControls.classList.remove('hidden');
    };
    const dockGuide = document.getElementById('dock-btn-guide');
    const closeControls = document.getElementById('btn-close-controls');
    if (dockGuide) dockGuide.addEventListener('click', openControls);
    if (closeControls && this.modalControls) {
      closeControls.addEventListener('click', () => {
        this.playMenuClick();
        this.modalControls.classList.add('hidden');
      });
    }

    // 5. AUDIO SFX TOGGLE
    const btnSfx = document.getElementById('btn-toggle-sfx');
    const sfxIcon = document.getElementById('sfx-icon');
    if (btnSfx) {
      btnSfx.addEventListener('click', () => {
        this.sfxEnabled = !this.sfxEnabled;
        if (sfxIcon) sfxIcon.textContent = this.sfxEnabled ? '🔊' : '🔇';
        btnSfx.classList.toggle('active', this.sfxEnabled);
        if (this.sfxEnabled) this.playMenuClick();
      });
    }

    // 6. SOLDIER COLOR PALETTE SWATCHES
    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playMenuClick();
        document.querySelectorAll('.color-swatch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.soldierColor = btn.dataset.color || '#FF3366';
        this.localPlayer.color = this.soldierColor;
        localStorage.setItem('wegether_armor_color', this.soldierColor);
        this.renderMenuSoldier();
      });
    });

    // 7. CALLSIGN LIVE EDITING
    if (this.nicknameInput) {
      this.nicknameInput.addEventListener('input', () => {
        const val = this.nicknameInput.value.trim() || 'Commander';
        this.myNickname = val;
        localStorage.setItem('wegether_callsign', val);
        if (this.displayCallsignEl) this.displayCallsignEl.textContent = val;
        this.renderMenuSoldier();
      });
    }

    // 8. DIRECT HOTSPOT & LAN JOIN
    const btnDirectHotspot = document.getElementById('btn-quick-hotspot-direct');
    if (btnDirectHotspot) {
      btnDirectHotspot.addEventListener('click', () => {
        this.playMenuClick();
        const targetHost = prompt('Enter Host Hotspot IP or port:', '192.168.43.1:3000');
        if (targetHost) {
          window.location.href = `http://${targetHost}`;
        }
      });
    }

    // 9. CREATE / JOIN CLOUD ROOMS
    const btnCreate = document.getElementById('btn-create-lobby');
    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        this.playMenuClick();
        if (this.modalMpHub) this.modalMpHub.classList.add('hidden');
        const nickname = this.nicknameInput.value.trim() || 'Commander';
        this.send('SET_NICKNAME', { nickname });
        this.send('CREATE_LOBBY', { mode: '2v2' });
      });
    }

    const btnJoin = document.getElementById('btn-join-lobby');
    if (btnJoin) {
      btnJoin.addEventListener('click', () => {
        this.playMenuClick();
        const code = this.joinCodeInput.value.trim().toUpperCase();
        if (code.length !== 5) {
          alert('Please enter a valid 5-digit room code!');
          return;
        }
        if (this.modalMpHub) this.modalMpHub.classList.add('hidden');
        const nickname = this.nicknameInput.value.trim() || 'Commander';
        this.send('SET_NICKNAME', { nickname });
        this.send('JOIN_LOBBY', { roomCode: code });
      });
    }

    // 10. HOTSPOT & LAN IN MODAL
    const btnHotspot = document.getElementById('btn-quick-hotspot-join');
    if (btnHotspot) {
      btnHotspot.addEventListener('click', () => {
        this.playMenuClick();
        const targetHost = prompt('Enter Host Hotspot IP or port:', '192.168.43.1:3000');
        if (targetHost) {
          window.location.href = `http://${targetHost}`;
        }
      });
    }

    const btnLanAuto = document.getElementById('btn-join-lan-auto');
    if (btnLanAuto) {
      btnLanAuto.addEventListener('click', () => {
        this.playMenuClick();
        const lanIp = prompt('Enter Host PC / Phone Wi-Fi IP (e.g. 192.168.1.5:3000):', '192.168.1.100:3000');
        if (lanIp) {
          window.location.href = `http://${lanIp}`;
        }
      });
    }

    document.getElementById('btn-copy-code').addEventListener('click', () => {
      this.playMenuClick();
      if (this.currentRoom) {
        navigator.clipboard.writeText(this.currentRoom.code).catch(() => {});
        this.showToast(
          `ROOM CODE COPIED: ${this.currentRoom.code}`,
          'Send this 5-digit code to your friends to join the match! 🚀',
          '📋'
        );
      }
    });

    document.getElementById('btn-join-red').addEventListener('click', () => {
      this.playMenuClick();
      this.send('SET_TEAM', { team: 'RED' });
    });
    document.getElementById('btn-join-blue').addEventListener('click', () => {
      this.playMenuClick();
      this.send('SET_TEAM', { team: 'BLUE' });
    });

    document.getElementById('btn-toggle-ready').addEventListener('click', () => {
      this.playMenuClick();
      this.send('TOGGLE_READY');
    });

    this.btnStartMatch.addEventListener('click', () => {
      this.playMenuClick();
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
      this.playMenuClick();
      window.location.reload();
    });

    document.querySelectorAll('.mode-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playMenuClick();
        if (!this.isHost) return;
        const mode = btn.dataset.mode;
        document.querySelectorAll('.mode-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.send('UPDATE_SETTINGS', { mode });
      });
    });

    // 11. SETTINGS MODAL & PREFERENCES
    const openSettings = () => {
      this.playMenuClick();
      if (this.modalSettings) this.modalSettings.classList.remove('hidden');
    };
    const closeSettings = document.getElementById('btn-close-settings');
    const dockSettings = document.getElementById('dock-btn-settings');
    const btnOpenSettings = document.getElementById('btn-open-settings');
    if (dockSettings) dockSettings.addEventListener('click', openSettings);
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettings);
    if (closeSettings && this.modalSettings) {
      closeSettings.addEventListener('click', () => {
        this.playMenuClick();
        this.modalSettings.classList.add('hidden');
      });
    }

    const sfxSlider = document.getElementById('setting-sfx-vol');
    if (sfxSlider) {
      sfxSlider.value = Math.round(this.sfxVolume * 100);
      sfxSlider.addEventListener('input', (e) => {
        this.sfxVolume = parseFloat(e.target.value) / 100;
        localStorage.setItem('wegether_sfx_vol', this.sfxVolume);
      });
    }

    document.querySelectorAll('.btn-setting-option').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playMenuClick();
        document.querySelectorAll('.btn-setting-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyJoystickSize(btn.dataset.size);
      });
    });

    const btnHaptics = document.getElementById('btn-toggle-haptics');
    if (btnHaptics) {
      btnHaptics.classList.toggle('active', this.hapticsEnabled);
      btnHaptics.textContent = this.hapticsEnabled ? 'ENABLED ✅' : 'DISABLED ❌';
      btnHaptics.addEventListener('click', () => {
        this.hapticsEnabled = !this.hapticsEnabled;
        localStorage.setItem('wegether_haptics', this.hapticsEnabled);
        btnHaptics.classList.toggle('active', this.hapticsEnabled);
        btnHaptics.textContent = this.hapticsEnabled ? 'ENABLED ✅' : 'DISABLED ❌';
        this.playMenuClick();
      });
    }

    const btnClearStorage = document.getElementById('btn-clear-storage');
    if (btnClearStorage) {
      btnClearStorage.addEventListener('click', () => {
        if (confirm('Reset high score and records?')) {
          localStorage.removeItem('wegether_highscore');
          localStorage.removeItem('wegether_highest_wave');
          this.swarmState.highScore = 0;
          this.swarmState.highestWave = 1;
          this.updateHighScoreUI();
          this.showToast('RECORDS RESET', 'Local combat history has been wiped.', '🧹');
        }
      });
    }

    // 12. TACTICAL PAUSE & DEBRIEF MODALS
    const openPauseMenu = () => {
      this.playMenuClick();
      if (this.modalPause) this.modalPause.classList.remove('hidden');
    };
    const closePauseMenu = () => {
      this.playMenuClick();
      if (this.modalPause) this.modalPause.classList.add('hidden');
    };

    const btnClosePause = document.getElementById('btn-close-pause');
    const btnResumePause = document.getElementById('btn-pause-resume');
    const btnRestartPause = document.getElementById('btn-pause-restart');
    const btnPauseSettings = document.getElementById('btn-pause-settings');
    const btnPauseExit = document.getElementById('btn-pause-exit');

    if (btnClosePause) btnClosePause.addEventListener('click', closePauseMenu);
    if (btnResumePause) btnResumePause.addEventListener('click', closePauseMenu);
    if (btnPauseSettings) btnPauseSettings.addEventListener('click', openSettings);
    if (btnRestartPause) {
      btnRestartPause.addEventListener('click', () => {
        closePauseMenu();
        this.startQuickPlaySwarm();
      });
    }
    if (btnPauseExit) {
      btnPauseExit.addEventListener('click', () => {
        closePauseMenu();
        if (this.swarmNextWaveTimer) clearTimeout(this.swarmNextWaveTimer);
        this.swarmNextWaveTimer = null;
        this.gameMode = 'MULTIPLAYER';
        this.swarmBots = [];
        this.groundGuns = [];
        this.aiCompanion = null;
        this.showScreen('menu');
        this.updateHighScoreUI();
        this.renderMenuSoldier();
      });
    }

    const btnDebriefRetry = document.getElementById('btn-debrief-retry');
    const btnDebriefMenu = document.getElementById('btn-debrief-menu');
    if (btnDebriefRetry && this.modalDebrief) {
      btnDebriefRetry.addEventListener('click', () => {
        this.playMenuClick();
        this.modalDebrief.classList.add('hidden');
        this.startQuickPlaySwarm();
      });
    }
    if (btnDebriefMenu && this.modalDebrief) {
      btnDebriefMenu.addEventListener('click', () => {
        this.playMenuClick();
        this.modalDebrief.classList.add('hidden');
        this.showScreen('menu');
        this.updateHighScoreUI();
        this.renderMenuSoldier();
      });
    }

    // Keyboard ESC Pause toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.screens.game && this.screens.game.classList.contains('active')) {
        if (this.modalPause && !this.modalPause.classList.contains('hidden')) {
          closePauseMenu();
        } else {
          openPauseMenu();
        }
      }
    });

    document.getElementById('btn-exit-game').addEventListener('click', () => {
      this.playMenuClick();
      openPauseMenu();
    });

    // Fullscreen Toggles
    const toggleFullscreen = () => {
      this.playMenuClick();
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
    const fsMenuBtn = document.getElementById('btn-fullscreen-menu');
    if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
    if (fsMenuBtn) fsMenuBtn.addEventListener('click', toggleFullscreen);

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

  getMaxZoomForWeapon(weapon) {
    if (weapon === 'sniper') return 3; // 4x Scope (0: 1x, 1: 2x, 2: 3x, 3: 4x)
    if (weapon === 'rpg') return 2;    // 3x Blast (0: 1x, 1: 2x, 2: 3x)
    return 0;                          // 1x ONLY for SMG, Shotgun, Pistol, etc.
  }

  cycleZoomLevel() {
    const maxIdx = this.getMaxZoomForWeapon(this.currentWeapon);
    if (maxIdx === 0) {
      this.zoomIndex = 0;
      this.applyZoom(true); // Locked at 1x for SMG/Shotgun
      return;
    }
    this.zoomIndex = (this.zoomIndex + 1) % (maxIdx + 1);
    this.applyZoom();
  }

  setZoomLevel(idx, silent = false) {
    const maxIdx = this.getMaxZoomForWeapon(this.currentWeapon);
    this.zoomIndex = Math.max(0, Math.min(maxIdx, idx));
    this.applyZoom(false, silent);
  }

  applyZoom(isLocked = false, silent = false) {
    const preset = this.zoomPresets[this.zoomIndex];
    this.targetZoom = preset.scale;
    if (this.zoomValTextEl) this.zoomValTextEl.textContent = preset.label;

    if (!silent) {
      if (isLocked) {
        this.addPickupNotification(`🔒 1x MAX ZOOM FOR ${this.currentWeapon.toUpperCase()}`, '#FF7B00');
      } else {
        this.addPickupNotification(`🔍 ZOOM: ${preset.label}`, '#00E5FF');
      }
    }
  }

  updateLobbyUI(lobby) {
    const isDuel = (lobby.mode === 'DUEL' || lobby.mode === 'FFA' || lobby.mode === '1v1');
    this.lobbyModeTagEl.textContent = isDuel ? '⚔️ DUEL (FFA / 1v1 / 1v1v1)' : '🛡️ 2v2 SQUAD TDM';

    this.hostSettingsBar.style.display = this.isHost ? 'flex' : 'none';
    this.btnStartMatch.style.display = this.isHost ? 'block' : 'none';

    document.querySelectorAll('.mode-select-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === lobby.mode);
    });

    const vsDivider = document.querySelector('.vs-divider');
    const blueCol = document.querySelector('.team-column.blue-team');
    const redColTitle = document.querySelector('.team-column.red-team .team-title');
    const btnJoinRed = document.getElementById('btn-join-red');
    const btnJoinBlue = document.getElementById('btn-join-blue');

    if (isDuel) {
      if (vsDivider) vsDivider.style.display = 'none';
      if (blueCol) blueCol.style.display = 'none';
      if (redColTitle) redColTitle.textContent = '⚔️ DUEL FIGHTERS';
      if (btnJoinRed) btnJoinRed.style.display = 'none';
      if (btnJoinBlue) btnJoinBlue.style.display = 'none';
    } else {
      if (vsDivider) vsDivider.style.display = 'flex';
      if (blueCol) blueCol.style.display = 'flex';
      if (redColTitle) redColTitle.textContent = '🔴 RED TEAM';
      if (btnJoinRed) btnJoinRed.style.display = 'block';
      if (btnJoinBlue) btnJoinBlue.style.display = 'block';
    }

    this.redPlayerListEl.innerHTML = '';
    this.bluePlayerListEl.innerHTML = '';

    const DUEL_BADGES = ['🔴', '🔵', '🟡', '🟢', '🟣', '🔷', '🟠', '🌸'];
    let redCount = 0;
    let blueCount = 0;

    lobby.players.forEach((player, idx) => {
      const isMe = player.id === this.myPlayerId;
      const card = document.createElement('div');
      card.className = `roster-card ${isMe ? 'is-me' : ''}`;

      const nameSpan = document.createElement('span');
      const badge = isDuel ? `${DUEL_BADGES[idx % DUEL_BADGES.length]} ` : '';
      nameSpan.textContent = `${badge}${player.nickname} ${isMe ? '(YOU)' : ''}`;

      const statusDiv = document.createElement('div');
      if (player.isHost) {
        const hostBadge = document.createElement('span');
        hostBadge.className = 'host-badge';
        hostBadge.textContent = 'HOST';
        statusDiv.appendChild(hostBadge);
      }
      const readySpan = document.createElement('span');
      readySpan.textContent = player.ready ? ' ✅' : ' ⏳';
      statusDiv.appendChild(readySpan);

      card.appendChild(nameSpan);
      card.appendChild(statusDiv);

      if (isDuel) {
        this.redPlayerListEl.appendChild(card);
        redCount++;
      } else {
        if (player.team === 'RED') {
          this.redPlayerListEl.appendChild(card);
          redCount++;
        } else {
          this.bluePlayerListEl.appendChild(card);
          blueCount++;
        }
      }
    });

    if (isDuel) {
      this.redCountEl.textContent = `${lobby.players.length}/8`;
    } else {
      this.redCountEl.textContent = `${redCount}/2`;
      this.blueCountEl.textContent = `${blueCount}/2`;
    }
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
    this.mouse = { x: 0, y: 0, isDown: false, active: false };
    this.touchJoyLeft = { active: false, vx: 0, vy: 0 };
    this.touchJoyRight = { active: false, vx: 0, vy: 0, isAiming: false, isFiring: false };
    this.lastAimAngle = 0;

    this.setupInputHandlers();
    this.buildNaturalMap();
    this.startDynamicGunSpawner();
    this.startRenderLoop();
  }

  resizeCanvas() {
    this.isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 900;
    const dpr = this.isMobile ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    if (this.ctx) this.ctx.imageSmoothingEnabled = true;
  }

  // ──────────────── CONTINUOUS RAYCAST CCD GEOMETRIC SOLVER (ZERO TUNNELING) ────────────────
  // Line Segment vs Line Segment Exact Intersection
  rayIntersectSegment(x0, y0, x1, y1, x2, y2, x3, y3) {
    const dx1 = x1 - x0, dy1 = y1 - y0;
    const dx2 = x3 - x2, dy2 = y3 - y2;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 0.00001) return null;

    const t = ((x2 - x0) * dy2 - (y2 - y0) * dx2) / denom;
    const u = ((x2 - x0) * dy1 - (y2 - y0) * dx1) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: x0 + t * dx1, y: y0 + t * dy1, t };
    }
    return null;
  }

  // Line Segment vs Circle Swept Intersection (Player Hitbox CCD)
  rayIntersectCircle(x0, y0, x1, y1, cx, cy, radius) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const fx = x0 - cx;
    const fy = y0 - cy;

    const a = dx * dx + dy * dy;
    if (a < 0.0001) {
      const dist = Math.hypot(x0 - cx, y0 - cy);
      return dist <= radius ? { x: x0, y: y0, t: 0 } : null;
    }

    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const sqrtD = Math.sqrt(discriminant);
    const t1 = (-b - sqrtD) / (2 * a);
    const t2 = (-b + sqrtD) / (2 * a);

    if (t1 >= 0 && t1 <= 1) {
      return { x: x0 + t1 * dx, y: y0 + t1 * dy, t: t1 };
    }
    if (t2 >= 0 && t2 <= 1) {
      return { x: x0 + t2 * dx, y: y0 + t2 * dy, t: t2 };
    }
    return null;
  }

  getGroundYAt(worldX) {
    const gy = this.groundY; // Base 1080
    // Flat Outpost Bunker Valley Floor
    if (worldX >= 1540 && worldX <= 2060) {
      return gy;
    }
    if (worldX < 1540) {
      // Left side rolling hills, mounds, and dips
      const hill1 = Math.sin((worldX / 300) * Math.PI) * 32;
      const hill2 = Math.sin((worldX / 130) * Math.PI) * 16;
      const taper = Math.min(1, Math.max(0, (1540 - worldX) / 140));
      return gy - (hill1 + hill2) * taper;
    } else {
      // Right side undulating ridges and slopes
      const hill1 = Math.sin(((worldX - 2060) / 340) * Math.PI) * 35;
      const hill2 = Math.sin(((worldX - 2060) / 150) * Math.PI) * 18;
      const taper = Math.min(1, Math.max(0, (worldX - 2060) / 140));
      return gy - (hill1 + hill2) * taper;
    }
  }

  getPlatformTopY(plat, worldX) {
    if (plat.type === 'GROUND') {
      return this.getGroundYAt(worldX);
    }
    const relX = worldX - plat.x;
    const progress = Math.max(0, Math.min(1, relX / plat.w));

    if (plat.shape === 'HILL') {
      return plat.y - Math.sin(progress * Math.PI) * (plat.curveHeight || 28);
    } else if (plat.shape === 'VALLEY') {
      return plat.y + Math.sin(progress * Math.PI) * (plat.curveHeight || 24);
    } else if (plat.shape === 'DOUBLE_HILL') {
      return plat.y - Math.sin(progress * Math.PI * 2) * (plat.curveHeight || 22);
    } else if (plat.shape === 'BOWL_ISLAND') {
      return plat.y - Math.sin(progress * Math.PI) * (plat.curveHeight || 18);
    }
    return plat.y;
  }

  getTopSurfaceY(worldX) {
    let highestY = this.getGroundYAt(worldX);
    for (const plat of this.platforms) {
      if (plat.type !== 'GROUND' && worldX >= plat.x && worldX <= plat.x + plat.w) {
        const topY = this.getPlatformTopY(plat, worldX);
        if (topY < highestY) {
          highestY = topY;
        }
      }
    }
    return highestY;
  }

  buildNaturalMap() {
    const gy = this.groundY;

    this.platforms = [
      { x: 0, y: gy, w: this.worldWidth, h: 160, type: 'GROUND' },

      // Left Organic Rock Islands (Bowl islands, mounds, cave arches)
      { x: 260, y: 840, w: 320, h: 95, type: 'ROCK', shape: 'BOWL_ISLAND', curveHeight: 26, hasPalm: true },
      { x: 480, y: 640, w: 260, h: 85, type: 'ROCK', shape: 'HILL', curveHeight: 32 },
      { x: 860, y: 760, w: 360, h: 100, type: 'ROCK', shape: 'DOUBLE_HILL', curveHeight: 28, hasPalm: true },
      { x: 1100, y: 520, w: 280, h: 85, type: 'ROCK', shape: 'BOWL_ISLAND', curveHeight: 22 },

      // Central 3D Textured Wooden Outpost (Vault for Legendary Rocket Launcher)
      { x: 1580, y: 840, w: 440, h: 42, type: 'HOUSE_ROOF' },
      { x: 1580, y: 882, w: 40, h: 84, type: 'HOUSE_WALL' },
      { x: 1980, y: 882, w: 40, h: 84, type: 'HOUSE_WALL' },

      // Right Organic Rock Islands (High vantage sniper points, rolling dunes)
      { x: 2180, y: 820, w: 300, h: 85, type: 'ROCK', shape: 'HILL', curveHeight: 28 },
      { x: 2480, y: 620, w: 340, h: 90, type: 'ROCK', shape: 'BOWL_ISLAND', curveHeight: 26, hasPalm: true },
      { x: 2860, y: 740, w: 360, h: 95, type: 'ROCK', shape: 'DOUBLE_HILL', curveHeight: 28 },
      { x: 3080, y: 500, w: 280, h: 85, type: 'ROCK', shape: 'HILL', curveHeight: 25, hasPalm: true }
    ];

    this.tacticalPickups = [
      { id: 'pk_g1', type: 'GRENADE', x: 490, y: this.getTopSurfaceY(490) - 24, label: '💣 FRAG GRENADES', available: true },
      { id: 'pk_m1', type: 'MINE', x: 1160, y: this.getTopSurfaceY(1160) - 24, label: '⚡ PROXIMITY MINE', available: true },
      { id: 'pk_s1', type: 'TOXIC_GAS', x: 2540, y: this.getTopSurfaceY(2540) - 24, label: '☣️ TOXIC MUSTARD GAS', available: true },
      { id: 'pk_hp1', type: 'MEDKIT', x: 2980, y: this.getTopSurfaceY(2980) - 24, label: '❤️ MEDICAL CASE', available: true }
    ];

    this.groundGuns = [
      {
        id: 'central_legendary',
        type: 'rpg',
        name: 'BAZOOKA',
        rarity: 'LEGENDARY',
        x: 1800,
        y: 1045,
        available: true
      }
    ];

    // Natural Hand-Drawn Palm Trees (Firmly Rooted on Top Surfaces of High Peaks & Ground Mounds)
    this.sceneryTrees = [
      { x: 180, height: 115, scale: 1.0, lean: -0.06, hasBoulders: true },
      { x: 600, height: 125, scale: 1.05, lean: 0.05, hasBoulders: true },
      { x: 1220, height: 130, scale: 1.1, lean: -0.05, hasBoulders: true },
      { x: 1420, height: 110, scale: 0.95, lean: 0.07, hasBoulders: true },
      { x: 2120, height: 110, scale: 0.95, lean: -0.07, hasBoulders: true },
      { x: 2640, height: 125, scale: 1.05, lean: 0.06, hasBoulders: true },
      { x: 3200, height: 135, scale: 1.12, lean: -0.05, hasBoulders: true }
    ];

    // Random Faceted Alpine Stone & Boulder Clusters Across the Ground & Rolling Hills
    this.surfaceBoulders = [
      { x: 120, count: 2, scale: 0.95 },
      { x: 340, count: 3, scale: 1.15 },
      { x: 740, count: 2, scale: 0.9 },
      { x: 920, count: 3, scale: 1.05 },
      { x: 1260, count: 3, scale: 1.1 },
      { x: 1480, count: 2, scale: 0.9 },
      { x: 2140, count: 2, scale: 0.95 },
      { x: 2340, count: 3, scale: 1.2 },
      { x: 2720, count: 2, scale: 0.85 },
      { x: 2880, count: 3, scale: 1.2 },
      { x: 3340, count: 3, scale: 1.0 },
      { x: 3480, count: 2, scale: 0.9 }
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
      gunName = 'BAZOOKA';
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
      { x: 380 },
      { x: 520 },
      { x: 980 },
      { x: 1160 },
      { x: 2280 },
      { x: 2540 },
      { x: 2980 },
      { x: 3180 }
    ];

    const spot = spawnSpots[Math.floor(Math.random() * spawnSpots.length)];
    // Dynamically calculate surface height so gun hovers cleanly 24px above terrain grass
    const surfaceY = this.getTopSurfaceY(spot.x);
    const newGun = {
      id: `gun_${Date.now()}_${Math.random()}`,
      type: gunType,
      name: gunName,
      rarity,
      x: spot.x,
      y: surfaceY - 24,
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
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;

      // Left Shift / Shift Key: Toggle Zoom Level ONLY when key is released (prevents hold-repeat)
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.cycleZoomLevel();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
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
    const rightLabel = document.getElementById('joy-right-label');

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

            if (isRight) {
              const aimThreshold = 10;   // Moderate drag: Aim 360° only (laser sightline)
              const fireThreshold = 26;  // Extended drag: Auto-fire weapon

              if (dist >= aimThreshold) {
                joyObj.isAiming = true;
                if (dist >= fireThreshold) {
                  joyObj.isFiring = true;
                  thumb.classList.add('firing');
                  thumb.classList.remove('aiming-only');
                  if (rightLabel) rightLabel.textContent = '🔥 FIRING';
                } else {
                  joyObj.isFiring = false;
                  thumb.classList.add('aiming-only');
                  thumb.classList.remove('firing');
                  if (rightLabel) rightLabel.textContent = '🎯 AIMING';
                }
              } else {
                joyObj.isAiming = false;
                joyObj.isFiring = false;
                thumb.classList.remove('firing', 'aiming-only');
                if (rightLabel) rightLabel.textContent = 'AIM / DRAG TO FIRE';
              }
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
            if (isRight) {
              joyObj.isAiming = false;
              joyObj.isFiring = false;
              thumb.classList.remove('firing', 'aiming-only');
              if (rightLabel) rightLabel.textContent = 'AIM / DRAG TO FIRE';
            }
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
        rpg: 'BAZOOKA'
      };
      this.hudWeaponName.textContent = names[this.currentWeapon] || 'DUAL UZI';

      this.addPickupNotification(`+EQUIPPED ${this.nearbyGun.name}`, '#00E5FF');

      // Auto Adjust Zoom View for Weapon (Sniper: 4x wide, Bazooka: 3x wide, SMG/Shotgun: 1x)
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

  // ──────────────── SWARM SURVIVAL & AI COMPANION SYSTEM ────────────────
  startQuickPlaySwarm() {
    this.gameMode = 'SWARM_SURVIVAL';
    this.showScreen('game');
    this.buildNaturalMap();

    // Configure Swarm Survival HUD
    if (this.swarmHudOverlay) this.swarmHudOverlay.classList.remove('hidden');
    if (this.hudMultiplayerScore) this.hudMultiplayerScore.classList.add('hidden');

    const p = this.localPlayer;
    p.id = this.myPlayerId || 'P_LOCAL';
    p.hp = 100;
    p.isDead = false;
    p.x = 1600;
    p.y = 900;
    p.vx = 0;
    p.vy = 0;
    p.team = 'BLUE';
    p.color = '#00A2FF';
    p.inventory = { grenades: 3, mines: 2, toxic_gas: 2 };
    this.currentWeapon = 'uzi';
    this.activeThrowable = 'grenade';
    this.updateTacticalHUD();
    this.setZoomLevel(0);

    // Initialize Friendly AI Companion Drone ("Delta-1")
    this.aiCompanion = {
      id: 'COMPANION_DELTA1',
      name: 'DELTA-1 (AI CO-OP)',
      x: 1540,
      y: 860,
      vx: 0,
      vy: 0,
      hp: 250,
      maxHp: 250,
      aimAngle: 0,
      facingLeft: false,
      lastShootTime: 0,
      lastGrenadeTime: 0,
      shieldActive: true,
      hoverOffset: 0,
      isDead: false
    };

    // Reset Swarm State & Clear Timers
    if (this.swarmNextWaveTimer) clearTimeout(this.swarmNextWaveTimer);
    this.swarmNextWaveTimer = null;
    this.swarmState.wave = 1;
    this.swarmState.score = 0;
    this.swarmState.waveActive = true;
    this.swarmState.waveDelayTimer = 0;
    this.totalKills = 0;
    this.swarmBots = [];
    this.groundGuns = [];
    this.bullets = [];
    this.grenades = [];
    this.landmines = [];
    this.toxicClouds = [];
    this.floatingTexts = [];
    this.hitmarkerTimer = 0;

    if (this.modalDebrief) this.modalDebrief.classList.add('hidden');
    if (this.modalPause) this.modalPause.classList.add('hidden');
    if (this.lowHpVignette) this.lowHpVignette.classList.add('hidden');

    this.updateSwarmHUD();
    this.startSwarmWave(1);

    this.showToast('AI CO-OP SWARM SURVIVAL', 'Delta-1 AI Companion deployed! Defend against bot swarms.', '🤖');
  }

  updateSwarmHUD() {
    if (this.swarmWaveNumEl) this.swarmWaveNumEl.textContent = `WAVE ${this.swarmState.wave}`;
    if (this.swarmBotsAliveEl) this.swarmBotsAliveEl.textContent = `BOTS: ${this.swarmBots.length}`;
    if (this.swarmScoreValEl) this.swarmScoreValEl.textContent = `${this.swarmState.score.toLocaleString()} PTS`;
  }

  showWaveBanner(title, subtitle) {
    if (!this.swarmWaveBanner) return;
    if (this.waveBannerTitle) this.waveBannerTitle.textContent = title;
    if (this.waveBannerSubtitle) this.waveBannerSubtitle.textContent = subtitle;
    this.swarmWaveBanner.classList.remove('hidden');
    this.swarmWaveBanner.style.animation = 'none';
    void this.swarmWaveBanner.offsetWidth;
    this.swarmWaveBanner.style.animation = 'bannerFade 3.5s forwards ease-in-out';
    setTimeout(() => {
      if (this.swarmWaveBanner) this.swarmWaveBanner.classList.add('hidden');
    }, 3600);
  }

  startSwarmWave(waveNum) {
    this.swarmState.wave = waveNum;
    this.swarmState.waveActive = true;
    this.swarmState.waveDelayTimer = 0;

    const botCount = 4 + waveNum * 2;
    this.showWaveBanner(`WAVE ${waveNum}`, `SWARM INCOMING • ${botCount} HOSTILE BOTS DETECTED`);

    this.swarmBots = [];
    for (let i = 0; i < botCount; i++) {
      const spawnLeft = Math.random() < 0.5;
      const x = spawnLeft ? 150 + Math.random() * 600 : 2800 + Math.random() * 600;
      const y = 250 + Math.random() * 500;

      // Dynamic bot class selection based on wave progression
      let type = 'CYBER_DRONE';
      if (i % 3 === 0) {
        type = 'INSECTOID_WALKER';
      } else if (i % 4 === 0 && waveNum >= 2) {
        type = 'PHANTOM_SLICER';
      } else if (i === botCount - 1 && waveNum >= 3) {
        type = 'GOLIATH_MECH';
      }

      let hp = 65 + waveNum * 15;
      let speed = 2.6 + Math.min(2.5, waveNum * 0.18);

      if (type === 'GOLIATH_MECH') {
        hp = 250 + waveNum * 50;
        speed = 1.8 + Math.min(1.5, waveNum * 0.1);
      } else if (type === 'PHANTOM_SLICER') {
        hp = 40 + waveNum * 10;
        speed = 4.2 + Math.min(3.0, waveNum * 0.22);
      } else if (type === 'INSECTOID_WALKER') {
        hp = 55 + waveNum * 12;
        speed = 3.6 + Math.min(2.5, waveNum * 0.2);
      }

      this.swarmBots.push({
        id: `bot_${waveNum}_${i}_${Date.now()}`,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        speed,
        aimAngle: 0,
        facingLeft: false,
        shootCooldown: Math.floor(Math.random() * 50),
        meleeCooldown: 0,
        jumpCooldown: 0,
        animFrame: Math.random() * 100,
        hoverSeed: Math.random() * 1000,
        isPouncing: false,
        isDead: false
      });
    }

    this.updateSwarmHUD();
  }

  startInGameMatch(matchData) {
    this.gameMode = 'MULTIPLAYER';
    this.swarmBots = [];
    this.aiCompanion = null;

    if (this.swarmHudOverlay) this.swarmHudOverlay.classList.add('hidden');
    if (this.hudMultiplayerScore) this.hudMultiplayerScore.classList.remove('hidden');

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

    const isDuel = (matchData.mode === 'DUEL' || matchData.mode === 'FFA' || this.currentRoom?.mode === 'DUEL');
    const DUEL_COLORS = ['#FF3366', '#00A2FF', '#FFD600', '#00E676', '#D500F9', '#00E5FF', '#FF7B00', '#FF4081'];

    const playerIdx = matchData.players?.findIndex(p => p.id === this.myPlayerId) ?? 0;
    const meInRoom = this.currentRoom?.players.find(p => p.id === this.myPlayerId);

    this.localPlayer.team = isDuel ? 'FFA' : (meInRoom?.team || 'RED');
    this.localPlayer.color = isDuel ? DUEL_COLORS[Math.max(0, playerIdx) % DUEL_COLORS.length] : (this.localPlayer.team === 'BLUE' ? '#00A2FF' : '#FF3366');

    // Register distinct colors for all remote fighters in DUEL mode
    if (matchData.players) {
      matchData.players.forEach((p, idx) => {
        if (p.id !== this.myPlayerId) {
          const rp = this.remotePlayers.get(p.id) || { id: p.id };
          rp.color = isDuel ? DUEL_COLORS[idx % DUEL_COLORS.length] : (p.team === 'BLUE' ? '#00A2FF' : '#FF3366');
          rp.team = isDuel ? 'FFA' : p.team;
          rp.nickname = p.nickname;
          this.remotePlayers.set(p.id, rp);
        }
      });
    }

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
    const now = performance.now();
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
        walkCycle: 0,
        snapshots: [{ time: now, x: data.x, y: data.y, vx: data.vx || 0, vy: data.vy || 0, aim: data.aim || 0 }]
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

      if (!p.snapshots) p.snapshots = [];
      p.snapshots.push({ time: now, x: data.x, y: data.y, vx: data.vx || 0, vy: data.vy || 0, aim: data.aim || 0 });
      if (p.snapshots.length > 8) p.snapshots.shift();
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
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;
    this.keys = {}; // Clear stuck keypresses

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      this.particles.push({
        x: this.localPlayer.x,
        y: this.localPlayer.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#FF3366',
        alpha: 1.0,
        radius: 3 + Math.random() * 3
      });
    }

    this.send('PLAYER_KILLED', {
      victimId: this.myPlayerId,
      killerId,
      weapon
    });

    if (this.lowHpVignette) this.lowHpVignette.classList.add('hidden');

    if (this.gameMode === 'SWARM_SURVIVAL') {
      // Swarm Mode: Show Tactical Mission Debrief Modal
      if (this.modalDebrief) {
        const titleEl = document.getElementById('debrief-title');
        const subEl = document.getElementById('debrief-subtitle');
        const scoreEl = document.getElementById('debrief-score');
        const waveEl = document.getElementById('debrief-wave');
        const killsEl = document.getElementById('debrief-kills');
        const recEl = document.getElementById('debrief-record');

        if (titleEl) titleEl.textContent = 'MISSION DEBRIEF';
        if (subEl) subEl.textContent = `Operative fell in battle defending against bot swarms.`;
        if (scoreEl) scoreEl.textContent = `${this.swarmState.score.toLocaleString()} PTS`;
        if (waveEl) waveEl.textContent = `WAVE ${this.swarmState.wave}`;
        if (killsEl) killsEl.textContent = `${this.totalKills || 0}`;
        if (recEl) recEl.textContent = `${this.swarmState.highScore.toLocaleString()} PTS`;

        setTimeout(() => {
          if (this.localPlayer.isDead && this.gameMode === 'SWARM_SURVIVAL') {
            this.modalDebrief.classList.remove('hidden');
          }
        }, 1100);
      }
    } else {
      // Multiplayer Mode: 3-Second Respawn Cycle
      if (this.deathCountdown) clearInterval(this.deathCountdown);
      this.respawnTimer = 3;
      this.deathCountdown = setInterval(() => {
        this.respawnTimer--;
        if (this.respawnTimer <= 0) {
          clearInterval(this.deathCountdown);
          this.deathCountdown = null;
          this.respawnLocalPlayer();
        }
      }, 1000);
    }
  }

  respawnLocalPlayer() {
    this.localPlayer.hp = 100;
    this.localPlayer.isDead = false;
    this.localPlayer.x = 600 + Math.random() * 1400;
    const gY = this.getGroundYAt(this.localPlayer.x);
    this.localPlayer.y = Math.max(300, gY - 180);
    this.localPlayer.vx = 0;
    this.localPlayer.vy = 0;
    this.localPlayer.inventory = { grenades: 2, mines: 1, toxic_gas: 1 };
    this.currentWeapon = 'uzi';
    this.hudWeaponName.textContent = 'DUAL SMG UZI';
    this.setZoomLevel(0, true);
    this.updateTacticalHUD();

    // Re-center camera smoothly on respawn
    this.camera.x = this.localPlayer.x;
    this.camera.y = this.localPlayer.y;

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
      shotgun: 680, // Decreased firerate (deliberate heavy tactical pump action)
      sniper: 650,
      rpg: 1400 // Reduced Bazooka attack speed (heavy 1.4s explosive reload)
    };

    const loop = () => {
      try {
        if (this.screens.game.classList.contains('active')) {
          this.updatePhysics();
          this.updateCamera();

          const now = performance.now();
          const shouldShoot = this.mouse.isDown || this.touchJoyRight.isFiring;
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
      } catch (err) {
        console.error('Frame render tick error:', err);
      } finally {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  updateCamera() {
    if (!isFinite(this.localPlayer.x)) this.localPlayer.x = 700;
    if (!isFinite(this.localPlayer.y)) this.localPlayer.y = 900;
    if (!isFinite(this.camera.x)) this.camera.x = this.localPlayer.x;
    if (!isFinite(this.camera.y)) this.camera.y = this.localPlayer.y;
    if (!isFinite(this.targetZoom)) this.targetZoom = 1.0;
    if (!isFinite(this.currentZoom) || this.currentZoom <= 0) this.currentZoom = 1.0;

    // Ultra-smooth exponential zoom smoothing (zero jitter)
    this.currentZoom += (this.targetZoom - this.currentZoom) * 0.06;
    this.currentZoom = Math.max(0.5, Math.min(2.0, this.currentZoom));

    // Smooth position interpolation directly tracking player center
    this.camera.x += (this.localPlayer.x - this.camera.x) * 0.08;
    this.camera.y += (this.localPlayer.y - this.camera.y) * 0.08;

    const halfVisW = (this.canvas.width / 2) / this.currentZoom;
    const halfVisH = (this.canvas.height / 2) / this.currentZoom;

    // Soft horizontal clamping
    if (this.worldWidth > halfVisW * 2) {
      this.camera.x = Math.max(halfVisW, Math.min(this.worldWidth - halfVisW, this.camera.x));
    } else {
      this.camera.x = this.worldWidth / 2;
    }

    // Soft vertical clamping: allows smooth aerial flight and ground centering with zero snapping jitter
    const maxCamY = this.worldHeight + 200 - halfVisH;
    const minCamY = halfVisH;
    if (maxCamY > minCamY) {
      this.camera.y = Math.max(minCamY, Math.min(maxCamY, this.camera.y));
    }
  }

  updatePhysics() {
    const p = this.localPlayer;
    const soldierRadius = 22;

    // ──────────────── LOCAL PLAYER MOVEMENT SIMULATION (ONLY ACTIVE WHEN ALIVE) ────────────────
    if (!p.isDead && p.hp > 0) {
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

      // ──────────────── WORLD BOUNDARIES & ORGANIC TERRAIN LANDING ────────────────
      const curGroundY = this.getGroundYAt(p.x);

      if (p.x - soldierRadius < 10) { p.x = 10 + soldierRadius; p.vx = 0; }
      if (p.x + soldierRadius > this.worldWidth - 10) { p.x = this.worldWidth - 10 - soldierRadius; p.vx = 0; }
      if (p.y - soldierRadius < 15) { p.y = 15 + soldierRadius; p.vy = 0; }

      // Organic Ground Landing
      if (p.y + soldierRadius > curGroundY) {
        p.y = curGroundY - soldierRadius;
        p.vy = 0;
        p.isGrounded = true;
      } else {
        p.isGrounded = p.y + soldierRadius >= curGroundY - 3;
      }

      // ──────────────── 4-WAY SOLID OBSTACLE & PLATFORM COLLISION ────────────────
      for (const plat of this.platforms) {
        if (plat.type === 'GROUND') continue;

        const platLeft = plat.x;
        const platRight = plat.x + plat.w;

        // Calculate exact top and bottom bounds at current player X
        let topY, botY;
        if (plat.type === 'ROCK') {
          const progress = Math.max(0, Math.min(1, (p.x - plat.x) / plat.w));
          topY = this.getPlatformTopY(plat, p.x);
          botY = plat.y + plat.h + Math.sin(progress * Math.PI) * 35 + 6;
        } else {
          topY = plat.y;
          botY = plat.y + plat.h;
        }

        // Check if player is horizontally overlapping with obstacle
        if (p.x + soldierRadius > platLeft && p.x - soldierRadius < platRight) {
          // 1. Landing on Top Surface (from above)
          if (p.y + soldierRadius >= topY && p.y + soldierRadius <= topY + 28 && p.vy >= 0) {
            p.y = topY - soldierRadius;
            p.vy = 0;
            p.isGrounded = true;
          }
          // 2. Hitting Bottom Underside (from below - NO CLIPPING THROUGH FROM BELOW!)
          else if (p.y - soldierRadius <= botY && p.y - soldierRadius >= botY - 26 && p.vy < 0) {
            p.y = botY + soldierRadius;
            p.vy = Math.max(0, p.vy); // Stop upward thrust immediately
          }
          // 3. Trapped Inside Obstacle Core -> Resolve cleanly to nearest surface
          else if (p.y + soldierRadius > topY && p.y - soldierRadius < botY) {
            const distToTop = Math.abs((p.y + soldierRadius) - topY);
            const distToBot = Math.abs((p.y - soldierRadius) - botY);
            if (distToTop < distToBot) {
              p.y = topY - soldierRadius;
              p.vy = 0;
              p.isGrounded = true;
            } else {
              p.y = botY + soldierRadius;
              p.vy = Math.max(0, p.vy);
            }
          }
        }

        // Lateral (Left/Right) Wall Collision for Obstacles
        if (p.y + soldierRadius > topY + 6 && p.y - soldierRadius < botY - 6) {
          if (p.x + soldierRadius >= platLeft && p.x + soldierRadius <= platLeft + 16 && p.vx > 0) {
            p.x = platLeft - soldierRadius;
            p.vx = 0;
          } else if (p.x - soldierRadius <= platRight && p.x - soldierRadius >= platRight - 16 && p.vx < 0) {
            p.x = platRight + soldierRadius;
            p.vx = 0;
          }
        }
      }

      if (this.touchJoyRight.isAiming) {
        p.aimAngle = Math.atan2(this.touchJoyRight.vy, this.touchJoyRight.vx);
        this.lastAimAngle = p.aimAngle;
      } else if (this.mouse && this.mouse.active) {
        const worldMouseX = this.camera.x + (this.mouse.x - this.canvas.width / 2) / this.currentZoom;
        const worldMouseY = this.camera.y + (this.mouse.y - this.canvas.height / 2) / this.currentZoom;
        p.aimAngle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
        this.lastAimAngle = p.aimAngle;
      } else if (this.lastAimAngle !== undefined && isFinite(this.lastAimAngle)) {
        p.aimAngle = this.lastAimAngle;
      } else if (Math.abs(p.vx) > 0.4) {
        p.aimAngle = p.vx < 0 ? Math.PI : 0;
        this.lastAimAngle = p.aimAngle;
      }
    }

    // ──────────────── NETWORK LAG-COMPENSATED SNAPSHOT INTERPOLATION (ZERO DESYNC) ────────────────
    const renderNow = performance.now();
    const interpDelay = 45; // 45ms jitter buffer for smooth continuous 60fps interpolation
    const renderTime = renderNow - interpDelay;

    this.remotePlayers.forEach(rp => {
      if (!rp.isDead) {
        if (rp.snapshots && rp.snapshots.length >= 2) {
          let s0 = rp.snapshots[0];
          let s1 = rp.snapshots[rp.snapshots.length - 1];

          for (let j = 0; j < rp.snapshots.length - 1; j++) {
            if (rp.snapshots[j].time <= renderTime && rp.snapshots[j + 1].time >= renderTime) {
              s0 = rp.snapshots[j];
              s1 = rp.snapshots[j + 1];
              break;
            }
          }

          const timeSpan = s1.time - s0.time;
          const alpha = timeSpan > 0 ? Math.max(0, Math.min(1, (renderTime - s0.time) / timeSpan)) : 1;
          rp.x = (s0.x || 0) + ((s1.x || 0) - (s0.x || 0)) * alpha;
          rp.y = (s0.y || 0) + ((s1.y || 0) - (s0.y || 0)) * alpha;
          rp.vx = (s0.vx || 0) + ((s1.vx || 0) - (s0.vx || 0)) * alpha;
          rp.vy = (s0.vy || 0) + ((s1.vy || 0) - (s0.vy || 0)) * alpha;

          // Shortest angular difference interpolation to prevent rotation flipping (Zero while loops)
          let dAngle = (s1.aim || 0) - (s0.aim || 0);
          dAngle = Math.atan2(Math.sin(dAngle), Math.cos(dAngle));
          rp.aimAngle = (s0.aim || 0) + dAngle * alpha;
        } else {
          // Smooth forward dead-reckoning fallback
          rp.targetX += (rp.vx || 0) * 0.4;
          rp.targetY += (rp.vy || 0) * 0.4;
          rp.x += (rp.targetX - rp.x) * 0.28;
          rp.y += (rp.targetY - rp.y) * 0.28;
        }

        if (!isFinite(rp.x)) rp.x = 700;
        if (!isFinite(rp.y)) rp.y = 900;
        if (!isFinite(rp.aimAngle)) rp.aimAngle = 0;

        const rpGroundY = this.getGroundYAt(rp.x);
        rp.x = Math.max(soldierRadius + 10, Math.min(this.worldWidth - soldierRadius - 10, rp.x));
        rp.y = Math.max(soldierRadius + 15, Math.min(rpGroundY - soldierRadius, rp.y));
      }
    });

    // ──────────────── CONTINUOUS SWEPT-RAYCAST CCD BULLET TRACING (ZERO TUNNELING) ────────────────
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const x0 = b.x;
      const y0 = b.y;
      const x1 = b.x + b.vx;
      const y1 = b.y + b.vy;
      b.life++;

      let closestHit = null;
      let hitType = null;

      // 1. Swept Raycast against Ground Surface
      const midX = (x0 + x1) * 0.5;
      const gY = this.getGroundYAt(midX);
      if (y1 >= gY || y0 >= gY) {
        const hit = this.rayIntersectSegment(x0, y0, x1, y1, x0, this.getGroundYAt(x0), x1, this.getGroundYAt(x1));
        if (hit && (!closestHit || hit.t < closestHit.t)) {
          closestHit = hit;
          hitType = 'TERRAIN';
        } else if (y1 >= gY) {
          closestHit = { x: x1, y: gY, t: 1.0 };
          hitType = 'TERRAIN';
        }
      }

      // 2. Swept Raycast against Solid Platforms, Roofs & Walls
      for (const plat of this.platforms) {
        if (plat.type === 'GROUND') continue;
        const minX = Math.min(x0, x1) - 4;
        const maxX = Math.max(x0, x1) + 4;
        if (maxX >= plat.x && minX <= plat.x + plat.w) {
          const topY0 = this.getPlatformTopY(plat, Math.max(plat.x, Math.min(plat.x + plat.w, x0)));
          const topY1 = this.getPlatformTopY(plat, Math.max(plat.x, Math.min(plat.x + plat.w, x1)));
          const hitTop = this.rayIntersectSegment(x0, y0, x1, y1, plat.x, topY0, plat.x + plat.w, topY1);
          if (hitTop && (!closestHit || hitTop.t < closestHit.t)) {
            closestHit = hitTop;
            hitType = 'TERRAIN';
          }

          const botY = plat.y + plat.h + (plat.shape ? 40 : 0);
          if (y0 <= botY + 10 && y1 >= plat.y - 10 && x1 >= plat.x && x1 <= plat.x + plat.w) {
            if (!closestHit) {
              closestHit = { x: x1, y: y1, t: 1.0 };
              hitType = 'TERRAIN';
            }
          }
        }
      }

      // 3. Swept Raycast against Local Player Hitbox
      if (b.ownerId !== this.myPlayerId && b.ownerId !== 'COMPANION' && p.hp > 0 && !p.isDead) {
        const hitPlayer = this.rayIntersectCircle(x0, y0, x1, y1, p.x, p.y, soldierRadius + 3);
        if (hitPlayer && (!closestHit || hitPlayer.t < closestHit.t)) {
          closestHit = hitPlayer;
          hitType = 'PLAYER';
        }
      }

      // 3.5. Swept Raycast against Swarm Bots & AI Companion in Swarm Mode
      if (this.gameMode === 'SWARM_SURVIVAL') {
        // Player & Companion bullets hitting enemy swarm bots
        if (b.ownerId === this.myPlayerId || b.ownerId === 'COMPANION') {
          for (let j = this.swarmBots.length - 1; j >= 0; j--) {
            const bot = this.swarmBots[j];
            const hitBot = this.rayIntersectCircle(x0, y0, x1, y1, bot.x, bot.y, 22);
            if (hitBot && (!closestHit || hitBot.t < closestHit.t)) {
              closestHit = hitBot;
              hitType = 'SWARM_BOT';
              b.hitBotIndex = j;
            }
          }
        }
        // Enemy bot bullets hitting Friendly AI Companion
        else if (b.isBotBullet && this.aiCompanion && !this.aiCompanion.isDead) {
          const hitComp = this.rayIntersectCircle(x0, y0, x1, y1, this.aiCompanion.x, this.aiCompanion.y, 22);
          if (hitComp && (!closestHit || hitComp.t < closestHit.t)) {
            closestHit = hitComp;
            hitType = 'COMPANION';
          }
        }
      }

      // 4. Resolve Collision at Exact Continuous Impact Coordinates
      if (closestHit) {
        b.x = closestHit.x;
        b.y = closestHit.y;
        this.spawnImpactSparks(b.x, b.y, b.color);

        if (b.weapon === 'rpg') {
          this.createExplosion(b.x, b.y, 95, 95, b.ownerId);
        } else if (hitType === 'PLAYER') {
          let dmg;
          if (b.weapon === 'sniper') dmg = 70;
          else if (b.weapon === 'uzi') dmg = b.life < 28 ? 18 : 14;
          else if (b.weapon === 'shotgun') dmg = b.life < 8 ? 15 : 7;
          else dmg = b.damage || 14;

          p.hp = Math.max(0, p.hp - dmg);
          this.spawnImpactSparks(b.x, b.y, '#FF3366');

          if (p.hp <= 0) {
            this.triggerLocalDeath(b.ownerId, b.weapon);
          }
        } else if (hitType === 'SWARM_BOT' && b.hitBotIndex !== undefined && this.swarmBots[b.hitBotIndex]) {
          const targetBot = this.swarmBots[b.hitBotIndex];
          const dmg = b.weapon === 'sniper' ? 85 : b.weapon === 'rpg' ? 120 : b.weapon === 'shotgun' ? 24 : 18;
          targetBot.hp -= dmg;
          this.spawnImpactSparks(b.x, b.y, '#FFD600');

          // Trigger Tactical Hitmarker & Sound
          if (b.ownerId === this.myPlayerId) {
            this.hitmarkerTimer = 7;
            this.playHitmarkerSound();
            this.floatingTexts.push({
              x: targetBot.x + (Math.random() - 0.5) * 16,
              y: targetBot.y - 12,
              text: `-${dmg}`,
              color: dmg >= 80 ? '#FF1744' : '#FFD600',
              size: dmg >= 80 ? 17 : 13,
              alpha: 1.0,
              life: 28
            });
          }

          if (targetBot.hp <= 0) {
            targetBot.isDead = true;
            this.handleBotKill(targetBot);
          }
        } else if (hitType === 'COMPANION' && this.aiCompanion) {
          this.aiCompanion.hp = Math.max(0, this.aiCompanion.hp - (b.damage || 10));
          this.spawnImpactSparks(b.x, b.y, '#00E5FF');
          if (this.aiCompanion.hp <= 0) {
            this.aiCompanion.isDead = true;
            this.showToast('COMPANION OFFLINE', 'Delta-1 was destroyed! Rebooting next wave.', '⚠️');
          }
        }

        this.bullets.splice(i, 1);
        continue;
      }

      // Advance bullet to new position
      b.x = x1;
      b.y = y1;

      // Range Expiration (Bazooka / Sniper = 78, SMG = 55, Shotgun = 18)
      const maxLife = b.maxLife || (b.weapon === 'shotgun' ? 18 : b.weapon === 'uzi' ? 55 : 78);
      if (b.x < 0 || b.x > this.worldWidth || b.y < 0 || b.y > this.worldHeight + 200 || b.life > maxLife) {
        if (b.life > maxLife && (b.weapon === 'shotgun' || b.weapon === 'uzi')) {
          this.spawnImpactSparks(b.x, b.y, b.color);
        }
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

      const gGroundY = this.getGroundYAt(g.x);

      if (g.x < 15 || g.x > this.worldWidth - 15) {
        g.vx = -g.vx * 0.7;
        g.x = Math.max(15, Math.min(this.worldWidth - 15, g.x));
      }
      if (g.y >= gGroundY - 8) {
        g.y = gGroundY - 8;
        g.vy = -g.vy * 0.55;
        g.vx *= 0.75;
      }

      for (const plat of this.platforms) {
        if (plat.type !== 'GROUND' && g.x >= plat.x && g.x <= plat.x + plat.w) {
          const topY = this.getPlatformTopY(plat, g.x);
          const botY = plat.y + plat.h + (plat.shape ? 40 : 0);
          if (g.y >= topY - 6 && g.y <= botY) {
            g.y = topY - 6;
            g.vy = -g.vy * 0.5;
            g.vx *= 0.75;
            break;
          }
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

    // ──────────────── YELLOW TOXIC GAS (UNIFIED CONTINUOUS HP DRAIN) ────────────────
    this.toxicDamageTick++;
    let isInToxicGas = false;
    let toxicAttacker = 'TOXIC';

    for (let i = this.toxicClouds.length - 1; i >= 0; i--) {
      const s = this.toxicClouds[i];
      s.life--;

      // Spawn ambient toxic particles (Capped to prevent mobile GPU lag)
      if (Math.random() < 0.35 && this.particles.length < 100) {
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

      // Check if player is inside this toxic cloud
      if (p.hp > 0 && !p.isDead && Math.hypot(p.x - s.x, p.y - s.y) < s.radius + 15) {
        isInToxicGas = true;
        if (s.ownerId) toxicAttacker = s.ownerId;
      }

      if (s.life <= 0) this.toxicClouds.splice(i, 1);
    }

    // Apply unified toxic damage tick (prevents duplicate multi-tick from stacked clouds)
    if (isInToxicGas && p.hp > 0 && !p.isDead) {
      if (this.toxicDamageTick % 18 === 0) {
        const toxicDmg = 3;
        p.hp = Math.max(0, p.hp - toxicDmg);
        this.addPickupNotification('-3 HP (☣️ TOXIC GAS)', '#FFE500');

        if (p.hp <= 0) {
          this.triggerLocalDeath(toxicAttacker, 'TOXIC_GAS');
        }
      }
    }

    // Particles with Hard Limit (Max 120 elements to prevent mobile memory/lag spikes)
    if (this.particles.length > 120) {
      this.particles.splice(0, this.particles.length - 120);
    }

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

    // Ground Gun Physics, Platform Landing & Lifetime Decay (Prevents Memory Leaks)
    for (let i = this.groundGuns.length - 1; i >= 0; i--) {
      const gun = this.groundGuns[i];
      gun.lifetime = (gun.lifetime || 0) + 1;
      if (gun.lifetime > 2800 || !gun.available) {
        this.groundGuns.splice(i, 1);
        continue;
      }
      if (!gun.stuck) {
        gun.vy = (gun.vy || 0) + 0.35;
        gun.x += (gun.vx || 0);
        gun.y += gun.vy;
        gun.vx = (gun.vx || 0) * 0.96;

        const gy = this.getGroundYAt(gun.x);
        if (gun.y >= gy - 6) {
          gun.y = gy - 6;
          gun.vx = 0;
          gun.vy = 0;
          gun.stuck = true;
        } else {
          for (const plat of this.platforms) {
            if (gun.x >= plat.x && gun.x <= plat.x + plat.w) {
              const topY = this.getPlatformTopY(plat, gun.x);
              if (gun.y >= topY - 6 && gun.y <= topY + 16) {
                gun.y = topY - 6;
                gun.vx = 0;
                gun.vy = 0;
                gun.stuck = true;
                break;
              }
            }
          }
        }
      }
    }
    // Hard Limit Max 14 Dropped Guns
    if (this.groundGuns.length > 14) {
      this.groundGuns.splice(0, this.groundGuns.length - 14);
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

    // ──────────────── SWARM SURVIVAL PHYSICS DISPATCHER ────────────────
    this.updateSwarmPhysics();
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
      this.spawnImpactSparks(p.x, p.y, '#FF3366');

      if (p.hp <= 0) {
        this.triggerLocalDeath(attackerId, 'EXPLOSION');
      }
    }

    // Swarm Mode: Explosions damage all hostile bots in radius
    if (this.gameMode === 'SWARM_SURVIVAL' && this.swarmBots) {
      for (const bot of this.swarmBots) {
        if (bot.isDead) continue;
        const bDist = Math.hypot(bot.x - x, bot.y - y);
        if (bDist <= radius) {
          const dmg = Math.round(maxDamage * (1 - bDist / radius));
          bot.hp -= dmg;
          this.spawnImpactSparks(bot.x, bot.y, '#FFD600');
          if (bot.hp <= 0) {
            bot.isDead = true;
            this.handleBotKill(bot);
          }
        }
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

    // Trigger Sound Effect
    this.playShootSound(wep);

    // Haptic Vibration Feedback on Mobile Devices
    if (navigator.vibrate) {
      try { navigator.vibrate(wep === 'shotgun' || wep === 'rpg' ? 30 : 15); } catch (e) {}
    }

    if (wep === 'uzi') {
      const bullet = {
        x: Math.round(p.x + Math.cos(p.aimAngle) * 26),
        y: Math.round(p.y + Math.sin(p.aimAngle) * 26),
        vx: Math.round(Math.cos(p.aimAngle) * 19 * 10) / 10,
        vy: Math.round(Math.sin(p.aimAngle) * 19 * 10) / 10,
        weapon: 'uzi',
        ownerId: this.myPlayerId,
        color: '#00E5FF',
        life: 0,
        maxLife: 55
      };
      this.bullets.push(bullet);
      this.send('BULLET_FIRE', bullet);
    } else if (wep === 'shotgun') {
      const burst = [];
      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.42;
        const angle = p.aimAngle + spread;
        const speed = 13 + Math.random() * 3;
        const pellet = {
          x: Math.round(p.x + Math.cos(angle) * 26),
          y: Math.round(p.y + Math.sin(angle) * 26),
          vx: Math.round(Math.cos(angle) * speed * 10) / 10,
          vy: Math.round(Math.sin(angle) * speed * 10) / 10,
          weapon: 'shotgun',
          ownerId: this.myPlayerId,
          color: '#FF7B00',
          life: 0,
          maxLife: 18
        };
        this.bullets.push(pellet);
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

    // Reset matrix transform on every frame to prevent permanent canvas corruption / freeze
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const camX = isFinite(this.camera.x) ? this.camera.x : this.worldWidth / 2;
    const camY = isFinite(this.camera.y) ? this.camera.y : this.worldHeight / 2;
    const zoom = isFinite(this.currentZoom) && this.currentZoom > 0 ? this.currentZoom : 1.0;

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

    // ──────────────── WORLD SPACE (DYNAMIC 1x-4x ZOOM WITH VIEWPORT CULLING) ────────────────
    const halfVisW = (W / 2) / zoom + 120;
    const halfVisH = (H / 2) / zoom + 120;
    const visLeft = camX - halfVisW;
    const visRight = camX + halfVisW;
    const visTop = camY - halfVisH;
    const visBottom = camY + halfVisH;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.currentZoom, this.currentZoom);
    ctx.translate(-camX, -camY);

    // 2. Render Wooden Outpost Bunker Back-Wall & Interior First (Behind players)
    if (1580 + 440 >= visLeft && 1580 <= visRight) {
      this.drawWoodenOutpostBack(ctx, 1580, 840, 440, 240);
    }

    // 3. Render Rock Platforms & Ground Terrain (Viewport Culled)
    for (const plat of this.platforms) {
      if (plat.type === 'GROUND') {
        this.drawGroundTerrain(ctx, plat, visLeft, visRight);
      } else if (plat.type === 'ROCK') {
        if (plat.x + plat.w >= visLeft && plat.x <= visRight) {
          this.drawRockPlatform(ctx, plat);
        }
      }
    }

    // 4. Render Surface Boulders & Tall Palm Trees (Natural Scenery - Viewport Culled)
    this.drawWorldScenery(ctx, visLeft, visRight);

    // 5. Render Wooden Outpost Front Log Structure & Roof (3D Interlocking Timber Logs)
    if (1580 + 440 >= visLeft && 1580 <= visRight) {
      this.drawWoodenOutpostFront(ctx, 1580, 840, 440, 240);
    }

    // 5. Tactical Pickups (Viewport Culled)
    for (const pk of this.tacticalPickups) {
      if (pk.available && pk.x >= visLeft - 50 && pk.x <= visRight + 50) {
        this.drawTacticalPickup(ctx, pk);
      }
    }

    // 6. Dropped Guns (Viewport Culled)
    for (const gun of this.groundGuns) {
      if (gun.available && gun.x >= visLeft - 60 && gun.x <= visRight + 60) {
        this.drawGroundGun(ctx, gun);
      }
    }

    // 5. Yellow Toxic Gas Clouds
    for (const s of this.toxicClouds) {
      if (s.x + s.radius < visLeft || s.x - s.radius > visRight) continue;
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
      if (m.x < visLeft - 30 || m.x > visRight + 30) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = m.armed ? '#FF3366' : '#FFD600';
      this.setGlow(ctx, m.armed ? '#FF3366' : '#FFD600', 10);
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
      if (g.x < visLeft - 30 || g.x > visRight + 30) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = '#00E676';
      this.setGlow(ctx, '#00E676', 8);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. Particles (Max visible)
    for (const pt of this.particles) {
      if (pt.x < visLeft - 20 || pt.x > visRight + 20) continue;
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
      if (b.x < visLeft - 50 || b.x > visRight + 50) continue;
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
        this.setGlow(ctx, b.color, 8);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 10. Remote Soldiers (Multiplayer Mode)
    this.remotePlayers.forEach(rp => {
      if (!rp.isDead && rp.hp > 0 && rp.x >= visLeft - 60 && rp.x <= visRight + 60) {
        this.drawArticulatedSoldier(ctx, rp, false, rp.walkCycle || 0, 0);
      }
    });

    // 10.5. Friendly AI Companion Drone ("Delta-1 Prime") in Swarm Survival Mode
    if (this.gameMode === 'SWARM_SURVIVAL' && this.aiCompanion && !this.aiCompanion.isDead) {
      if (this.aiCompanion.x >= visLeft - 70 && this.aiCompanion.x <= visRight + 70) {
        this.drawAICompanionPrime(ctx, this.aiCompanion);
      }
    }

    // 10.6. Hostile Bot Swarm Army (Apex Cyber Drones, Crimson Arachnids, Phantom Slicers & Goliath Mechs)
    if (this.gameMode === 'SWARM_SURVIVAL' && this.swarmBots) {
      for (const bot of this.swarmBots) {
        if (!bot.isDead && bot.x >= visLeft - 70 && bot.x <= visRight + 70) {
          if (bot.type === 'CYBER_DRONE') {
            this.drawApexCyberDrone(ctx, bot, false);
          } else if (bot.type === 'INSECTOID_WALKER') {
            this.drawCrimsonArachnid(ctx, bot);
          } else if (bot.type === 'PHANTOM_SLICER') {
            this.drawPhantomSlicer(ctx, bot);
          } else if (bot.type === 'HEAVY_BOT' || bot.type === 'GOLIATH_MECH') {
            this.drawGoliathMech(ctx, bot);
          }
        }
      }
    }

    // 11. Local Soldier
    if (!this.localPlayer.isDead && this.localPlayer.hp > 0) {
      this.drawArticulatedSoldier(ctx, this.localPlayer, true, this.walkCycle, this.recoilOffset);
    } else if (this.localPlayer.isDead) {
      ctx.save();
      ctx.font = 'bold 16px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#FF3366';
      this.setGlow(ctx, '#FF3366', 10);
      ctx.textAlign = 'center';
      const statusText = this.gameMode === 'SWARM_SURVIVAL' ? `💀 FALLEN IN SWARM SURVIVAL • TAP QUICK PLAY TO RESTART` : `💀 ELIMINATED • RESPAWNING IN ${Math.max(1, this.respawnTimer)}s...`;
      ctx.fillText(statusText, this.localPlayer.x, this.localPlayer.y - 20);
      ctx.restore();
    }

    // 12. Floating Notifications
    for (const notif of this.pickupNotifications) {
      ctx.save();
      ctx.globalAlpha = notif.alpha;
      ctx.font = 'bold 12px "Chakra Petch", sans-serif';
      ctx.fillStyle = notif.color;
      this.setGlow(ctx, notif.color, 8);
      ctx.textAlign = 'center';
      ctx.fillText(notif.text, notif.x, notif.y);
      ctx.restore();
    }

    // 13. Floating Combat Damage Numbers
    for (let idx = this.floatingTexts.length - 1; idx >= 0; idx--) {
      const ft = this.floatingTexts[idx];
      ft.y -= 0.85;
      ft.life--;
      ft.alpha = Math.max(0, ft.life / 28);

      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `900 ${ft.size || 14}px "Chakra Petch", sans-serif`;
      ctx.fillStyle = ft.color || '#FFD600';
      this.setGlow(ctx, ft.color || '#FFD600', 8);
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();

      if (ft.life <= 0) this.floatingTexts.splice(idx, 1);
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

  // 4. Natural Organic Rock Platform (Monolithic Plateau with Sedimentary Strata, Moss Fringes & Lush Canopy)
  drawRockPlatform(ctx, plat) {
    ctx.save();

    const numSamples = 24;
    const stepX = plat.w / numSamples;

    // A. Build Organic Polygon Contour
    ctx.beginPath();
    // Top Sloped/Curved Surface Points
    for (let i = 0; i <= numSamples; i++) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Bottom Organic Rounded Bowl Underside Points
    for (let i = numSamples; i >= 0; i--) {
      const px = plat.x + i * stepX;
      const progress = i / numSamples;
      const bowlDrop = Math.sin(progress * Math.PI) * 36 + Math.sin(progress * 12) * 5;
      const py = plat.y + plat.h + bowlDrop;
      ctx.lineTo(px, py);
    }
    ctx.closePath();

    // B. Drop Shadow Beneath Floating Rock Island
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#42372F';
    ctx.fill();
    ctx.restore();

    // C. Sedimentary Rock Body Gradient
    const rockGrad = ctx.createLinearGradient(0, plat.y - 20, 0, plat.y + plat.h + 40);
    rockGrad.addColorStop(0, '#8D7B68');
    rockGrad.addColorStop(0.3, '#796855');
    rockGrad.addColorStop(0.7, '#594A3C');
    rockGrad.addColorStop(1, '#3E3126');

    ctx.fillStyle = rockGrad;
    ctx.fill();

    // D. Heavy Rock Outline
    ctx.strokeStyle = '#221912';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // E. Realistic Geological Cracks & Strata Fractures
    ctx.strokeStyle = '#382B21';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const midX = plat.x + plat.w * 0.45;
    const midTopY = this.getPlatformTopY(plat, midX);
    ctx.moveTo(midX - 25, midTopY + 12);
    ctx.lineTo(midX - 10, midTopY + 30);
    ctx.lineTo(midX + 15, midTopY + 45);

    const rightX = plat.x + plat.w * 0.72;
    const rightTopY = this.getPlatformTopY(plat, rightX);
    ctx.moveTo(rightX, rightTopY + 14);
    ctx.lineTo(rightX + 16, rightTopY + 32);
    ctx.stroke();

    // F. Hanging Moss Tendrils & Vines Along Underside (No Triangles)
    ctx.fillStyle = '#2E7D32';
    ctx.strokeStyle = '#1B5E20';
    ctx.lineWidth = 1.2;
    for (let i = 2; i < numSamples - 1; i += 2) {
      const progress = i / numSamples;
      const px = plat.x + progress * plat.w;
      const bowlDrop = Math.sin(progress * Math.PI) * 36 + Math.sin(progress * 12) * 5;
      const py = plat.y + plat.h + bowlDrop;
      const tendrilLen = 8 + (Math.sin(i * 3.3) * 0.5 + 0.5) * 12;

      ctx.beginPath();
      ctx.moveTo(px - 4, py - 2);
      ctx.quadraticCurveTo(px + Math.sin(i) * 4, py + tendrilLen * 0.6, px, py + tendrilLen);
      ctx.quadraticCurveTo(px + 3, py + tendrilLen * 0.5, px + 4, py - 2);
      ctx.fill();
      ctx.stroke();
    }

    // G. Top Edge: Thick Lush Emerald Turf Canopy & Organic Blade Clusters
    // 1. Dark Rich Undergrowth Ribbon (Continuous Curve)
    ctx.beginPath();
    for (let i = 0; i <= numSamples; i++) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      if (i === 0) ctx.moveTo(px, py + 8);
      else ctx.lineTo(px, py + 8);
    }
    for (let i = numSamples; i >= 0; i--) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      ctx.lineTo(px, py - 2);
    }
    ctx.closePath();
    ctx.fillStyle = '#1B5E20';
    ctx.fill();

    // 2. Vibrant Sunlit Emerald Turf Top Layer
    ctx.beginPath();
    for (let i = 0; i <= numSamples; i++) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      if (i === 0) ctx.moveTo(px, py + 4);
      else ctx.lineTo(px, py + 4);
    }
    for (let i = numSamples; i >= 0; i--) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      ctx.lineTo(px, py - 2);
    }
    ctx.closePath();
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    // 3. Natural Varied Organic Grass Blade Tufts
    ctx.strokeStyle = '#2E7D32';
    ctx.fillStyle = '#66BB6A';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i <= numSamples; i += 2) {
      const px = plat.x + i * stepX;
      const py = this.getPlatformTopY(plat, px);
      const bH1 = 6 + (Math.sin(i * 2.7) * 0.5 + 0.5) * 6;
      const bH2 = 5 + (Math.cos(i * 1.9) * 0.5 + 0.5) * 5;

      ctx.beginPath();
      ctx.moveTo(px - 3, py + 1);
      ctx.quadraticCurveTo(px - 5, py - bH1 * 0.6, px - 6, py - bH1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px, py + 1);
      ctx.quadraticCurveTo(px + 1, py - bH2 * 0.7, px + 2, py - bH2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + 3, py + 1);
      ctx.quadraticCurveTo(px + 5, py - bH1 * 0.5, px + 6, py - bH1 * 0.85);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 5. Natural Ground Terrain (Stationary Geological Strata, Organic Root Networks & Rich Emerald Turf)
  drawGroundTerrain(ctx, plat, visLeft = 0, visRight = 3400) {
    ctx.save();

    // Zero-Jitter Grid Snapping to Fixed Global World Intervals
    const stepX = this.isMobile ? 24 : 16;
    const startGx = Math.floor((visLeft - 220) / stepX) * stepX;
    const endGx = Math.ceil((visRight + 220) / stepX) * stepX;
    const bottomY = this.worldHeight + 2500;

    // A. Deep Earth Bedrock Polygon (Pinned Globally)
    ctx.beginPath();
    ctx.moveTo(startGx, this.getGroundYAt(startGx));

    for (let gx = startGx; gx <= endGx; gx += stepX) {
      ctx.lineTo(gx, this.getGroundYAt(gx));
    }

    ctx.lineTo(endGx, bottomY);
    ctx.lineTo(startGx, bottomY);
    ctx.closePath();

    // B. Subterranean Stratified Soil Fill
    const earthGrad = ctx.createLinearGradient(0, plat.y - 40, 0, plat.y + 750);
    earthGrad.addColorStop(0, '#4E342E');
    earthGrad.addColorStop(0.2, '#3E2723');
    earthGrad.addColorStop(0.5, '#2B1A14');
    earthGrad.addColorStop(0.85, '#1A0E0A');
    earthGrad.addColorStop(1, '#0D0705');

    ctx.fillStyle = earthGrad;
    ctx.fill();

    // Heavy Contour Outline
    ctx.strokeStyle = '#21160F';
    ctx.lineWidth = 3;
    ctx.stroke();

    // C. Natural Geological Sedimentary Rock Strata Bands
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 3;
    const strataDepths = [1120, 1180, 1260, 1360, 1480];
    for (const sY of strataDepths) {
      ctx.beginPath();
      for (let gx = startGx; gx <= endGx; gx += stepX * 2) {
        const offset = Math.sin((gx / 240) * Math.PI) * 8 + Math.sin((gx / 90) * Math.PI) * 4;
        const syActual = sY + offset;
        if (gx === startGx) ctx.moveTo(gx, syActual);
        else ctx.lineTo(gx, syActual);
      }
      ctx.stroke();
    }

    // D. Organic Subterranean Tree Root Strands
    ctx.strokeStyle = '#2E1C14';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (let rx = startGx; rx <= endGx; rx += 140) {
      const topY = this.getGroundYAt(rx);
      ctx.beginPath();
      ctx.moveTo(rx, topY + 4);
      ctx.quadraticCurveTo(rx + 8, topY + 25, rx + 4, topY + 48);
      ctx.quadraticCurveTo(rx - 4, topY + 65, rx + 2, topY + 85);
      ctx.stroke();

      // Small secondary root branch
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(rx + 6, topY + 30);
      ctx.lineTo(rx + 16, topY + 46);
      ctx.stroke();
      ctx.lineWidth = 2.2;
    }

    // E. Continuous Lush Turf Canopy (No Triangles)
    // 1. Dark Undergrowth Shadow Ribbon
    ctx.beginPath();
    for (let gx = startGx; gx <= endGx; gx += stepX) {
      const gy = this.getGroundYAt(gx);
      if (gx === startGx) ctx.moveTo(gx, gy + 9);
      else ctx.lineTo(gx, gy + 9);
    }
    for (let gx = endGx; gx >= startGx; gx -= stepX) {
      const gy = this.getGroundYAt(gx);
      ctx.lineTo(gx, gy - 2);
    }
    ctx.closePath();
    ctx.fillStyle = '#1B5E20';
    ctx.fill();

    // 2. Vibrant Emerald Sunlit Turf Cap
    ctx.beginPath();
    for (let gx = startGx; gx <= endGx; gx += stepX) {
      const gy = this.getGroundYAt(gx);
      if (gx === startGx) ctx.moveTo(gx, gy + 4);
      else ctx.lineTo(gx, gy + 4);
    }
    for (let gx = endGx; gx >= startGx; gx -= stepX) {
      const gy = this.getGroundYAt(gx);
      ctx.lineTo(gx, gy - 3);
    }
    ctx.closePath();
    ctx.fillStyle = '#4CAF50';
    ctx.fill();

    // 3. Natural Organic Grass Blade Clusters & Flowering Flora
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let gx = startGx; gx <= endGx; gx += 18) {
      const gy = this.getGroundYAt(gx);
      const bH1 = 7 + (Math.sin(gx * 0.12) * 0.5 + 0.5) * 6;
      const bH2 = 5 + (Math.cos(gx * 0.19) * 0.5 + 0.5) * 5;

      ctx.beginPath();
      ctx.moveTo(gx - 3, gy + 1);
      ctx.quadraticCurveTo(gx - 5, gy - bH1 * 0.6, gx - 6, gy - bH1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gx, gy + 1);
      ctx.quadraticCurveTo(gx + 1, gy - bH2 * 0.7, gx + 2, gy - bH2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(gx + 3, gy + 1);
      ctx.quadraticCurveTo(gx + 5, gy - bH1 * 0.5, gx + 6, gy - bH1 * 0.85);
      ctx.stroke();

      // Wildflower Blossoms at fixed intervals
      if (gx % 90 === 0) {
        const flowerColor = (gx % 270 === 0) ? '#FFEB3B' : (gx % 180 === 0) ? '#40C4FF' : '#FF5252';
        ctx.fillStyle = flowerColor;
        ctx.beginPath();
        ctx.arc(gx + 1, gy - bH2 - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ──────────────── AUTHENTIC SCENERY: FACETED ROCKS & TALL PALM TREES ────────────────

  // 1. Faceted Angular Polygon Rocks (Matching Reference Screenshot 2)
  drawFacetedRock(ctx, cx, cy, radius, angle = 0, seed = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    // Generate 5-7 irregular polygon vertices using deterministic trigonometric pseudo-random jitter
    const numVerts = 5 + (Math.abs(seed) % 3);
    const verts = [];
    for (let i = 0; i < numVerts; i++) {
      const a = (i / numVerts) * Math.PI * 2;
      const jitter = 0.72 + (Math.sin(i * 3.7 + seed * 2.3) * 0.5 + 0.5) * 0.45;
      const r = radius * jitter;
      verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    // A. Base Slate Rock Fill
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < numVerts; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = '#64748B';
    ctx.fill();

    // B. Light Top Facet (Facing light from top-left)
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(verts[numVerts - 1].x, verts[numVerts - 1].y);
    ctx.lineTo(verts[0].x, verts[0].y);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.closePath();
    ctx.fill();

    // C. Midtone Side Facet
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(verts[1].x, verts[1].y);
    ctx.lineTo(verts[2].x, verts[2].y);
    ctx.closePath();
    ctx.fill();

    // D. Dark Bottom/Shadow Facet
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 2; i < numVerts; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // E. Internal Facet Ridge Lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < numVerts; i++) {
      ctx.moveTo(0, 0);
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.stroke();

    // F. Heavy Black Cartoon Contour Outline
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = Math.max(1.8, radius * 0.14);
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < numVerts; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  // 2. Tall Authentic Cartoon Palm Tree (Matching Reference Screenshot 1)
  drawPalmTree(ctx, x, y, height, scale = 1.0, lean = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const trunkSegments = Math.round(height / 14);
    const segHeight = height / trunkSegments;
    const trunkBaseW = 18;
    const trunkTopW = 11;

    // A. Compute Segmented Trunk Spine Coordinates
    const trunkPoints = [{ x: 0, y: 0, w: trunkBaseW }];

    for (let s = 1; s <= trunkSegments; s++) {
      const progress = s / trunkSegments;
      const segW = trunkBaseW + (trunkTopW - trunkBaseW) * progress;
      const segX = Math.sin(progress * Math.PI * 0.8) * (lean * 140);
      const segY = -s * segHeight;
      trunkPoints.push({ x: segX, y: segY, w: segW });
    }

    // B. Draw Diamond-Scaly Trunk Segments
    for (let s = 0; s < trunkSegments; s++) {
      const b0 = trunkPoints[s];
      const b1 = trunkPoints[s + 1];

      ctx.beginPath();
      ctx.moveTo(b0.x - b0.w / 2, b0.y);
      ctx.lineTo(b0.x + b0.w / 2, b0.y);
      ctx.lineTo(b1.x + b1.w / 2, b1.y);
      ctx.lineTo(b1.x - b1.w / 2, b1.y);
      ctx.closePath();

      const barkGrad = ctx.createLinearGradient(b0.x - b0.w / 2, 0, b0.x + b0.w / 2, 0);
      barkGrad.addColorStop(0, s % 2 === 0 ? '#8D7B58' : '#A08E6B');
      barkGrad.addColorStop(0.5, s % 2 === 0 ? '#A08E6B' : '#B5A380');
      barkGrad.addColorStop(1, '#5E4E30');
      ctx.fillStyle = barkGrad;
      ctx.fill();

      // Diamond / Scaly Bark Cross Lines
      ctx.strokeStyle = '#2A1F13';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b0.x - b0.w / 2, b0.y);
      ctx.lineTo(b1.x + b1.w / 2, b1.y);
      ctx.moveTo(b0.x + b0.w / 2, b0.y);
      ctx.lineTo(b1.x - b1.w / 2, b1.y);
      ctx.stroke();
    }

    // C. Trunk Cartoon Border Outlines
    ctx.strokeStyle = '#1F140A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(trunkPoints[0].x - trunkPoints[0].w / 2, trunkPoints[0].y);
    for (let s = 1; s <= trunkSegments; s++) {
      ctx.lineTo(trunkPoints[s].x - trunkPoints[s].w / 2, trunkPoints[s].y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(trunkPoints[0].x + trunkPoints[0].w / 2, trunkPoints[0].y);
    for (let s = 1; s <= trunkSegments; s++) {
      ctx.lineTo(trunkPoints[s].x + trunkPoints[s].w / 2, trunkPoints[s].y);
    }
    ctx.stroke();

    // D. Palm Crown (Top of Trunk with Jagged Leaflet Cutouts)
    const crownTop = trunkPoints[trunkSegments];
    ctx.save();
    ctx.translate(crownTop.x, crownTop.y);

    const fronds = [
      { angle: -2.85, len: 48, w: 18, notches: 3 },
      { angle: -2.40, len: 58, w: 22, notches: 4 },
      { angle: -1.95, len: 68, w: 24, notches: 4 },
      { angle: -1.57, len: 72, w: 26, notches: 5 },
      { angle: -1.18, len: 68, w: 24, notches: 4 },
      { angle: -0.75, len: 58, w: 22, notches: 4 },
      { angle: -0.30, len: 48, w: 18, notches: 3 }
    ];

    for (const f of fronds) {
      ctx.save();
      ctx.rotate(f.angle + Math.PI / 2);

      ctx.beginPath();
      ctx.moveTo(0, 0);

      // Left edge with leaflet cutouts
      const n = f.notches;
      for (let i = 1; i <= n; i++) {
        const t1 = (i - 0.5) / n;
        const t2 = i / n;
        const w1 = Math.sin(t1 * Math.PI) * (f.w / 2);
        const w2 = Math.sin(t2 * Math.PI) * (f.w / 2);
        ctx.lineTo(-w1 * 1.15, -t1 * f.len);
        ctx.lineTo(-w2 * 0.45, -t1 * f.len - f.len / (n * 2.5));
      }
      ctx.lineTo(0, -f.len);

      // Right edge with leaflet cutouts
      for (let i = n; i >= 1; i--) {
        const t1 = i / n;
        const t2 = (i - 0.5) / n;
        const w1 = Math.sin(t1 * Math.PI) * (f.w / 2);
        const w2 = Math.sin(t2 * Math.PI) * (f.w / 2);
        ctx.lineTo(w1 * 0.45, -t1 * f.len + f.len / (n * 2.5));
        ctx.lineTo(w2 * 1.15, -t2 * f.len);
      }
      ctx.closePath();

      const leafGrad = ctx.createLinearGradient(0, 0, 0, -f.len);
      leafGrad.addColorStop(0, '#2E7D32');
      leafGrad.addColorStop(0.4, '#4CAF50');
      leafGrad.addColorStop(0.85, '#7CB342');
      leafGrad.addColorStop(1, '#9CCC65');

      ctx.fillStyle = leafGrad;
      ctx.fill();

      // Central Spine Rib
      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -f.len);
      ctx.stroke();

      // Heavy Cartoon Outline
      ctx.strokeStyle = '#18240F';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.restore();
    }

    // Coconut / Frond Hub Center
    ctx.fillStyle = '#4E342E';
    ctx.beginPath();
    ctx.arc(-4, -2, 6, 0, Math.PI * 2);
    ctx.arc(4, -3, 5, 0, Math.PI * 2);
    ctx.arc(0, 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#26170E';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.restore(); // Crown restore

    // E. Base Faceted Boulders & Grass (Matching Screenshot 1)
    this.drawFacetedRock(ctx, -14, -6, 13, -0.2, 1);
    this.drawFacetedRock(ctx, 12, -7, 15, 0.3, 2);
    this.drawFacetedRock(ctx, 0, -4, 10, 0.1, 3);

    // Comic grass tufts around tree base
    ctx.fillStyle = '#7CB342';
    for (let gx = -22; gx <= 22; gx += 8) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + 3, -9);
      ctx.lineTo(gx + 6, 0);
      ctx.fill();
      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    ctx.restore(); // Tree restore
  }

  // 3. Surface Boulder Cluster on Grass
  drawBoulderCluster(ctx, x, y, count = 3, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (count >= 3) {
      this.drawFacetedRock(ctx, -16, -8, 16, -0.25, 4);
      this.drawFacetedRock(ctx, 14, -9, 18, 0.35, 5);
      this.drawFacetedRock(ctx, -1, -12, 13, 0.1, 6);
    } else {
      this.drawFacetedRock(ctx, -10, -8, 17, -0.15, 7);
      this.drawFacetedRock(ctx, 11, -7, 14, 0.25, 8);
    }

    // Grass tufts around boulders
    ctx.fillStyle = '#689F38';
    for (let gx = -22; gx <= 22; gx += 9) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + 3, -8);
      ctx.lineTo(gx + 6, 0);
      ctx.fill();
      ctx.strokeStyle = '#1B5E20';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // 4. World Scenery Dispatcher (Palm Trees & Surface Boulders - Viewport Culled)
  drawWorldScenery(ctx, visLeft = 0, visRight = 3400) {
    // A. Surface Boulder Clusters (Placed on Top-Most Surface)
    if (this.surfaceBoulders) {
      for (const b of this.surfaceBoulders) {
        if (b.x < visLeft - 60 || b.x > visRight + 60) continue;
        const baseY = this.getTopSurfaceY(b.x);
        this.drawBoulderCluster(ctx, b.x, baseY, b.count, b.scale);
      }
    }

    // B. Natural Hand-Drawn Palm Trees (Firmly Rooted on Top-Most Island/Hill Surface)
    if (this.sceneryTrees) {
      for (const tree of this.sceneryTrees) {
        if (tree.x < visLeft - 100 || tree.x > visRight + 100) continue;
        const baseY = this.getTopSurfaceY(tree.x);
        this.drawPalmTree(ctx, tree.x, baseY, tree.height, tree.scale, tree.lean);
      }
    }
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

    // Active Hitmarker X-Ticks (Pulsing Red Hit Feedback)
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer--;
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FF1744';
      const sz = 11;
      ctx.beginPath();
      ctx.moveTo(-sz, -sz); ctx.lineTo(-sz + 5, -sz + 5);
      ctx.moveTo(sz, -sz); ctx.lineTo(sz - 5, -sz + 5);
      ctx.moveTo(-sz, sz); ctx.lineTo(-sz + 5, sz - 5);
      ctx.moveTo(sz, sz); ctx.lineTo(sz - 5, sz - 5);
      ctx.stroke();
    }

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
      this.drawDetailedShotgun(ctx, 0, 0, 1.05);
    } else if (gun.type === 'sniper') {
      this.drawDetailedSniper(ctx, 0, 0, 1.05);
    } else if (gun.type === 'rpg') {
      this.drawDetailedRPG(ctx, 0, 0, 1.05);
    } else {
      // Authentic 3D Micro-Uzi SMG Model
      this.drawDetailedUzi(ctx, 0, 0, 1.25);
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
    const px = isFinite(p.x) ? p.x : 700;
    const py = isFinite(p.y) ? p.y : 900;
    const pAim = isFinite(p.aimAngle) ? p.aimAngle : 0;
    const pWalk = isFinite(walkCycle) ? walkCycle : 0;
    const pRecoil = isFinite(recoil) ? recoil : 0;

    ctx.save();
    ctx.translate(px, py);

    const facingLeft = Math.cos(pAim) < 0;
    const teamColor = p.team === 'BLUE' ? '#00A2FF' : '#FF3366';
    const visorColor = p.team === 'BLUE' ? '#00E5FF' : '#FFD600';
    const equippedWep = isLocal ? this.currentWeapon : (p.weapon || 'uzi');

    if (isLocal) {
      const isFiring = this.mouse.isDown || this.touchJoyRight.isFiring;
      const isAiming = this.touchJoyRight.isAiming || (this.mouse && this.mouse.active);

      ctx.strokeStyle = isFiring ? 'rgba(255, 51, 102, 0.7)' : (isAiming ? 'rgba(0, 229, 255, 0.55)' : 'rgba(0, 229, 255, 0.25)');
      ctx.lineWidth = isFiring ? 2.0 : 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(pAim) * 380, Math.sin(pAim) * 380);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isAiming || isFiring) {
        ctx.fillStyle = isFiring ? '#FF3366' : '#00E5FF';
        ctx.beginPath();
        ctx.arc(Math.cos(pAim) * 380, Math.sin(pAim) * 380, isFiring ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    if (facingLeft) ctx.scale(-1, 1);

    let localAim = pAim;
    if (facingLeft) localAim = Math.PI - pAim;

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
      this.drawDetailedUzi(ctx, 16, 2, 0.95);
    } else if (wep === 'shotgun') {
      this.drawDetailedShotgun(ctx, 16, 1, 0.95);
    } else if (wep === 'sniper') {
      this.drawDetailedSniper(ctx, 16, 1, 0.92);
    } else if (wep === 'rpg') {
      this.drawDetailedRPG(ctx, 14, 0, 0.95);
    }
    ctx.restore();
  }

  // ──────────────── AUTHENTIC DETAILED 3D FIREARM MODELS ────────────────

  // 1. Authentic 3D Micro-Uzi Tactical Submachine Gun
  drawDetailedUzi(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // A. Extended 9mm Steel Magazine (Protruding downwards from grip)
    ctx.fillStyle = '#1E2429';
    ctx.fillRect(-1, 8, 5, 14);
    // Magazine Metallic Edge Highlight
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-1, 8, 1.5, 14);
    // Baseplate
    ctx.fillStyle = '#101417';
    ctx.fillRect(-1.5, 21, 6, 2);

    // B. Polymer Ribbed Pistol Grip (Angled ergonomic grip)
    ctx.fillStyle = '#1A1E23';
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(3, 0);
    ctx.lineTo(2, 11);
    ctx.lineTo(-5, 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0E1114';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Grip horizontal friction grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(-3, 3); ctx.lineTo(1.5, 3);
    ctx.moveTo(-3.5, 6); ctx.lineTo(1, 6);
    ctx.moveTo(-4, 9); ctx.lineTo(0.5, 9);
    ctx.stroke();

    // C. Steel Trigger Guard & Silver Trigger Blade
    ctx.strokeStyle = '#15191D';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-3, 1);
    ctx.lineTo(-8, 1);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-4, 7);
    ctx.stroke();

    // Silver Trigger
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(-7, 5);
    ctx.stroke();

    // D. Main Receiver Body (Stamped Gunmetal Steel with 3D Bevel)
    const recGrad = ctx.createLinearGradient(0, -6, 0, 3);
    recGrad.addColorStop(0, '#546E7A');
    recGrad.addColorStop(0.25, '#37474F');
    recGrad.addColorStop(0.75, '#263238');
    recGrad.addColorStop(1, '#1A2126');

    ctx.fillStyle = recGrad;
    ctx.fillRect(-14, -6, 26, 8);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-14, -6, 26, 8);

    // E. Ejection Port & Brass Bullet Casing in Chamber
    ctx.fillStyle = '#0D1114';
    ctx.fillRect(-4, -5, 8, 4);
    ctx.fillStyle = '#FFD54F'; // gold/brass bullet casing
    ctx.fillRect(-1, -4, 4, 2);

    // F. Short Steel Barrel & Muzzle Flash Hider
    ctx.fillStyle = '#21272C';
    ctx.fillRect(12, -4, 8, 4);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, -4, 8, 4);
    // Muzzle Crown Ring / Flash Hider Thread
    ctx.fillStyle = '#455A64';
    ctx.fillRect(18, -5, 2.5, 6);

    // G. Top Receiver Iron Sights & Cyan Charging Knob
    // Rear Iron Sight Ears
    ctx.fillStyle = '#181C20';
    ctx.fillRect(-13, -8, 3, 2.5);
    // Front Iron Sight Post
    ctx.fillRect(10, -8, 2, 2.5);
    // Tactical Cyan Charging Handle
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-2, -8, 4, 2.5);

    // H. Folded Steel Wire Skeleton Buttstock (Resting on top)
    ctx.strokeStyle = '#78909C';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -1);
    ctx.lineTo(-15, -6);
    ctx.lineTo(8, -6);
    ctx.stroke();

    ctx.restore();
  }

  // 2. Authentic 3D Combat Pump Shotgun
  drawDetailedShotgun(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // A. Contoured Polymer/Wood Stock
    ctx.fillStyle = '#6D4C41';
    ctx.beginPath();
    ctx.moveTo(-18, 4);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3E2723';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // B. Blued Steel Receiver Body
    const recGrad = ctx.createLinearGradient(0, -5, 0, 5);
    recGrad.addColorStop(0, '#455A64');
    recGrad.addColorStop(0.5, '#263238');
    recGrad.addColorStop(1, '#1A2126');
    ctx.fillStyle = recGrad;
    ctx.fillRect(-6, -5, 20, 10);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-6, -5, 20, 10);

    // C. Trigger Guard
    ctx.strokeStyle = '#15191D';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-4, 3, 6, 6);

    // D. Long Steel Barrel & Under-Barrel Tubular Magazine
    ctx.fillStyle = '#1E2328';
    ctx.fillRect(14, -4, 24, 4); // main barrel
    ctx.fillRect(14, 1, 18, 3.5); // mag tube
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, -4, 24, 4);

    // Brass Front Bead Sight
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(36, -5, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // E. Ribbed Pump Forend Grip
    ctx.fillStyle = '#FF7B00';
    ctx.fillRect(18, 0, 10, 5);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 0, 10, 5);

    ctx.restore();
  }

  // 3. Authentic 3D Marksman Precision Sniper Rifle
  drawDetailedSniper(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // A. Tactical Sniper Stock with Cheek Riser
    ctx.fillStyle = '#1A212D';
    ctx.beginPath();
    ctx.moveTo(-22, -2);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-22, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // B. Long Precision Fluted Barrel
    ctx.fillStyle = '#263238';
    ctx.fillRect(10, -3, 34, 4.5);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, -3, 34, 4.5);

    // Heavy Muzzle Brake at Barrel Tip
    ctx.fillStyle = '#37474F';
    ctx.fillRect(42, -4.5, 6, 7.5);
    ctx.strokeStyle = '#101417';
    ctx.strokeRect(42, -4.5, 6, 7.5);

    // C. Steel Receiver & Curved Magazine
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-8, -4, 18, 8);
    ctx.strokeStyle = '#101417';
    ctx.strokeRect(-8, -4, 18, 8);
    // Short 7.62mm Mag
    ctx.fillStyle = '#21272C';
    ctx.fillRect(0, 4, 7, 8);

    // D. High-Magnification Sniper Scope with Dual Rings & Glowing Green Reticle Lens
    ctx.fillStyle = '#101417';
    ctx.fillRect(-4, -10, 20, 4.5); // scope tube
    ctx.fillRect(-7, -11, 4, 6.5); // eyepiece
    ctx.fillRect(14, -11.5, 5, 7.5); // objective bell
    // Glowing Green Scope Lens Reticle
    ctx.fillStyle = '#00FF66';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FF66';
    ctx.fillRect(17.5, -10.5, 1.5, 5.5);
    ctx.shadowBlur = 0;

    // Scope Mount Rings
    ctx.strokeStyle = '#455A64';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-2, -6, 2.5, 2.5);
    ctx.strokeRect(10, -6, 2.5, 2.5);

    ctx.restore();
  }

  // 4. Authentic 3D RPG Rocket Launcher (Bazooka)
  drawDetailedRPG(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // A. Olive Drab Cylindrical Tube
    const tubeGrad = ctx.createLinearGradient(0, -6, 0, 6);
    tubeGrad.addColorStop(0, '#556B2F');
    tubeGrad.addColorStop(0.35, '#3E4D38');
    tubeGrad.addColorStop(0.8, '#2E3B29');
    tubeGrad.addColorStop(1, '#1A2118');
    ctx.fillStyle = tubeGrad;
    ctx.fillRect(-16, -6, 42, 12);
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-16, -6, 42, 12);

    // Heat Shield Wood Wrap
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(-6, -6.5, 16, 13);
    ctx.strokeStyle = '#3E2723';
    ctx.strokeRect(-6, -6.5, 16, 13);

    // B. Rear Exhaust Venturi Funnel
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(-24, -9);
    ctx.lineTo(-24, 9);
    ctx.lineTo(-16, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#101417';
    ctx.stroke();

    // C. Dual Pistol Grips & Trigger
    ctx.fillStyle = '#181C20';
    ctx.fillRect(-2, 6, 5, 9);
    ctx.fillRect(16, 6, 5, 8);

    // D. Rocket Warhead with Red Conical Explosive Nose Tip
    ctx.fillStyle = '#4B5320';
    ctx.fillRect(26, -7, 8, 14);
    // Red High-Explosive Nose Cone
    ctx.fillStyle = '#FF3366';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF3366';
    ctx.beginPath();
    ctx.moveTo(34, -7);
    ctx.lineTo(46, 0);
    ctx.lineTo(34, 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#101417';
    ctx.stroke();

    ctx.restore();
  }

  // ──────────────── SWARM BOT COMBAT & 3D PROCEDURAL RENDERING ────────────────

  handleBotKill(bot) {
    if (!bot || bot.killedHandled) return;
    bot.killedHandled = true;
    bot.isDead = true;

    // Visual impact sparks & particle burst (damageBots = false to prevent recursion)
    this.spawnImpactSparks(bot.x, bot.y, '#FFD600');
    this.createExplosion(bot.x, bot.y, 45, 0, 'LOCAL_EXPLODE', false);

    // Score & Kill tracking based on bot class
    this.totalKills = (this.totalKills || 0) + 1;
    const scoreVal = bot.type === 'GOLIATH_MECH' ? 500 : bot.type === 'HEAVY_BOT' ? 350 : bot.type === 'PHANTOM_SLICER' ? 200 : bot.type === 'INSECTOID_WALKER' ? 150 : 100;
    this.swarmState.score += scoreVal;

    // Check & Save High Score persistently
    if (this.swarmState.score > this.swarmState.highScore) {
      this.swarmState.highScore = this.swarmState.score;
      localStorage.setItem('wegether_highscore', this.swarmState.highScore.toString());
      this.updateHighScoreUI();
    }

    // 45% Chance to drop tactical loot
    if (Math.random() < 0.45 && this.groundGuns && Array.isArray(this.groundGuns)) {
      const lootTypes = ['shotgun', 'sniper', 'rpg'];
      const chosenWeapon = lootTypes[Math.floor(Math.random() * lootTypes.length)];
      const names = { shotgun: 'COMBAT SHOTGUN', sniper: 'MARKSMAN SNIPER', rpg: 'BAZOOKA' };
      this.groundGuns.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        x: bot.x,
        y: bot.y - 10,
        vx: (Math.random() - 0.5) * 4,
        vy: -4 - Math.random() * 3,
        type: chosenWeapon,
        name: names[chosenWeapon],
        rarity: chosenWeapon === 'rpg' ? 'LEGENDARY' : chosenWeapon === 'sniper' ? 'RARE' : 'UNCOMMON',
        available: true,
        stuck: false
      });
      this.addPickupNotification(`+LOOT DROP: ${names[chosenWeapon]}`, '#FFD600');
    }
  }

  updateSwarmPhysics() {
    if (this.gameMode !== 'SWARM_SURVIVAL') return;
    const p = this.localPlayer;
    const now = Date.now();

    // ──────────────── 1. UPDATE FRIENDLY AI COMPANION ("DELTA-1 PRIME") ────────────────
    if (this.aiCompanion && !this.aiCompanion.isDead) {
      const comp = this.aiCompanion;
      comp.hoverOffset = Math.sin(now * 0.004) * 6;

      // Tether to position slightly behind and above player
      const targetX = p.x + (p.facingLeft ? 80 : -80);
      const targetY = p.y - 50 + comp.hoverOffset;

      // Smooth Spring Tether Physics
      comp.vx = (targetX - comp.x) * 0.09;
      comp.vy = (targetY - comp.y) * 0.09;
      comp.x += comp.vx;
      comp.y += comp.vy;

      // Find Closest Hostile Bot
      let closestBot = null;
      let minDist = 800;
      for (const bot of this.swarmBots) {
        if (bot.isDead) continue;
        const d = Math.hypot(bot.x - comp.x, bot.y - comp.y);
        if (d < minDist) {
          minDist = d;
          closestBot = bot;
        }
      }

      if (closestBot) {
        comp.aimAngle = Math.atan2(closestBot.y - comp.y, closestBot.x - comp.x);
        comp.facingLeft = Math.cos(comp.aimAngle) < 0;

        // Auto Fire Gatling Pulse Laser Bursts (Every 160ms)
        if (now - comp.lastShootTime > 160) {
          comp.lastShootTime = now;
          const bSpeed = 24.0;
          const spread = (Math.random() - 0.5) * 0.05;
          const angle = comp.aimAngle + spread;

          this.bullets.push({
            id: `b_comp_${now}_${Math.random()}`,
            ownerId: 'COMPANION',
            x: comp.x + Math.cos(angle) * 22,
            y: comp.y + Math.sin(angle) * 22,
            vx: Math.cos(angle) * bSpeed,
            vy: Math.sin(angle) * bSpeed,
            weapon: 'uzi',
            color: '#00E5FF',
            life: 0,
            maxLife: 55
          });
        }

        // Defensive Cluster Frag Grenade Deployment if Swarmed (3+ bots near player within 220px)
        let botsNearPlayer = 0;
        for (const b of this.swarmBots) {
          if (!b.isDead && Math.hypot(b.x - p.x, b.y - p.y) < 220) botsNearPlayer++;
        }
        if (botsNearPlayer >= 3 && now - comp.lastGrenadeTime > 7500) {
          comp.lastGrenadeTime = now;
          const gAngle = Math.atan2(closestBot.y - comp.y, closestBot.x - comp.x);
          this.grenades.push({
            id: `g_comp_${now}`,
            ownerId: 'COMPANION',
            team: 'BLUE',
            x: comp.x,
            y: comp.y,
            vx: Math.cos(gAngle) * 14,
            vy: Math.sin(gAngle) * 14 - 3,
            timer: 70
          });
          this.showToast('DELTA-1 PRIME', 'Deploying tactical defensive frag grenade! Take cover!', '🛡️');
        }
      }
    }

    // ──────────────── 2. UPDATE HOSTILE SWARM BOTS ────────────────
    for (let i = 0; i < this.swarmBots.length; i++) {
      const bot = this.swarmBots[i];
      if (bot.isDead) continue;
      bot.animFrame += 0.25;

      const targetX = p.x;
      const targetY = p.y;
      const distToPlayer = Math.hypot(targetX - bot.x, targetY - bot.y);

      bot.aimAngle = Math.atan2(targetY - bot.y, targetX - bot.x);
      bot.facingLeft = Math.cos(bot.aimAngle) < 0;

      // ── A. APEX CYBER DRONE (Hovering Ranged Gunner) ──
      if (bot.type === 'CYBER_DRONE') {
        const hoverY = targetY - 140 + Math.sin(bot.hoverSeed + now * 0.003) * 55;
        const desiredDist = 260;

        if (distToPlayer > desiredDist) {
          bot.vx += (Math.cos(bot.aimAngle) * bot.speed - bot.vx) * 0.05;
          bot.vy += (Math.sin(bot.aimAngle) * bot.speed - bot.vy) * 0.05;
        } else if (distToPlayer < desiredDist - 80) {
          bot.vx -= (Math.cos(bot.aimAngle) * bot.speed * 0.6 + bot.vx) * 0.05;
          bot.vy += ((hoverY - bot.y) * 0.04 - bot.vy) * 0.05;
        } else {
          bot.vy += ((hoverY - bot.y) * 0.05 - bot.vy) * 0.05;
          bot.vx *= 0.95;
        }

        bot.x += bot.vx;
        bot.y += bot.vy;

        // Ranged Plasma Burst
        bot.shootCooldown--;
        if (bot.shootCooldown <= 0 && distToPlayer < 650) {
          bot.shootCooldown = 55;
          this.bullets.push({
            id: `b_bot_${now}_${Math.random()}`,
            ownerId: 'BOT',
            isBotBullet: true,
            x: bot.x + Math.cos(bot.aimAngle) * 22,
            y: bot.y + Math.sin(bot.aimAngle) * 22,
            vx: Math.cos(bot.aimAngle) * 16.0,
            vy: Math.sin(bot.aimAngle) * 16.0,
            damage: 10,
            weapon: 'uzi',
            color: '#FFD600',
            life: 0,
            maxLife: 60
          });
        }
      }

      // ── B. INSECTOID WALKER (Melee Pounce Stalker) ──
      else if (bot.type === 'INSECTOID_WALKER') {
        const groundY = this.getGroundYAt(bot.x);
        const onGround = bot.y >= groundY - 26;

        bot.jumpCooldown--;
        bot.meleeCooldown--;

        const dir = targetX > bot.x ? 1 : -1;
        if (onGround) {
          bot.y = groundY - 24;
          bot.vy = 0;
          bot.vx = dir * bot.speed;

          if (distToPlayer < 190 && bot.jumpCooldown <= 0 && targetY < bot.y + 50) {
            bot.jumpCooldown = 85;
            bot.isPouncing = true;
            bot.vx = dir * (bot.speed * 2.3);
            bot.vy = -9.8;
          }
        } else {
          bot.vy += 0.42;
          bot.vx *= 0.98;
          if (bot.y >= groundY - 24) {
            bot.y = groundY - 24;
            bot.vy = 0;
            bot.isPouncing = false;
          }
        }

        bot.x += bot.vx;
        bot.y += bot.vy;

        // Melee Claw Slash
        if (distToPlayer < 38 && bot.meleeCooldown <= 0 && !p.isDead) {
          bot.meleeCooldown = 32;
          const slashDmg = 16 + Math.floor(this.swarmState.wave * 1.5);
          p.hp = Math.max(0, p.hp - slashDmg);
          this.spawnImpactSparks(p.x, p.y, '#FF3366');
          p.vx += dir * 7;
          p.vy -= 3;

          if (p.hp <= 0) {
            this.triggerLocalDeath('SWARM_BOT', 'melee');
            this.showToast('FALLEN IN COMBAT', `Overrun by Bot Swarm at Wave ${this.swarmState.wave}! Final Score: ${this.swarmState.score}`, '💀');
          }
        }
      }

      // ── C. PHANTOM SLICER (Fast Buzzsaw Interceptor) ──
      else if (bot.type === 'PHANTOM_SLICER') {
        // High-speed swooping flight
        const swoopAngle = bot.aimAngle + Math.sin(now * 0.006) * 0.4;
        bot.vx += (Math.cos(swoopAngle) * bot.speed - bot.vx) * 0.08;
        bot.vy += (Math.sin(swoopAngle) * bot.speed - bot.vy) * 0.08;

        bot.x += bot.vx;
        bot.y += bot.vy;

        bot.meleeCooldown--;
        // Plasma Buzzsaw Blade Contact
        if (distToPlayer < 32 && bot.meleeCooldown <= 0 && !p.isDead) {
          bot.meleeCooldown = 28;
          p.hp = Math.max(0, p.hp - 20);
          this.spawnImpactSparks(p.x, p.y, '#E040FB');
          p.vx += (Math.random() - 0.5) * 8;
          p.vy -= 4;

          if (p.hp <= 0) {
            this.triggerLocalDeath('PHANTOM_SLICER', 'buzzsaw');
            this.showToast('SLICED DOWN', `Destroyed by Phantom Slicer at Wave ${this.swarmState.wave}!`, '💀');
          }
        }
      }

      // ── D. GOLIATH MECH (Heavy Boss Titan) ──
      else if (bot.type === 'GOLIATH_MECH' || bot.type === 'HEAVY_BOT') {
        const hoverY = targetY - 120 + Math.sin(bot.hoverSeed + now * 0.002) * 35;
        const desiredDist = 200;

        if (distToPlayer > desiredDist) {
          bot.vx += (Math.cos(bot.aimAngle) * bot.speed - bot.vx) * 0.04;
          bot.vy += (Math.sin(bot.aimAngle) * bot.speed - bot.vy) * 0.04;
        } else {
          bot.vy += ((hoverY - bot.y) * 0.04 - bot.vy) * 0.04;
          bot.vx *= 0.94;
        }

        bot.x += bot.vx;
        bot.y += bot.vy;

        // Heavy Twin Assault Cannon Burst
        bot.shootCooldown--;
        if (bot.shootCooldown <= 0 && distToPlayer < 700) {
          bot.shootCooldown = 70;
          // Dual Heavy Shots
          for (let s = -1; s <= 1; s += 2) {
            this.bullets.push({
              id: `b_goliath_${now}_${Math.random()}`,
              ownerId: 'BOT',
              isBotBullet: true,
              x: bot.x + Math.cos(bot.aimAngle) * 26 + s * 8,
              y: bot.y + Math.sin(bot.aimAngle) * 26,
              vx: Math.cos(bot.aimAngle) * 14.0,
              vy: Math.sin(bot.aimAngle) * 14.0,
              damage: 18,
              weapon: 'uzi',
              color: '#FF3D00',
              life: 0,
              maxLife: 65
            });
          }
        }
      }

      // World Boundary Clamping
      bot.x = Math.max(80, Math.min(this.worldWidth - 80, bot.x));
      bot.y = Math.max(60, Math.min(this.worldHeight - 80, bot.y));
    }

    // ──────────────── 3. SAFE ATOMIC BOT CLEANUP (ZERO CRASHES) ────────────────
    let anyKilled = false;
    for (let i = this.swarmBots.length - 1; i >= 0; i--) {
      const bot = this.swarmBots[i];
      if (bot.hp <= 0 || bot.isDead) {
        this.handleBotKill(bot);
        this.swarmBots.splice(i, 1);
        anyKilled = true;
      }
    }
    if (anyKilled) {
      this.updateSwarmHUD();
    }

    // Check if Wave Cleared!
    if (this.swarmBots.length === 0 && this.swarmState.waveActive) {
      this.swarmState.waveActive = false;
      const waveBonus = this.swarmState.wave * 500;
      this.swarmState.score += waveBonus;
      if (this.swarmState.wave > this.swarmState.highestWave) {
        this.swarmState.highestWave = this.swarmState.wave;
        localStorage.setItem('wegether_highest_wave', this.swarmState.highestWave.toString());
        this.updateHighScoreUI();
      }
      this.updateSwarmHUD();

      // Revive Friendly AI Companion
      if (this.aiCompanion) {
        this.aiCompanion.isDead = false;
        this.aiCompanion.hp = this.aiCompanion.maxHp;
        this.aiCompanion.x = this.localPlayer.x - 60;
        this.aiCompanion.y = this.localPlayer.y - 40;
      }

      this.playWaveClearSound();
      this.showWaveBanner(`WAVE ${this.swarmState.wave} CLEARED!`, `+${waveBonus} BONUS PTS • NEXT WAVE INCOMING`);

      // Schedule next wave with timer tracking (prevents zombie timers)
      if (this.swarmNextWaveTimer) clearTimeout(this.swarmNextWaveTimer);
      this.swarmNextWaveTimer = setTimeout(() => {
        if (this.gameMode === 'SWARM_SURVIVAL' && !this.localPlayer.isDead) {
          this.startSwarmWave(this.swarmState.wave + 1);
        }
      }, 3600);
    }
  }

  // ──────────────── HIGH-DEFINITION 3D PROCEDURAL BOT MODELS ────────────────

  // Model 1: APEX CYBER DRONE (Golden-Yellow & Carbon-Fiber Vanguard Flyer)
  drawApexCyberDrone(ctx, drone, isFriendly = false) {
    ctx.save();
    ctx.translate(drone.x, drone.y);

    const facingLeft = drone.facingLeft;
    if (facingLeft) ctx.scale(-1, 1);

    // 1. Dual Plasma Jet Exhausts
    const flameSize = 7 + Math.sin(Date.now() * 0.025) * 4;
    const jetGrad = ctx.createLinearGradient(0, 10, 0, 12 + flameSize * 2);
    jetGrad.addColorStop(0, '#FFD600');
    jetGrad.addColorStop(0.5, '#FF6D00');
    jetGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = jetGrad;

    ctx.beginPath();
    ctx.moveTo(-9, 10); ctx.lineTo(-3, 10); ctx.lineTo(-6, 12 + flameSize * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, 10); ctx.lineTo(9, 10); ctx.lineTo(6, 12 + flameSize * 2); ctx.fill();

    // 2. Heavy Gun Wings with Multi-Barreled Rotary Autocannons
    ctx.fillStyle = '#181C22';
    ctx.strokeStyle = '#0B0E12';
    ctx.lineWidth = 1.5;

    // Wing Pylons
    ctx.fillRect(-28, -7, 14, 14);
    ctx.strokeRect(-28, -7, 14, 14);
    ctx.fillRect(14, -7, 14, 14);
    ctx.strokeRect(14, -7, 14, 14);

    // Triple Rotary Gun Barrels
    ctx.fillStyle = '#37474F';
    ctx.fillRect(26, -5, 12, 3);
    ctx.fillRect(26, -1, 12, 3);
    ctx.fillRect(26, 3, 12, 3);
    // Muzzle Brakes
    ctx.fillStyle = '#263238';
    ctx.fillRect(36, -6, 3, 5);
    ctx.fillRect(36, 2, 3, 5);

    // 3. Main Multi-Layered Spherical Hull
    const shellGrad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 20);
    shellGrad.addColorStop(0, '#FFD54F');
    shellGrad.addColorStop(0.5, '#FFB300');
    shellGrad.addColorStop(0.85, '#FF8F00');
    shellGrad.addColorStop(1, '#212121');

    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#101418';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Inset Carbon-Fiber Armor Plates & Rivets
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(0, 0, 13, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.lineTo(0, 13);
    ctx.arc(0, 0, 13, Math.PI * 0.6, Math.PI * 1.4);
    ctx.closePath();
    ctx.fill();

    // Armor Rivets
    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath();
    ctx.arc(-8, -10, 1.2, 0, Math.PI * 2);
    ctx.arc(-8, 10, 1.2, 0, Math.PI * 2);
    ctx.arc(8, -10, 1.2, 0, Math.PI * 2);
    ctx.arc(8, 10, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. High-Tech Sapphire Crystalline Eye Lens
    this.setGlow(ctx, '#00E5FF', 14);
    const eyeGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
    eyeGrad.addColorStop(0, '#FFFFFF');
    eyeGrad.addColorStop(0.3, '#00E5FF');
    eyeGrad.addColorStop(0.7, '#0091EA');
    eyeGrad.addColorStop(1, '#01579B');

    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Glass Reflection Arc Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(2, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    this.setGlow(ctx, '#000', 0);

    // Subtle Laser Targeting Line
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(120, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Health Bar
    const hpRatio = Math.max(0, drone.hp / drone.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(-18, -28, 36, 5);
    ctx.fillStyle = '#FF3366';
    ctx.fillRect(-17, -27, 34 * hpRatio, 3);

    ctx.restore();
  }

  // Model 2: CRIMSON ARACHNID STALKER (Multi-Legged Alien Predator)
  drawCrimsonArachnid(ctx, stalker) {
    ctx.save();
    ctx.translate(stalker.x, stalker.y);

    const facingLeft = stalker.facingLeft;
    if (facingLeft) ctx.scale(-1, 1);

    const walk = Math.sin(stalker.animFrame) * 9;
    const isPouncing = stalker.isPouncing;

    // 1. Heavy Articulated Hydraulic Scythe Legs (4 Segmented Insectoid Limbs)
    ctx.strokeStyle = '#3E0A10';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Back Rear Leg
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.lineTo(-28 - walk, isPouncing ? -18 : -12);
    ctx.lineTo(-36 - walk * 0.6, isPouncing ? 10 : 22);
    ctx.stroke();

    // Front Leading Leg
    ctx.beginPath();
    ctx.moveTo(8, 3);
    ctx.lineTo(26 + walk, isPouncing ? -22 : -10);
    ctx.lineTo(34 + walk * 0.8, isPouncing ? 8 : 22);
    ctx.stroke();

    // Middle Secondary Legs
    ctx.strokeStyle = '#5C0D18';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-2, 5);
    ctx.lineTo(-18 + walk * 0.8, -16);
    ctx.lineTo(-24 + walk * 0.6, 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(2, 5);
    ctx.lineTo(18 - walk * 0.8, -16);
    ctx.lineTo(24 - walk * 0.6, 24);
    ctx.stroke();

    // Glowing Obsidian-Crimson Scythe Blade Tips
    this.setGlow(ctx, '#FF1744', 10);
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(-36 - walk * 0.6, isPouncing ? 10 : 22, 3, 0, Math.PI * 2);
    ctx.arc(34 + walk * 0.8, isPouncing ? 8 : 22, 3, 0, Math.PI * 2);
    ctx.fill();
    this.setGlow(ctx, '#000', 0);

    // 2. Sculpted Crimson Carapace Dome with Segmented Spine Plates
    const carapaceGrad = ctx.createLinearGradient(0, -22, 0, 12);
    carapaceGrad.addColorStop(0, '#FF1744');
    carapaceGrad.addColorStop(0.35, '#D50000');
    carapaceGrad.addColorStop(0.7, '#B71C1C');
    carapaceGrad.addColorStop(1, '#2E0207');

    ctx.fillStyle = carapaceGrad;
    ctx.beginPath();
    ctx.ellipse(0, -3, 25, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1A0104';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Chitin Ridge Spine Segments
    ctx.strokeStyle = 'rgba(255, 128, 128, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-16, -5); ctx.lineTo(-16, -1);
    ctx.moveTo(-8, -8); ctx.lineTo(-8, 2);
    ctx.moveTo(0, -10); ctx.lineTo(0, 4);
    ctx.moveTo(8, -8); ctx.lineTo(8, 2);
    ctx.stroke();

    // Predatory Snap Mandibles
    ctx.fillStyle = '#1A0104';
    ctx.beginPath();
    ctx.moveTo(14, 4); ctx.lineTo(24, 8); ctx.lineTo(18, 11); ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -2); ctx.lineTo(24, -6); ctx.lineTo(18, -3); ctx.closePath();
    ctx.fill();

    // 3. Multi-Ocular Glowing White Predator Sensor Cluster (5 Eyes)
    this.setGlow(ctx, '#FFFFFF', 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(8, -5, 3.5, 0, Math.PI * 2);
    ctx.arc(16, -4, 4.2, 0, Math.PI * 2);
    ctx.arc(21, -2, 3.0, 0, Math.PI * 2);
    ctx.arc(13, 2, 2.5, 0, Math.PI * 2);
    ctx.arc(19, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Small Cyan Pupil Points
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.arc(8, -5, 1.2, 0, Math.PI * 2);
    ctx.arc(16, -4, 1.5, 0, Math.PI * 2);
    ctx.arc(21, -2, 1.0, 0, Math.PI * 2);
    ctx.fill();
    this.setGlow(ctx, '#000', 0);

    // 4. Health Bar
    const hpRatio = Math.max(0, stalker.hp / stalker.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(-18, -26, 36, 5);
    ctx.fillStyle = '#FF1744';
    ctx.fillRect(-17, -25, 34 * hpRatio, 3);

    ctx.restore();
  }

  // Model 3: PHANTOM SLICER (Obsidian & Neon-Violet Buzzsaw Interceptor)
  drawPhantomSlicer(ctx, bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);

    const facingLeft = bot.facingLeft;
    if (facingLeft) ctx.scale(-1, 1);

    const spin = Date.now() * 0.03;

    // 1. Spinning Dual Buzzsaw Plasma Blades
    this.setGlow(ctx, '#E040FB', 12);
    ctx.fillStyle = '#E040FB';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;

    // Top Buzzsaw
    ctx.save();
    ctx.translate(-8, -18);
    ctx.rotate(spin);
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a + 0.5) * 4, Math.sin(a + 0.5) * 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Bottom Buzzsaw
    ctx.save();
    ctx.translate(-8, 18);
    ctx.rotate(-spin);
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.lineTo(Math.cos(a + 0.5) * 4, Math.sin(a + 0.5) * 4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    this.setGlow(ctx, '#000', 0);

    // 2. Aerodynamic Obsidian Delta-Wing Chassis
    const deltaGrad = ctx.createLinearGradient(-20, 0, 20, 0);
    deltaGrad.addColorStop(0, '#120024');
    deltaGrad.addColorStop(0.5, '#311B92');
    deltaGrad.addColorStop(1, '#651FFF');

    ctx.fillStyle = deltaGrad;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, -16);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#D500F9';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Neon Trim Inset
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-12, -10);
    ctx.moveTo(14, 0);
    ctx.lineTo(-12, 10);
    ctx.stroke();

    // Horizontal Scanning Tracker Visor
    this.setGlow(ctx, '#E040FB', 10);
    ctx.fillStyle = '#E040FB';
    ctx.fillRect(8, -2, 10, 4);
    this.setGlow(ctx, '#000', 0);

    // Health Bar
    const hpRatio = Math.max(0, bot.hp / bot.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(-18, -28, 36, 5);
    ctx.fillStyle = '#E040FB';
    ctx.fillRect(-17, -27, 34 * hpRatio, 3);

    ctx.restore();
  }

  // Model 4: GOLIATH MECH (Heavy Armor Boss Titan with Dual Autocannons)
  drawGoliathMech(ctx, bot) {
    ctx.save();
    ctx.translate(bot.x, bot.y);

    const facingLeft = bot.facingLeft;
    if (facingLeft) ctx.scale(-1, 1);

    // 1. Heavy Reinforced Shoulder Pauldrons & Missile Pods
    ctx.fillStyle = '#263238';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    // Top Missile Racks
    ctx.fillRect(-22, -26, 16, 12);
    ctx.strokeRect(-22, -26, 16, 12);
    // Missile Nose Cones
    ctx.fillStyle = '#FF3D00';
    ctx.beginPath();
    ctx.arc(-18, -26, 2.5, 0, Math.PI * 2);
    ctx.arc(-10, -26, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Dual Heavy Rotary Autocannon Barrels
    ctx.fillStyle = '#1A1E24';
    ctx.fillRect(18, -10, 22, 6);
    ctx.fillRect(18, 4, 22, 6);
    ctx.strokeStyle = '#FF3D00';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, -10, 22, 6);
    ctx.strokeRect(18, 4, 22, 6);

    // 3. Massive Armored Chassis with Hazard Stripes
    const mechGrad = ctx.createLinearGradient(-20, -20, 20, 20);
    mechGrad.addColorStop(0, '#455A64');
    mechGrad.addColorStop(0.5, '#263238');
    mechGrad.addColorStop(1, '#101417');

    ctx.fillStyle = mechGrad;
    ctx.beginPath();
    ctx.roundRect(-24, -20, 44, 40, 6);
    ctx.fill();
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Hazard Stripes on Lower Plate
    ctx.fillStyle = '#FFD600';
    ctx.fillRect(-18, 10, 32, 6);
    ctx.fillStyle = '#1A1A1A';
    for (let s = -18; s < 14; s += 8) {
      ctx.beginPath();
      ctx.moveTo(s, 16); ctx.lineTo(s + 4, 10); ctx.lineTo(s + 7, 10); ctx.lineTo(s + 3, 16);
      ctx.fill();
    }

    // 4. Glowing Red Cyclops Combat Visor & Reactor Core
    this.setGlow(ctx, '#FF1744', 14);
    ctx.fillStyle = '#FF1744';
    ctx.fillRect(4, -8, 16, 5);

    // Glowing Power Reactor Core
    ctx.beginPath();
    ctx.arc(-6, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FF3D00';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    this.setGlow(ctx, '#000', 0);

    // 5. Boss Health Bar (Large Double-Tier Bar)
    const hpRatio = Math.max(0, bot.hp / bot.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(-26, -36, 52, 7);
    ctx.fillStyle = '#FF3D00';
    ctx.fillRect(-25, -35, 50 * hpRatio, 5);
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 1;
    ctx.strokeRect(-26, -36, 52, 7);

    ctx.font = 'bold 9px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#FFD600';
    ctx.textAlign = 'center';
    ctx.fillText('GOLIATH TITAN', 0, -40);

    ctx.restore();
  }

  // Model 5: DELTA-1 PRIME (Friendly Tactical High-Combat Companion Drone)
  drawAICompanionPrime(ctx, comp) {
    ctx.save();
    ctx.translate(comp.x, comp.y);

    const facingLeft = comp.facingLeft;
    if (facingLeft) ctx.scale(-1, 1);

    const time = Date.now() * 0.003;

    // 1. Dual 3D Gyroscopic Holographic Shield Rings
    this.setGlow(ctx, '#00E5FF', 10);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 18, time, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(118, 255, 3, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 18, -time * 1.2, 0, Math.PI * 2);
    ctx.stroke();

    // Orbiting Energy Particle Nodes
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.arc(Math.cos(time) * 34, Math.sin(time) * 18, 3, 0, Math.PI * 2);
    ctx.arc(Math.cos(-time * 1.2) * 34, Math.sin(-time * 1.2) * 18, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 2. Cyan Plasma Jet Thruster
    const flameSize = 6 + Math.sin(Date.now() * 0.03) * 3;
    const flameGrad = ctx.createLinearGradient(0, 10, 0, 12 + flameSize * 2);
    flameGrad.addColorStop(0, '#00E5FF');
    flameGrad.addColorStop(0.6, '#76FF03');
    flameGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 12 + flameSize * 2);
    ctx.closePath();
    ctx.fill();

    // 3. Sleek Aerodynamic Cyber-Cyan & Carbon Shell
    const shellGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
    shellGrad.addColorStop(0, '#E0F7FA');
    shellGrad.addColorStop(0.4, '#00E5FF');
    shellGrad.addColorStop(0.8, '#0097A7');
    shellGrad.addColorStop(1, '#006064');

    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Top Pulse Laser Cannon
    ctx.fillStyle = '#263238';
    ctx.fillRect(10, -5, 14, 4);
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(22, -6, 3, 6);

    // 4. Glowing Optical Visor & Status Sensor
    this.setGlow(ctx, '#76FF03', 12);
    ctx.fillStyle = '#76FF03';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(2, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    this.setGlow(ctx, '#000', 0);

    // 5. Callsign & Health Bar
    const hpRatio = Math.max(0, comp.hp / comp.maxHp);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(-18, -28, 36, 5);
    ctx.fillStyle = '#00E676';
    ctx.fillRect(-17, -27, 34 * hpRatio, 3);

    ctx.font = 'bold 10px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#00E5FF';
    ctx.textAlign = 'center';
    ctx.fillText('DELTA-1 [AI PRIME]', 0, -32);

    ctx.restore();
  }

  updateHUD() {
    const p = this.localPlayer;
    const hpRounded = Math.max(0, Math.round(p.hp));
    if (this.lastRenderedHp !== hpRounded) {
      this.lastRenderedHp = hpRounded;
      if (this.hudHpFill) this.hudHpFill.style.width = `${hpRounded}%`;
      if (this.hudHpVal) this.hudHpVal.textContent = hpRounded;
    }

    // Toggle Emergency Low-HP Vignette
    if (this.lowHpVignette) {
      if (p.hp > 0 && p.hp < 30 && !p.isDead && this.screens.game && this.screens.game.classList.contains('active')) {
        this.lowHpVignette.classList.remove('hidden');
      } else {
        this.lowHpVignette.classList.add('hidden');
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new MultiplayerGameApp();
});
