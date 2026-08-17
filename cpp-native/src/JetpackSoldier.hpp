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

    // Physics Constants (Realistic Jetpack Simulation & Normal Walking Pace)
    static constexpr float GRAVITY = 0.13f;
    static constexpr float JETPACK_THRUST = 0.27f; // Real thrust curve (counteracts 0.13g with gentle 0.14 lift)
    static constexpr float GROUND_ACCEL = 0.35f;
    static constexpr float GROUND_FRICTION = 0.72f;
    static constexpr float AIR_ACCEL = 0.14f;
    static constexpr float AIR_DRAG = 0.93f;
    static constexpr float MAX_GROUND_SPEED = 1.9f;
    static constexpr float MAX_AIR_SPEED = 2.2f;
    static constexpr float MAX_VERTICAL_SPEED = 2.2f;
    static constexpr float MAX_FALL_SPEED = 3.2f;
    static constexpr float SOLDIER_RADIUS = 16.0f;

    void update(float moveX, float thrustY, float aimRad, float dt) {
        if (health <= 0.0f) return;

        // 1. Horizontal Dynamics (Separated Ground Traction vs Air Thrusters)
        if (isGrounded) {
            velocity.x += moveX * GROUND_ACCEL;
            velocity.x *= GROUND_FRICTION;
            velocity.x = std::max(-MAX_GROUND_SPEED, std::min(MAX_GROUND_SPEED, velocity.x));
        } else {
            velocity.x += moveX * AIR_ACCEL;
            velocity.x *= AIR_DRAG;
            velocity.x = std::max(-MAX_AIR_SPEED, std::min(MAX_AIR_SPEED, velocity.x));
        }

        // 2. Real Jetpack Flight Simulation (Balanced thrust-to-weight ratio)
        velocity.y += GRAVITY;

        if (thrustY < -0.2f) {
            float thrustMag = std::min(1.0f, std::abs(thrustY));
            velocity.y -= JETPACK_THRUST * thrustMag;
            // Clamp upward max velocity (gentle climb rate)
            velocity.y = std::max(-MAX_VERTICAL_SPEED, velocity.y);
            isFlying = true;
        } else {
            isFlying = false;
        }

        // Clamp downward terminal velocity
        velocity.y = std::min(MAX_FALL_SPEED, velocity.y);

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
