#pragma once
#include <cstdint>
#include "Math2D.hpp"

namespace MiniMilitia {

enum class PrimaryWeapon : uint8_t {
    DUAL_UZI  = 0,
    SHOTGUN   = 1,
    SNIPER    = 2,
    PISTOL    = 3
};

struct WeaponProfile {
    PrimaryWeapon type;
    const char* name;
    float fireIntervalSec; // Cooldown between shots
    float bulletSpeed;
    float damage;
    float spreadRad;
    uint8_t pelletsPerShot;
};

inline WeaponProfile getWeaponProfile(PrimaryWeapon type) {
    switch (type) {
        case PrimaryWeapon::DUAL_UZI:
            return {PrimaryWeapon::DUAL_UZI, "Dual SMG UZI", 0.11f, 17.0f, 16.0f, 0.08f, 1};
        case PrimaryWeapon::SHOTGUN:
            return {PrimaryWeapon::SHOTGUN, "Combat Shotgun", 0.42f, 15.0f, 12.0f, 0.22f, 6};
        case PrimaryWeapon::SNIPER:
            return {PrimaryWeapon::SNIPER, "Marksman Sniper", 0.65f, 26.0f, 75.0f, 0.01f, 1};
        case PrimaryWeapon::PISTOL:
        default:
            return {PrimaryWeapon::PISTOL, "Service Pistol", 0.22f, 16.0f, 24.0f, 0.04f, 1};
    }
}

// Active Infinite Bullet in Flight
struct ActiveBullet {
    uint32_t ownerId = 0;
    Vec2 pos;
    Vec2 vel;
    float damage = 20.0f;
    float lifeSec = 1.8f;
    bool active = true;

    void update(float dt) {
        if (!active) return;
        pos += vel;
        lifeSec -= dt;
        if (lifeSec <= 0.0f) active = false;
    }
};

} // namespace MiniMilitia
