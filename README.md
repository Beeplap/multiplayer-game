# 🎮 Mini Militia 2D — Master Game Design & Blueprint

High-performance, C++ native 2D multiplayer tactical shooter inspired by **Doodle Army 2: Mini Militia**.

---

## ⚡ Core Gameplay Rules & Combat Balance

### 1. 🚀 Infinite Jetpack Flight (Never Empties)
* **Flight Mechanics**: Continuous jetpack thrust whenever movement/thrust joystick or key is held.
* **Physics Model**:
  * Upward thrust counteracts gravity with terminal upward velocity ($v_{y,\text{max}} = -9.0\text{ px/tick}$).
  * Dynamic air drag and inertia ($0.89$ horizontal damping).
  * Unlimited gas — players can perform mid-air dogfights and hover sniping indefinitely!

### 2. 🔫 Infinite Primary Ammo (Never Empties)
* **Standard Weapons** have **unlimited ammunition** with unique fire rates and spreads:
  * **Dual SMG / Uzi**: High rate of fire (110ms cycle), light bullet spread.
  * **Combat Shotgun**: 6-pellet spread burst per shot (380ms cycle), devastating at close range.
  * **Marksman Sniper**: High-velocity armor-piercing tracer round (650ms cycle), precision laser.
  * **Service Pistol**: Reliable semi-automatic sidearm.

### 3. 💣 Finite Tactical Consumables & Explosives (Can Empty)
Players spawn with a limited loadout of tactical items and must collect crates around the map:

| Tactical Item | Starting Count | Max Capacity | Behavior & Combat Impact |
| :--- | :---: | :---: | :--- |
| **💣 Frag Grenade** | 2 | 4 | Thrown with arc trajectory. Bounces on surfaces and explodes after a 2.0s fuse or direct enemy hit ($80\text{ px}$ lethal radius). |
| **⚡ Proximity Landmine** | 1 | 3 | Planted onto floors, ceilings, or bunker walls. Arms after 1.0s. Detonates with huge damage when an enemy flies nearby ($50\text{ px}$ proximity trigger). |
| **💨 Smoke Bomb** | 1 | 3 | Spawns a thick volumetric particle cloud ($140\text{ px}$ diameter) lasting 8 seconds that conceals soldiers and obscures enemy laser sightlines. |
| **🚀 RPG Rocket Launcher** | 0 (Pickup) | 3 | Fires a high-velocity direct-line explosive warhead with screen-shake impact. |

---

## 🔑 5-Digit Private Lobby System

* **Room Code Format**: 5-character alphanumeric string excluding ambiguous characters (e.g. `K9X2P`, `H7M3Q`).
* **Game Modes**:
  * **1v1 Duel**: Sudden death duel (First to 5 or 10 kills).
  * **2v2 Team Deathmatch (TDM)**: 🔴 Red Team vs 🔵 Blue Team with combined team kill target.
  * **1v1v1v1 Free For All (FFA)**: 4 to 8 players free-for-all deathmatch arena.
* **Host Privileges**: Room creator can select map, match duration, kill limits, and launch the match.

---

## 🏛️ System Architecture

```
multiplayer-game/
├── README.md                      # Game rules, mechanics, and hosting guide
├── ARCHITECTURE.md                # Network packet schemas and C++ engine design
├── server/                        # Node.js WebSocket Lobby & Real-Time Relay Server
│   ├── server.js                  # 5-digit room manager, tactical item sync, match relay
│   ├── package.json
│   ├── Dockerfile                 # Cloud container deployment
│   └── render.yaml                # 1-click free 24/7 deployment on Render.com
├── client-web/                    # High-fidelity visual client & testing harness
│   ├── index.html                 # Private lobby UI + tactical HUD + 2D arena
│   ├── style.css                  # Military cyberpunk UI styling & touch joysticks
│   └── game.js                    # Infinite jetpack & ammo + Grenade/Mine/Smoke weapon engine
└── cpp-native/                    # C++20 Native Android NDK Engine
    ├── CMakeLists.txt             # NDK CMake build configuration
    ├── src/
    │   ├── main.cpp               # Android NativeActivity entry point
    │   ├── Math2D.hpp             # High-speed vector math & collision tests
    │   ├── LobbyProtocol.hpp      # Compact binary packet serialization
    │   ├── JetpackSoldier.hpp     # Infinite jetpack physics & dual-stick aiming
    │   ├── TacticalItem.hpp       # Grenades, Proximity Mines, and Smoke Bomb simulation
    │   └── WeaponSystem.hpp       # Infinite primary weapons & bullet trajectories
    └── android-project/           # Gradle build harness to generate .apk
```
