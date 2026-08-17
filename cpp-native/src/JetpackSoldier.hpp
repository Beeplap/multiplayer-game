#pragma once
#include "Math2D.hpp"
#include "TacticalItem.hpp"
#include "WeaponSystem.hpp"
#include "LobbyProtocol.hpp"

namespace MiniMilitia {

class JetpackSoldier {
public:
    uint32_t playerId = 0;
    Vec2 position{200.0f, 300.0f};
    Vec2 velocity{0.0f, 0.0f};
    float aimAngle = 0.0f;

    float health = 100.0f;
    float maxHealth = 100.0f;
    bool isGrounded = false;
    bool isFlying = false;
    Team team = Team::RED;

    // Loadout
    PrimaryWeapon primaryWeapon = PrimaryWeapon::DUAL_UZI;
    TacticalInventory tacticalGear;
    float shootCooldownTimer = 0.0f;

    // Physics Constants
    static constexpr float GRAVITY = 0.46f;
    static constexpr float JETPACK_THRUST = 1.12f; // Infinite thrust power!
    static constexpr float MOVE_SPEED = 0.88f;
    static constexpr float AIR_FRICTION = 0.90f;
    static constexpr float MAX_VERTICAL_SPEED = 9.0f;
    static constexpr float SOLDIER_RADIUS = 16.0f;

    void update(float moveX, float thrustY, float aimRad, float dt) {
        if (health <= 0.0f) return;

        // 1. Horizontal Propulsion
        velocity.x += moveX * MOVE_SPEED;
        velocity.x *= AIR_FRICTION;

        // 2. Continuous Jetpack Thrust (NEVER EMPTIES)
        velocity.y += GRAVITY;

        if (thrustY < -0.2f) {
            velocity.y -= JETPACK_THRUST;
            // Clamp upward max velocity
            velocity.y = std::max(-MAX_VERTICAL_SPEED, velocity.y);
            isFlying = true;
        } else {
            isFlying = false;
        }

        // Apply Position
        position += velocity;
        aimAngle = aimRad;

        if (shootCooldownTimer > 0.0f) {
            shootCooldownTimer -= dt;
        }
    }

    bool canFirePrimary() const {
        return health > 0.0f && shootCooldownTimer <= 0.0f;
    }

    void resetShootCooldown() {
        shootCooldownTimer = getWeaponProfile(primaryWeapon).fireIntervalSec;
    }

    void takeDamage(float amount) {
        health = std::max(0.0f, health - amount);
    }

    void respawn(Vec2 spawnPos) {
        position = spawnPos;
        velocity = {0.0f, 0.0f};
        health = maxHealth;
        tacticalGear.grenades = 2;
        tacticalGear.proximityMines = 1;
        tacticalGear.smokeBombs = 1;
    }
};

} // namespace MiniMilitia
