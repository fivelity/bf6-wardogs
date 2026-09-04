// ============================================
// Vector Math & Position Utilities
// ============================================

import mod from "mod";

// Create a vector with x, y, z components
export function CreateVector(x: number = 0, y: number = 0, z: number = 0): mod.Vector {
    return mod.CreateVector(x, y, z);
}

// Get components of a vector
export function XComponentOf(v: mod.Vector): number {
    return mod.XComponentOf(v);
}

export function YComponentOf(v: mod.Vector): number {
    return mod.YComponentOf(v);
}

export function ZComponentOf(v: mod.Vector): number {
    return mod.ZComponentOf(v);
}

// Calculate distance between two vectors
export function DistanceBetween(v1: mod.Vector, v2: mod.Vector): number {
    return mod.DistanceBetween(v1, v2);
}

// Check if position is within a radius of a center point
export function IsWithinRadius(pos: mod.Vector, center: mod.Vector, radius: number): boolean {
    return DistanceBetween(pos, center) <= radius;
}

// Linear interpolation
export function Lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

// Vector addition
export function VectorAdd(v1: mod.Vector, v2: mod.Vector): mod.Vector {
    return CreateVector(
        XComponentOf(v1) + XComponentOf(v2),
        YComponentOf(v1) + YComponentOf(v2),
        ZComponentOf(v1) + ZComponentOf(v2)
    );
}

// Vector subtraction
export function VectorSub(v1: mod.Vector, v2: mod.Vector): mod.Vector {
    return CreateVector(
        XComponentOf(v1) - XComponentOf(v2),
        YComponentOf(v1) - YComponentOf(v2),
        ZComponentOf(v1) - ZComponentOf(v2)
    );
}

// Vector multiply (scale)
export function VectorScale(v: mod.Vector, factor: number): mod.Vector {
    return CreateVector(
        XComponentOf(v) * factor,
        YComponentOf(v) * factor,
        ZComponentOf(v) * factor
    );
}

// Normalize a vector (length = 1)
export function VectorNormalize(v: mod.Vector): mod.Vector {
    const length = DistanceBetween(v, CreateVector(0, 0, 0));
    if (length < 0.001) return CreateVector(0, 0, 0);
    return VectorScale(v, 1 / length);
}

// Clamp a vector within a bounding box (min, max)
export function VectorClamp(v: mod.Vector, min: mod.Vector, max: mod.Vector): mod.Vector {
    return CreateVector(
        Math.max(min.x, Math.min(max.x, XComponentOf(v))),
        Math.max(min.y, Math.min(max.y, YComponentOf(v))),
        Math.max(min.z, Math.min(max.z, ZComponentOf(v)))
    );
}

// Get random position within a radius
export function RandomPositionAround(center: mod.Vector, radius: number): mod.Vector {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    return CreateVector(
        XComponentOf(center) + Math.cos(angle) * dist,
        YComponentOf(center) + Math.sin(angle) * dist,
        ZComponentOf(center)
    );
}
