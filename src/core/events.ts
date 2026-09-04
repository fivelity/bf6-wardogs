// Centralized Events Broker
// All game events and their handlers are managed here
// Import and call these from event handlers

import mod from "mod";

// ============================================================
// Game State Tracking
// ============================================================

let gameOver: boolean = false;
let roundActive: boolean = false;
let combatStarted: boolean = false;
let combatCountdownStarted: boolean = false;
let currentRound: number = 1;
let matchStartTime: number = Date.now();

// Player tracking
let playerCount: number = 0;
let team1PlayerCount: number = 0;
let team2PlayerCount: number = 0;
let team3PlayerCount: number = 0;
let aiBotCount: number = 0;

// Scoring
let team1Score: number = 0;
let team2Score: number = 0;
let team3Score: number = 0;
let hotZoneActive: boolean = false;
let hotZoneCenter: mod.Vector = null;

// Cash economy
let globalCashPool: number = 0;

// ============================================================
// HotZone Tracking
// ============================================================

let hotZonePosition: mod.Vector = null;
let hotZoneTargetPosition: mod.Vector = null;
let hotZoneDriftDirection: mod.Vector = null;
let hotZoneLastUpdate: number = 0;

// ============================================================
// Event Handlers Registry
// ============================================================

interface EventHandler {
    handler: (...args: any[]) => void;
    priority?: number;
}

const eventRegistry: Record<string, EventHandler[]> = {
    OnGameModeStarted: [],
    OnGameModeEnding: [],
    OnPlayerJoinGame: [],
    OnPlayerLeaveGame: [],
    OnPlayerDeployed: [],
    OnPlayerDied: [],
    OnPlayerEarnedKill: [],
    OnPlayerDamaged: [],
    OnPlayerInteract: [],
    OnPlayerEnterCapturePoint: [],
    OnPlayerExitCapturePoint: [],
    OnPlayerEnterAreaTrigger: [],
    OnPlayerExitAreaTrigger: [],
};

// ============================================================
// Event Dispatching
// ============================================================

export function OnGameModeStarted() {
    // Reset state
    gameOver = false;
    roundActive = false;
    combatStarted = false;
    combatCountdownStarted = false;
    currentRound = 1;
    playerCount = 0;
    team1PlayerCount = 0;
    team2PlayerCount = 0;
    team3PlayerCount = 0;
    aiBotCount = 0;
    team1Score = 0;
    team2Score = 0;
    team3Score = 0;
    hotZoneActive = false;
    globalCashPool = 0;

    // Register default handlers
    for (const [event, handlers] of Object.entries(eventRegistry)) {
        if (handlers.length === 0) {
            console.log(`No handlers registered for ${event}`);
        }
    }
}

export function OnGameModeEnding() {
    gameOver = true;
    roundActive = false;
    combatStarted = false;
}

export function OnPlayerJoinGame(eventPlayer: mod.Player) {
    if (gameOver) return;

    playerCount++;
    const team = mod.GetTeam(eventPlayer);
    const teamID = mod.GetObjId(team);

    switch (teamID) {
        case 1: team1PlayerCount++; break;
        case 2: team2PlayerCount++; break;
        case 3: team3PlayerCount++; break;
        case 4: aiBotCount++; break;
    }

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerJoinGame) {
        handler(eventPlayer);
    }
}

export function OnPlayerLeaveGame(eventNumber: number) {
    if (gameOver) return;

    playerCount--;
    // Team count tracking would happen in JsPlayer cleanup
    // This is just a tracker for global state

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerLeaveGame) {
        handler(eventNumber);
    }
}

export function OnPlayerDeployed(eventPlayer: mod.Player) {
    if (gameOver) return;
    combatStarted = true;

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerDeployed) {
        handler(eventPlayer);
    }
}

export function OnPlayerDied(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
) {
    if (gameOver) return;

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerDied) {
        handler(eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock);
    }
}

export function OnPlayerEarnedKill(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
) {
    if (gameOver) return;

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerEarnedKill) {
        handler(eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock);
    }
}

export function OnPlayerDamaged(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDamageType: mod.DamageType,
    eventWeaponUnlock: mod.WeaponUnlock
) {
    if (gameOver) return;

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerDamaged) {
        handler(eventPlayer, eventOtherPlayer, eventDamageType, eventWeaponUnlock);
    }
}

export function OnPlayerInteract(
    eventPlayer: mod.Player,
    eventInteractPoint: mod.InteractPoint
) {
    if (gameOver) return;

    const interactId = mod.GetObjId(eventInteractPoint);

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerInteract) {
        handler(eventPlayer, eventInteractPoint, interactId);
    }
}

export function OnPlayerEnterCapturePoint(
    eventPlayer: mod.Player,
    eventCapturePoint: mod.CapturePoint
) {
    if (gameOver) return;

    const captureId = mod.GetObjId(eventCapturePoint);

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerEnterCapturePoint) {
        handler(eventPlayer, eventCapturePoint, captureId);
    }
}

export function OnPlayerExitCapturePoint(
    eventPlayer: mod.Player,
    eventCapturePoint: mod.CapturePoint
) {
    if (gameOver) return;

    const captureId = mod.GetObjId(eventCapturePoint);

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerExitCapturePoint) {
        handler(eventPlayer, eventCapturePoint, captureId);
    }
}

export function OnPlayerEnterAreaTrigger(
    eventPlayer: mod.Player,
    eventAreaTrigger: mod.AreaTrigger
) {
    if (gameOver) return;

    const areaId = mod.GetObjId(eventAreaTrigger);

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerEnterAreaTrigger) {
        handler(eventPlayer, eventAreaTrigger, areaId);
    }
}

export function OnPlayerExitAreaTrigger(
    eventPlayer: mod.Player,
    eventAreaTrigger: mod.AreaTrigger
) {
    if (gameOver) return;

    const areaId = mod.GetObjId(eventAreaTrigger);

    // Execute handlers
    for (const handler of eventRegistry.OnPlayerExitAreaTrigger) {
        handler(eventPlayer, eventAreaTrigger, areaId);
    }
}

// ============================================================
// State Accessors
// ============================================================

export function GetGameState(): {
    gameOver: boolean;
    roundActive: boolean;
    combatStarted: boolean;
    playerCount: number;
    team1PlayerCount: number;
    team2PlayerCount: number;
    team3PlayerCount: number;
    aiBotCount: number;
    team1Score: number;
    team2Score: number;
    team3Score: number;
} {
    return {
        gameOver,
        roundActive,
        combatStarted,
        playerCount,
        team1PlayerCount,
        team2PlayerCount,
        team3PlayerCount,
        aiBotCount,
        team1Score,
        team2Score,
        team3Score,
    };
}

export function GetHotZoneState(): {
    active: boolean;
    position: mod.Vector | null;
    targetPosition: mod.Vector | null;
} {
    return { active: hotZoneActive, position: hotZonePosition, targetPosition: hotZoneTargetPosition };
}

export function IsGameActive(): boolean {
    return !gameOver && combatStarted;
}

export function GetTeamScores(): Record<number, number> {
    return {
        1: team1Score,
        2: team2Score,
        3: team3Score,
    };
}
