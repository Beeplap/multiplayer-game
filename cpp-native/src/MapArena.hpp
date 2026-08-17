#pragma once
#include <vector>
#include "Math2D.hpp"
#include "TacticalItem.hpp"

namespace MiniMilitia {

enum class PickupType : uint8_t {
    GRENADE_CRATE = 0,
    MINE_CRATE    = 1,
    SMOKE_CRATE   = 2,
    MEDKIT        = 3
};

struct MapPickup {
    uint32_t id = 0;
    PickupType type = PickupType::GRENADE_CRATE;
    Vec2 pos;
    bool available = true;
    float respawnTimerSec = 0.0f;
    static constexpr float RESPAWN_TIME_SEC = 15.0f;
    static constexpr float PICKUP_RADIUS = 20.0f;

    void update(float dt) {
        if (!available) {
            respawnTimerSec -= dt;
            if (respawnTimerSec <= 0.0f) {
                available = true;
            }
        }
    }
};

class MapArena {
public:
    std::vector<Rect2D> platforms;
    std::vector<MapPickup> pickups;

    void initOutpostBunker() {
        platforms.clear();
        pickups.clear();

        // 1. Ground and World Boundaries
        platforms.push_back(Rect2D{0.0f, 720.0f, 2400.0f, 120.0f});

        // 2. Left Bunker (Multi-Tier Platform)
        platforms.push_back(Rect2D{160.0f, 540.0f, 320.0f, 24.0f});
        platforms.push_back(Rect2D{220.0f, 380.0f, 200.0f, 24.0f});

        // 3. Central Tactical Tower
        platforms.push_back(Rect2D{700.0f, 460.0f, 360.0f, 24.0f});
        platforms.push_back(Rect2D{800.0f, 300.0f, 160.0f, 24.0f});

        // 4. Right Bunker (Multi-Tier Platform)
        platforms.push_back(Rect2D{1280.0f, 540.0f, 320.0f, 24.0f});
        platforms.push_back(Rect2D{1340.0f, 380.0f, 200.0f, 24.0f});

        // 5. Place Tactical Pickup Crates
        pickups.push_back(MapPickup{1, PickupType::GRENADE_CRATE, Vec2{880.0f, 280.0f}, true, 0.0f});
        pickups.push_back(MapPickup{2, PickupType::MINE_CRATE, Vec2{320.0f, 360.0f}, true, 0.0f});
        pickups.push_back(MapPickup{3, PickupType::SMOKE_CRATE, Vec2{1440.0f, 360.0f}, true, 0.0f});
        pickups.push_back(MapPickup{4, PickupType::MEDKIT, Vec2{880.0f, 440.0f}, true, 0.0f});
    }

    void resolveSoldierCollision(Vec2& pos, Vec2& vel, bool& isGrounded, float radius) const {
        isGrounded = false;
        for (const auto& plat : platforms) {
            // Check top surface landing
            if (pos.x + radius > plat.x && pos.x - radius < plat.x + plat.w) {
                if (pos.y + radius >= plat.y && pos.y + radius <= plat.y + 20.0f && vel.y >= 0.0f) {
                    pos.y = plat.y - radius;
                    vel.y = 0.0f;
                    isGrounded = true;
                    return;
                }
            }
        }
    }
};

} // namespace MiniMilitia
