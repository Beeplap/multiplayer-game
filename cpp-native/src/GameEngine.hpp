#pragma once
#include <vector>
#include <unordered_map>
#include <memory>
#include "Math2D.hpp"
#include "JetpackSoldier.hpp"
#include "TacticalItem.hpp"
#include "WeaponSystem.hpp"
#include "MapArena.hpp"

namespace MiniMilitia {

class GameEngine {
public:
    JetpackSoldier localPlayer;
    std::unordered_map<uint32_t, JetpackSoldier> remotePlayers;

    std::vector<ActiveBullet> bullets;
    std::vector<ActiveGrenade> grenades;
    std::vector<ActiveMine> landmines;
    std::vector<ActiveSmokeCloud> smokeClouds;

    MapArena arena;
    uint32_t redScore = 0;
    uint32_t blueScore = 0;

    void init() {
        arena.initOutpostBunker();
        localPlayer.position = Vec2{300.0f, 400.0f};
        localPlayer.health = 100.0f;
    }

    void update(float moveX, float thrustY, float aimRad, bool shootRequested, float dt);
    void throwGrenade(Vec2 origin, float aimAngle, float power = 14.0f);
    void plantMine(Vec2 origin);
    void throwSmoke(Vec2 origin, float aimAngle, float power = 10.0f);

private:
    void updateProjectiles(float dt);
    void updateTacticals(float dt);
    void checkPickupCollisions();
    void applyExplosionDamage(Vec2 center, float radius, float maxDamage, uint32_t attackerId);
};

} // namespace MiniMilitia
