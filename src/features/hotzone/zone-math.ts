// ============================================
// HotZone Module: Drifting HotZone / ControlZone Math
// ============================================

import mod from "mod";
import * as config from "../core/config";
import * as vec from "../shared/utils";

// ============================================================
// HotZone State Tracking
// ============================================================

let hotZonePlayers: Map<number, number> = new Map(); // playerId -> tick count

/**
 * Update HotZone position and scoring.
 * Call this from the tick update loop.
 */
export function TickHotZone() {
    if (hotZoneActive && hotZoneCenter) {
        // Check if players are inside HotZone
        for (const [playerId, count] of hotZonePlayers.entries()) {
            // Counting logic would go here - check player positions
            // and verify they're still in the HotZone
        }

        // HotZone drift logic - called once per second
        const now = Date.now();
        if (now - hotZoneLastDriftTime >= 1000) {
            CalculateHotZoneDrift();
            hotZoneLastDriftTime = now;
        }
    }
}

let hotZoneLastDriftTime: number = 0;

/**
 * Calculate new HotZone position based on drift vector.
 * Ensures HotZone stays within Control Zone boundaries.
 */
export function CalculateHotZoneDrift() {
    // Get Control Zone boundary polygon
    // Calculate drift vector within polygon bounds
    // Update hotZoneCenter
}

/**
 * Get number of players currently in the HotZone for each team.
 * Returns: { [teamId]: playerCount }
 */
export function GetHotZoneTeamCounts(): Record<number, number> {
    const counts: Record<number, number> = {
        1: 0, // Lonestar
        2: 0, // Manticore
        3: 0, // Valkyra
        4: 0, // AI
    };

    hotZonePlayers.forEach((_, playerId) => {
        // Look up player's team
    });

    return counts;
}

/**
 * Get HotZone tick score for the team with majority players.
 */
export function CalculateHotZoneTickScore(): { team: number | null; score: number } {
    const counts = GetHotZoneTeamCounts();
    let maxTeam = null;
    let maxCount = 0;

    for (const [team, count] of Object.entries(counts)) {
        const teamNum = parseInt(team, 10);
        if (count > maxCount) {
            maxCount = count;
            maxTeam = teamNum;
        }
    }

    const score = maxTeam ? maxCount * config.TICK_SCORE_PER_PLAYER * config.HOTZONE_SCORE_MULTIPLIER : 0;

    return { team: maxTeam, score };
}
