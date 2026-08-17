# 🎮 WEGETHER — 2D Tactical Multiplayer Combat Warzone

[![Status](https://img.shields.io/badge/Status-Live%20Multiplayer-00E5FF?style=for-the-badge)](https://multiplayer-game-vq8m.onrender.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](#)
[![Tech](https://img.shields.io/badge/Stack-Node.js%20%7C%20WebSockets%20%7C%20HTML5%20Canvas-FF7B00?style=for-the-badge)](#)

> **Play Live Online**: **[https://multiplayer-game-vq8m.onrender.com/](https://multiplayer-game-vq8m.onrender.com/)**  
> Or host locally on your home Wi-Fi for ultra-low latency **1–5ms LAN battles**!

---

## 🌟 Game Overview

**WEGETHER** is a high-octane, fast-paced 2D tactical multiplayer jetpack shooter. Engage in real-time mid-air dogfights, deploy tactical explosives, unleash yellow toxic chemical gas, snipe across organic sloped islands with dynamic optical scopes, and claim legendary weapons inside the heavy timber Outpost Bunker.

---

## ⚡ Core Features & Combat Mechanics

### 1. 🚀 Infinite Jetpack Flight
* **Unlimited Propulsion**: Your jetpack never runs dry. Take flight instantly by holding `W`, `Space`, `Up Arrow`, or dragging the left touch joystick upwards.
* **Tactical Physics**: Counteracts smooth gravity ($g = 0.20$) with controlled vertical lift ($T = 0.44$), aerodynamic air gliding, and grounded foot traction for agile maneuvering.

### 2. 🔫 Infinite Primary Weapons & Ground Drops
* Standard weapons have **infinite ammunition** with unique ballistic spreads, bullet velocities, and damage profiles:
  * **⚡ Micro-Uzi SMG**: Rapid suppression rate of fire with high mobility (110ms fire rate).
  * **💥 Combat Shotgun**: Heavy 6-pellet kinetic spread burst for devastating close-quarters combat.
  * **🎯 Marksman Sniper**: High-velocity armor-piercing tracer round with pinpoint accuracy.
  * **🚀 RPG Rocket Launcher**: Legendary heavy warhead spawned in the central Wooden Outpost with massive screen-shake explosive blast radius ($95\text{px}$).

### 3. 💣 Tactical Consumables & Deployables
Players spawn with tactical equipment and can replenish supplies by collecting supply crates scattered across the battlefield:

| Tactical Item | Key / Action | Behavior & Combat Impact |
| :--- | :---: | :--- |
| **💣 Frag Grenade** | `G` / 💣 Tap | Thrown in a high-arc ballistic trajectory. Bounces realistically off curved slopes and explodes after 2.0s fuse or direct body impact ($85\text{px}$ lethal radius). |
| **⚡ Proximity Landmine** | `F` / ⚡ Tap | Deploys on sloped terrain, cave ceilings, or bunker walls. Triggers instantaneous detonation upon direct airborne body contact or proximity trigger. |
| **☣️ Toxic Mustard Gas** | `C` / ☣️ Tap | Shatters on impact into an expanding, persistent yellow toxic chemical cloud ($140\text{px}$) dealing continuous damage over 8 seconds. |
| **❤️ Medical Crate** | World Pickup | Instantly restores soldier HP back to 100%. |

### 4. 🔍 Dynamic 1x–4x Zoom & Optical Scopes
* **Zoom Toggle**: Press `Left Shift` on PC or tap the on-screen **`🔍 ZOOM`** HUD badge to cycle field of view.
* **Weapon-Capped Dynamic Optics**:
  * **Sniper Rifle**: Full **1x $\to$ 2x $\to$ 3x $\to$ 4x** ultra long-range optic.
  * **RPG Launcher**: Up to **3x** tactical artillery zoom.
  * **SMG & Shotgun**: Locked at tactical **1x** field-of-view for optimal CQB awareness.

### 5. 🏝️ Handcrafted Natural Warzone Map
* **🪵 3D Textured Wooden Outpost**: Heavy interlocking cylindrical logs, 3 bunker windows overlooking the mountain backdrop, hanging golden lantern, and central weapon pedestal.
* **🪨 Organic Sloped Islands**: Natural curved bowl undersides, 16+ embedded faceted polygon rocks, and lush jagged comic grass following the terrain contours.
* **🌴 Scenery & Foliage**: Tall cartoon palm trees with scaly diamond bark, faceted surface boulders, and multi-layered parallax mountain vistas.

---

## 🎮 Game Controls

### 💻 PC Keyboard & Mouse

| Action | Key / Control |
| :--- | :--- |
| **Move Left / Right** | `A` / `D` or `Left` / `Right Arrow` |
| **Jetpack Thrust (Fly)** | `W`, `Space`, or `Up Arrow` (Infinite Gas) |
| **Fast Fall / Descend** | `S` or `Down Arrow` |
| **Aim & Crosshair** | Move Mouse (360° Tactical Crosshair) |
| **Fire Active Weapon** | Left Mouse Button (Hold for automatic fire) |
| **Throw Frag Grenade** | `G` |
| **Plant Proximity Mine** | `F` |
| **Deploy Toxic Mustard Gas**| `C` |
| **Equip Ground Weapon** | `E` (When near glowing ground weapon drop) |
| **Toggle Dynamic Zoom** | `Left Shift` (Cycles 1x $\to$ 2x $\to$ 3x $\to$ 4x) |
| **Select Tactical Slot** | `1` (Grenade) / `2` (Mine) / `3` (Toxic Gas) |

---

### 📱 Mobile & Tablet (Touchscreen)

* **Automatic Landscape Orientation**: Prompts rotation to landscape for tactical dual-stick gameplay.
* **Left Virtual Joystick**: Fluid 360° soldier movement, ground walking, and jetpack vertical ascent.
* **Right Virtual Joystick**: Precision 360° aiming and instant auto-fire when pushed.
* **Dedicated Tactical Buttons**: On-screen buttons for Frag Grenades, Proximity Mines, Toxic Gas, Weapon Swap (`[E] EQUIP`), and Zoom.

---

## 🔑 Multiplayer Lobby Modes

WEGETHER supports 5-digit private room codes (e.g. `K9X2P`, `H7M3Q`):

* **⚔️ DUEL Mode (1v1, 1v1v1, FFA)**:
  * Free-for-all deathmatch supporting 2, 3, 4+ players.
  * Every soldier is assigned a unique callsign color (Red, Blue, Green, Gold, Purple, Cyan).
  * First fighter to reach the kill limit wins the match.
* **🛡️ 2v2 Team Deathmatch (TDM)**:
  * 🔴 Red Team vs 🔵 Blue Team tactical warfare.
  * Shared team score counter and coordinated bunker sieges.

---

## 🚀 Quick Start & Local Setup

### 1. Clone & Install
```bash
git clone https://github.com/Beeplap/multiplayer-game.git
cd multiplayer-game/server
npm install
```

### 2. Start the Server
```bash
npm start
```
The server will automatically display:
```
=======================================================
🚀 WEGETHER — 2D MULTIPLAYER TACTICAL SERVER
💻 Localhost URL:    http://localhost:3000
📱 LAN / Wi-Fi URL:  http://192.168.1.X:3000  (⚡ 1-5ms Ping!)
🛡️ TCP NoDelay & Sub-Millisecond Heartbeat Active
=======================================================
```

### 3. Play Locally
* Open `http://localhost:3000` in your web browser.
* Share your LAN Wi-Fi URL (e.g. `http://192.168.1.X:3000`) with friends on the same home Wi-Fi to play with sub-5ms ping!

---

## 🏛️ System Architecture

```
multiplayer-game/
├── README.md                      # Complete game documentation & guide
├── ARCHITECTURE.md                # Network packet schemas and architecture
├── server/                        # Node.js WebSocket Game & Relay Server
│   ├── server.js                  # 5-digit room manager, TCP NoDelay, low-latency relay
│   ├── package.json
│   ├── Dockerfile                 # Cloud container deployment
│   └── render.yaml                # Free 24/7 Render cloud deployment
├── client-web/                    # High-fidelity HTML5 Canvas web client
│   ├── index.html                 # Lobby interface & game canvas
│   ├── style.css                  # Military glassmorphic HUD styling & virtual joysticks
│   ├── game.js                    # 60fps physics, CCD collision, zoom system & rendering
│   └── assets/                    # Warzone audio and background imagery
└── cpp-native/                    # C++20 Native Engine (OpenGL ES / Android NDK)
    ├── CMakeLists.txt
    └── src/                       # Math2D, JetpackSoldier, WeaponSystem, MapArena
```

---

## 🛡️ Netcode & Performance Highlights

* **Continuous Swept-Raycast Collision Detection (CCD)**: Eliminates high-speed bullet tunneling through thin terrain surfaces.
* **Snapshot Interpolation Jitter Buffer**: Smooth 60 FPS remote soldier movement without desync or teleportation.
* **TCP NoDelay (Nagle's Algorithm Disabled)**: Sub-millisecond packet delivery for competitive responsiveness.
* **Live RTT Ping HUD**: Constant heartbeat latency monitoring with green (`<70ms`), yellow (`70-150ms`), and red (`>150ms`) indicators.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE). Built for high-performance tactical multiplayer gaming.
