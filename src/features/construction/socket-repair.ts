// ============================================
// Construction Module: Shovel Construction & Socket Triggers
// ============================================

import * as config from "../../core/config";

// ============================================================
// Construction State Tracking
// ============================================================

interface SocketState {
    constructed: boolean;
    health: number;
    ownerTeam: number;
    constructionProgress: number;
    maxProgress: number;
}

const sockets: Map<number, SocketState> = new Map();
const buildingMaterials: Map<number, number> = new Map();

// ============================================================
// Socket Initialization
// ============================================================

export function InitializeSockets(): void {
    const socketIDs = [
        config.CONTROL_ZONE_AREA_ID,
        config.HOTZONE_AREA_ID,
    ];

    for (const id of socketIDs) {
        if (!sockets.has(id)) {
            sockets.set(id, {
                constructed: false,
                health: 100,
                ownerTeam: 0,
                constructionProgress: 0,
                maxProgress: 100,
            });
        }
    }

    for (let teamId = 1; teamId <= 3; teamId++) {
        buildingMaterials.set(teamId, 100);
    }
}

// ============================================================
// Build / Repair Logic
// ============================================================

export function OnShovelConstruct(player: mod.Player, interactId: number): void {
    const socket = sockets.get(interactId);
    if (!socket) {
        console.log(`Socket ${interactId} not found`);
        return;
    }

    const playerTeamId = mod.GetObjId(mod.GetTeam(player));
    const materials = buildingMaterials.get(playerTeamId) ?? 0;

    if (materials < 10) {
        return;
    }

    buildingMaterials.set(playerTeamId, materials - 10);
    socket.constructionProgress += 10;

    if (socket.constructionProgress >= socket.maxProgress) {
        socket.constructed = true;
        socket.ownerTeam = playerTeamId;
    }
}

export function OnShovelRepair(_player: mod.Player, interactId: number): void {
    const socket = sockets.get(interactId);
    if (!socket) {
        return;
    }

    if (socket.health > 0 && socket.health < socket.maxProgress) {
        socket.health += 5;

        if (socket.health >= socket.maxProgress) {
            socket.constructed = true;
        }
    }
}

// ============================================================
// Construction Event Handlers
// ============================================================

export function OnPlayerInteract(
    player: mod.Player,
    _interactPoint: mod.InteractPoint,
    interactId: number
): void {
    if (interactId === config.MANNEQUIN_TEAM_SWITCH_ID ||
        interactId === config.MANNEQUIN_TEAM_SWITCH_2_ID) {
        return;
    }

    const socket = sockets.get(interactId);
    if (!socket) {
        return;
    }

    if (socket.constructed && socket.health < socket.maxProgress) {
        OnShovelRepair(player, interactId);
        return;
    }

    OnShovelConstruct(player, interactId);
}
