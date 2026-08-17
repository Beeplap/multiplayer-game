#pragma once
#include <string>
#include <vector>
#include <cstdint>

namespace MiniMilitia {

enum class MatchMode : uint8_t {
    DUEL_1V1 = 0,
    TEAM_2V2 = 1,
    FFA_4P   = 2
};

enum class Team : uint8_t {
    RED  = 0,
    BLUE = 1,
    FFA  = 2
};

// 5-Digit Private Room State
struct PrivateLobby {
    char roomCode[6];        // 5 characters + null terminator e.g. "K9X2P\0"
    uint32_t hostPlayerId;
    MatchMode mode;
    uint8_t maxPlayers;
    bool isGameActive;
};

// Compact Network Input Packet (60Hz transmission, 16 bytes total)
#pragma pack(push, 1)
struct PlayerInputPacket {
    uint32_t sequence;
    float moveX;       // -1.0 to +1.0
    float thrustY;     // -1.0 to 0.0
    float aimAngleRad; // 0.0 to 2*PI
    uint8_t isShooting : 1;
    uint8_t weaponId   : 3;
    uint8_t reserved   : 4;
};
#pragma pack(pop)

// Compact State Packet Broadcast (30Hz, 20 bytes per player)
#pragma pack(push, 1)
struct PlayerStatePacket {
    uint32_t playerId;
    float posX;
    float posY;
    float velX;
    float velY;
    uint8_t health;   // 0 to 100
    uint8_t jetGas;   // 0 to 100
    Team team;
};
#pragma pack(pop)

} // namespace MiniMilitia
