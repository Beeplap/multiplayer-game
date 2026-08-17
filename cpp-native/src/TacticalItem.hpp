#pragma once
#include <cstdint>
#include <vector>
#include "Math2D.hpp"

namespace MiniMilitia {

// Tactical Consumables (Finite ammo items)
enum class TacticalType : uint8_t {
    FRAG_GRENADE   = 0,
    PROXIMITY_MINE = 1,
    SMOKE_BOMB     = 2,
    RPG_ROCKET     = 3
};

// Player Consumable Inventory (Finite items with capacities)
struct TacticalInventory {
    int8_t grenades = 2;       // Max 4
    int8_t proximityMines = 1; // Max 3
    int8_t smokeBombs = 1;     // Max 3
    int8_t rpgRockets = 0;     // Max 3

    static constexpr int8_t MAX_GRENADES = 4;
    static constexpr int8_t MAX_MINES = 3;
    static constexpr int8_t MAX_SMOKE = 3;
    static constexpr int8_t MAX_RPG = 3;

    bool useGrenade() {
        if (grenades > 0) { grenades--; return true; }
        return false;
    }

    bool useMine() {
        if (proximityMines > 0) { proximityMines--; return true; }
        return false;
    }

    bool useSmoke() {
        if (smokeBombs > 0) { smokeBombs--; return true; }
        return false;
    }

    bool useRpg() {
        if (rpgRockets > 0) { rpgRockets--; return true; }
        return false;
    }

    void addPickup(TacticalType type, int8_t count = 2) {
        switch (type) {
            case TacticalType::FRAG_GRENADE:
                grenades = std::min(MAX_GRENADES, static_cast<int8_t>(grenades + count));
                break;
            case TacticalType::PROXIMITY_MINE:
                proximityMines = std::min(MAX_MINES, static_cast<int8_t>(proximityMines + count));
                break;
            case TacticalType::SMOKE_BOMB:
                smokeBombs = std::min(MAX_SMOKE, static_cast<int8_t>(smokeBombs + count));
                break;
            case TacticalType::RPG_ROCKET:
                rpgRockets = std::min(MAX_RPG, static_cast<int8_t>(rpgRockets + count));
                break;
        }
    }
};

// Active Frag Grenade in Flight
struct ActiveGrenade {
    uint32_t id = 0;
    uint32_t ownerId = 0;
    Vec2 pos;
    Vec2 vel;
    float fuseTimerSec = 2.0f; // Explodes when reaches 0
    bool exploded = false;
    static constexpr float BLAST_RADIUS = 80.0f;
    static constexpr float MAX_DAMAGE = 95.0f;

    void update(float dt) {
        if (exploded) return;
        vel.y += 0.45f; // Gravity
        pos += vel;
        vel.x *= 0.98f;
        fuseTimerSec -= dt;
        if (fuseTimerSec <= 0.0f) {
            exploded = true;
        }
    }
};

// Active Planted Proximity Mine
struct ActiveMine {
    uint32_t id = 0;
    uint32_t ownerId = 0;
    uint8_t teamId = 0;
    Vec2 pos;
    float armTimerSec = 1.0f; // Arms after 1 sec
    bool isArmed = false;
    bool detonated = false;
    static constexpr float TRIGGER_RADIUS = 45.0f;
    static constexpr float BLAST_RADIUS = 90.0f;
    static constexpr float MAX_DAMAGE = 100.0f; // Instant lethal

    void update(float dt) {
        if (detonated) return;
        if (!isArmed) {
            armTimerSec -= dt;
            if (armTimerSec <= 0.0f) isArmed = true;
        }
    }

    bool checkTrigger(const Vec2& enemyPos, uint8_t enemyTeam) {
        if (!isArmed || detonated) return false;
        if (enemyTeam != teamId) {
            if (Vec2::distance(pos, enemyPos) <= TRIGGER_RADIUS) {
                detonated = true;
                return true;
            }
        }
        return false;
    }
};

// Active Smoke Cloud Node
struct ActiveSmokeCloud {
    uint32_t id = 0;
    Vec2 pos;
    float lifeSec = 8.0f;
    float maxLifeSec = 8.0f;
    float radius = 70.0f;
    bool expired = false;

    void update(float dt) {
        if (expired) return;
        lifeSec -= dt;
        if (lifeSec <= 0.0f) expired = true;
    }

    bool isInSmoke(const Vec2& pt) const {
        return !expired && Vec2::distance(pos, pt) <= radius;
    }
};

} // namespace MiniMilitia
