#include "GameEngine.hpp"

namespace MiniMilitia {

void GameEngine::update(float moveX, float thrustY, float aimRad, bool shootRequested, float dt) {
    // 1. Update Local Player with Infinite Jetpack Flight
    localPlayer.update(moveX, thrustY, aimRad, dt);
    arena.resolveSoldierCollision(localPlayer.position, localPlayer.velocity, localPlayer.isGrounded, JetpackSoldier::SOLDIER_RADIUS);

    // 2. Continuous Infinite Primary Weapon Fire
    if (shootRequested && localPlayer.canFirePrimary()) {
        localPlayer.resetShootCooldown();
        auto profile = getWeaponProfile(localPlayer.primaryWeapon);

        for (uint8_t i = 0; i < profile.pelletsPerShot; ++i) {
            float spread = (static_cast<float>(rand()) / static_cast<float>(RAND_MAX) - 0.5f) * profile.spreadRad;
            float finalAngle = aimRad + spread;

            ActiveBullet b;
            b.ownerId = localPlayer.playerId;
            b.pos = localPlayer.position + Vec2{std::cos(finalAngle) * 22.0f, std::sin(finalAngle) * 22.0f};
            b.vel = Vec2{std::cos(finalAngle) * profile.bulletSpeed, std::sin(finalAngle) * profile.bulletSpeed};
            b.damage = profile.damage;
            b.lifeSec = 1.6f;
            b.active = true;
            bullets.push_back(b);
        }
    }

    // 3. Update Projectiles with Platform & Obstacle Collision
    updateProjectiles(dt);
    updateTacticals(dt);

    // 4. Check Pickup Crates
    checkPickupCollisions();
}

void GameEngine::throwGrenade(Vec2 origin, float aimAngle, float power) {
    if (!localPlayer.tacticalGear.useGrenade()) return;

    ActiveGrenade g;
    g.id = static_cast<uint32_t>(rand());
    g.ownerId = localPlayer.playerId;
    g.pos = origin + Vec2{std::cos(aimAngle) * 25.0f, std::sin(aimAngle) * 25.0f};
    g.vel = Vec2{std::cos(aimAngle) * (power * 0.40f), std::sin(aimAngle) * (power * 0.40f) - 1.6f};
    g.fuseTimerSec = 2.0f;
    g.exploded = false;
    grenades.push_back(g);
}

void GameEngine::plantMine(Vec2 origin) {
    if (!localPlayer.tacticalGear.useMine()) return;

    ActiveMine m;
    m.id = static_cast<uint32_t>(rand());
    m.ownerId = localPlayer.playerId;
    m.teamId = static_cast<uint8_t>(localPlayer.team);
    m.pos = origin + Vec2{0.0f, 15.0f};
    m.armTimerSec = 1.0f;
    m.isArmed = false;
    m.detonated = false;
    landmines.push_back(m);
}

void GameEngine::throwSmoke(Vec2 origin, float aimAngle, float power) {
    if (!localPlayer.tacticalGear.useSmoke()) return;

    ActiveSmokeCloud s;
    s.id = static_cast<uint32_t>(rand());
    s.pos = origin + Vec2{std::cos(aimAngle) * power * 15.0f, std::sin(aimAngle) * power * 15.0f};
    s.lifeSec = 8.0f;
    s.maxLifeSec = 8.0f;
    s.radius = 75.0f;
    s.expired = false;
    smokeClouds.push_back(s);
}

void GameEngine::updateProjectiles(float dt) {
    for (auto it = bullets.begin(); it != bullets.end();) {
        it->update(dt);
        if (!it->active) {
            it = bullets.erase(it);
            continue;
        }

        // Platform & Obstacle Collision Check (Bullets CANNOT penetrate solid platforms)
        bool hitObstacle = false;
        for (const auto& plat : arena.platforms) {
            if (plat.contains(it->pos)) {
                hitObstacle = true;
                break;
            }
        }

        if (hitObstacle) {
            it = bullets.erase(it);
            continue;
        }

        // Check collision with remote players
        bool hitPlayer = false;
        for (auto& [id, rp] : remotePlayers) {
            if (rp.health > 0.0f && it->ownerId != rp.playerId) {
                if (Vec2::distance(it->pos, rp.position) <= JetpackSoldier::SOLDIER_RADIUS) {
                    rp.takeDamage(it->damage);
                    hitPlayer = true;
                    break;
                }
            }
        }

        if (hitPlayer) {
            it = bullets.erase(it);
        } else {
            ++it;
        }
    }
}

void GameEngine::updateTacticals(float dt) {
    // 1. Grenades (Platform bouncing)
    for (auto it = grenades.begin(); it != grenades.end();) {
        it->update(dt);

        // Check platform bounce
        for (const auto& plat : arena.platforms) {
            if (plat.contains(it->pos)) {
                it->vel.y = -it->vel.y * 0.55f;
                it->vel.x *= 0.75f;
                it->pos.y = plat.y - 4.0f;
                break;
            }
        }

        if (it->exploded) {
            applyExplosionDamage(it->pos, ActiveGrenade::BLAST_RADIUS, ActiveGrenade::MAX_DAMAGE, it->ownerId);
            it = grenades.erase(it);
        } else {
            ++it;
        }
    }

    // 2. Proximity Landmines
    for (auto it = landmines.begin(); it != landmines.end();) {
        it->update(dt);
        bool triggered = false;

        if (it->checkTrigger(localPlayer.position, static_cast<uint8_t>(localPlayer.team))) {
            triggered = true;
        }

        for (const auto& [id, rp] : remotePlayers) {
            if (it->checkTrigger(rp.position, static_cast<uint8_t>(rp.team))) {
                triggered = true;
                break;
            }
        }

        if (triggered || it->detonated) {
            applyExplosionDamage(it->pos, ActiveMine::BLAST_RADIUS, ActiveMine::MAX_DAMAGE, it->ownerId);
            it = landmines.erase(it);
        } else {
            ++it;
        }
    }

    // 3. Smoke Clouds
    for (auto it = smokeClouds.begin(); it != smokeClouds.end();) {
        it->update(dt);
        if (it->expired) {
            it = smokeClouds.erase(it);
        } else {
            ++it;
        }
    }
}

void GameEngine::checkPickupCollisions() {
    for (auto& pk : arena.pickups) {
        if (pk.available) {
            if (Vec2::distance(localPlayer.position, pk.pos) <= MapPickup::PICKUP_RADIUS + JetpackSoldier::SOLDIER_RADIUS) {
                pk.available = false;
                pk.respawnTimerSec = MapPickup::RESPAWN_TIME_SEC;

                if (pk.type == PickupType::GRENADE_CRATE) localPlayer.tacticalGear.addPickup(TacticalType::FRAG_GRENADE, 2);
                else if (pk.type == PickupType::MINE_CRATE) localPlayer.tacticalGear.addPickup(TacticalType::PROXIMITY_MINE, 1);
                else if (pk.type == PickupType::SMOKE_CRATE) localPlayer.tacticalGear.addPickup(TacticalType::SMOKE_BOMB, 1);
                else if (pk.type == PickupType::MEDKIT) localPlayer.health = std::min(100.0f, localPlayer.health + 50.0f);
            }
        }
    }
}

void GameEngine::applyExplosionDamage(Vec2 center, float radius, float maxDamage, uint32_t /*attackerId*/) {
    float dist = Vec2::distance(center, localPlayer.position);
    if (dist <= radius) {
        float falloff = 1.0f - (dist / radius);
        localPlayer.takeDamage(maxDamage * falloff);
    }
}

} // namespace MiniMilitia
