#pragma once
#include <cmath>
#include <algorithm>

namespace MiniMilitia {

struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;

    Vec2() = default;
    Vec2(float x_, float y_) : x(x_), y(y_) {}

    Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
    Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
    Vec2 operator*(float s) const { return {x * s, y * s}; }
    Vec2 operator/(float s) const { return {x / s, y / s}; }

    Vec2& operator+=(const Vec2& o) { x += o.x; y += o.y; return *this; }
    Vec2& operator*=(float s) { x *= s; y *= s; return *this; }

    float lengthSq() const { return x * x + y * y; }
    float length() const { return std::sqrt(lengthSq()); }

    Vec2 normalized() const {
        float len = length();
        return len > 0.0001f ? Vec2{x / len, y / len} : Vec2{0.0f, 0.0f};
    }

    static float distance(const Vec2& a, const Vec2& b) {
        return (a - b).length();
    }
};

struct Rect2D {
    float x = 0.0f;
    float y = 0.0f;
    float w = 0.0f;
    float h = 0.0f;

    bool contains(const Vec2& pt) const {
        return pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
    }

    bool intersectsCircle(const Vec2& center, float radius) const {
        float closestX = std::clamp(center.x, x, x + w);
        float closestY = std::clamp(center.y, y, y + h);
        float dx = center.x - closestX;
        float dy = center.y - closestY;
        return (dx * dx + dy * dy) <= (radius * radius);
    }
};

} // namespace MiniMilitia
