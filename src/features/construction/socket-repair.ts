// ============================================
// Construction Module: Shovel Construction & Socket Triggers
// ============================================

import mod from "mod";
import * as config from "../core/config";
import * as vec from "../shared/utils";
import * as events from "../core/events";

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
const buildingMaterials: Map<number, number> = new Map(); // teamId -> available materials

// ============================================================
// Socket Initialization
// ============================================================

/**
 * Initialize all socket states from Godot scene.
 * Call this once from OnGameModeStarted().
 */
export function InitializeSockets() {
    // Socket IDs would be defined in Godot scene
    const socketIDs = [
        config.CONTROL_ZONE_AREA_ID,
        config.HOTZONE_AREA_ID,
        // Add more socket IDs as defined in the scene
    ];

    socketIDs.forEach(id => {
        if (!sockets.has(id)) {
            sockets.set(id, {
                constructed: false,
                health: 100,
                ownerTeam: 0,
                constructionProgress: 0,
                maxProgress: 100,
            });
        }
    });

    // Initialize material pools for each team
    for (let teamId = 1; teamId <= 3; teamId++) {
        buildingMaterials.set(teamId, 100);
    }
}

// ============================================================
// Build / Repair Logic
// ============================================================

/**
 * Handle shovel construction on a socket.
 * Consumes materials and progresses construction.
 */
export function OnShovelConstruct(player: mod.Player, interactId: number) {
    const socketId = interactId;
    const socket = sockets.get(socketId);
    if (!socket) {
        console.log(`Socket ${socketId} not found`);
        return;
    }

    const playerTeamId = events.GetPlayerTeamId(player);
    const materials = buildingMaterials.get(playerTeamId) || 0;

    if (materials < 10) {
        events.ShowNotificationMessage(
            MakeMessage("No materials"),
            player
        );
        return;
    }

    // Consume materials
    buildingMaterials.set(playerTeamId, materials - 10);

    // Progress construction
    socket.constructionProgress += 10;

    if (socket.constructionProgress >= socket.maxProgress) {
        // Construction complete
        socket.constructed = true;
        socket.ownerTeam = playerTeamId;

        // Update visuals
        // (Would update model state or visual indicators)
    }
}

/**
 * Handle shovel repair on a damaged socket.
 */
export function OnShovelRepair(player: mod.Player, interactId: number) {
    const socketId = interactId;
    const socket = sockets.get(socketId);
    if (!socket) {
        return;
    }

    const playerTeamId = events.GetPlayerTeamId(player);

    // Repair logic
    if (socket.health > 0 && socket.health < socket.maxProgress) {
        socket.health += 5; // Repair amount per weld

        if (socket.health >= socket.maxProgress) {
            socket.constructed = true;
        }
    }
}

// ============================================================
// Construction Event Handlers
// ============================================================

/**
 * Handle player interaction with construction sockets.
 */
export function OnPlayerInteract(
    player: mod.Player,
    interactPoint: mod.InteractPoint,
    interactId: number
) {
    if (interactId !== config.MANNEQUIN_TEAM_SWITCH_ID &&
        interactId !== config.MANNEQUIN_TEAM_SWITCH_2_ID) {
        // Not a team switcher, check if it's a socket
        return;
    }

    // Team switching logic would go here
    // Check mannequin assignment and validate switch
}

/**
 * Handle shovel construction/repair.
 */
export function OnPlayerInteract(
    player: mod.Player,
    interactPoint: mod.InteractPoint,
    interactId: number
) {
    // Check if player is holding shovel
    // If yes, determine construction vs repair based on socket state
    // Call OnShovelConstruct or OnShovelRepair accordingly
}
