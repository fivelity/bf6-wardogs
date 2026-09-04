// ============================================
// AI Module: Rogue AI Threat Faction (Team 4)
// ============================================

import mod from "mod";
import * as config from "../core/config";
import * as vec from "../shared/utils";

// ============================================================
// AI State Tracking
// ============================================================

interface AIPlayer {
    id: number;
    player: mod.Player;
    squadId: number;
    role: "Leader" | "Member";
    state: "Idle" | "Moving" | "Attacking" | "Retreating";
    target: mod.Player | null;
    deployed: boolean;
    lastDeployed: number;
}

const aiPlayers: Map<number, AIPlayer> = new Map();
let aiBotCounter: number = 0;

// ============================================================
// AI Spawning
// ============================================================

/**
 * Spawn AI bots from the AI Spawner nodes in Godot.
 * Called from OnGameModeStarted.
 */
export function SpawnAIBoots() {
    // Clear existing AI players
    cleanupAllAI();

    // Spawn AI squads (4 squads of 3)
    for (let squadId = 0; squadId < config.AI_SQUADS_COUNT; squadId++) {
        spawnAISquad(squadId);
    }
}

/**
 * Spawn a single AI squad at the AI Spawner node.
 */
export function spawnAISquad(squadId: number) {
    // Get AI Spawner position from Godot
    const spawner = mod.GetSpawner(config.AI_SPAWNER_ID);
    const spawnPosition = mod.GetObjectPosition(spawner);
    const spawnRotation = mod.Pi(); // Default angle

    for (let i = 0; i < config.AI_BOTS_PER_SQUAD; i++) {
        const role = i === 0 ? "Leader" : "Member";
        spawnAIPlayer(squadId, role, spawnPosition, spawnRotation);
    }
}

/**
 * Spawn an individual AI player.
 */
export function spawnAIPlayer(
    squadId: number,
    role: "Leader" | "Member",
    position: mod.Vector,
    rotation: number
) {
    aiBotCounter++;
    const aiId = aiBotCounter;

    // Spawn AI soldier from AI spawner
    const aiPlayer = mod.SpawnAIFromAISpawner(
        mod.GetSpawner(config.AI_SPAWNER_ID),
        mod.SoldierClass.Assault,
        mod.GetTeam(config.TEAM_AI_ID)
    );

    if (!aiPlayer) {
        console.log("Failed to spawn AI player");
        return;
    }

    // Set AI health modifier
    mod.SetAIToHumanDamageModifier(config.AI_SPAWN_HEALTH_MULTIPLIER);

    // Store AI state
    aiPlayers.set(aiId, {
        id: aiId,
        player: aiPlayer,
        squadId,
        role,
        state: "Idle",
        target: null,
        deployed: true,
        lastDeployed: Date.now(),
    });

    // Set AI position
    mod.Teleport(aiPlayer, position, rotation);
}

/**
 * Update all AI players each tick.
 */
export function TickAIPlayers() {
    for (const [id, ai] of aiPlayers) {
        if (!mod.IsPlayerValid(ai.player)) {
            continue;
        }

        if (!mod.GetSoldierState(ai.player, mod.SoldierStateBool.IsAlive)) {
            // AI died, respawn after delay
            respawnAIPlayer(ai);
            continue;
        }

        // AI combat logic
        updateAICombat(ai);
    }
}

/**
 * Update AI combat behavior.
 */
export function updateAICombat(ai: AIPlayer) {
    // Simple AI behavior: move toward players and engage
    const aiPlayer = ai.player;
    const position = mod.GetSoldierState(aiPlayer, mod.SoldierStateVector.GetPosition);

    // Find nearest human player
    let nearestTarget: mod.Player | null = null;
    let minDistance = 100;

    for (const [_, humanAI] of aiPlayers) {
        // Find human players near AI
    }

    if (nearestTarget && minDistance < 50) {
        // Engage target
        ai.state = "Attacking";
        // AI would attack here
    } else {
        // Move toward center of map
        ai.state = "Moving";
        // AI navigation logic
    }
}

/**
 * Respawn an AI player.
 */
export function respawnAIPlayer(ai: AIPlayer) {
    // Find next available spawner position
    const spawner = mod.GetSpawner(config.AI_SPAWNER_ID);
    const spawnPosition = mod.GetObjectPosition(spawner);
    const spawnRotation = mod.Pi();

    // Respawn AI with boosted health
    const aiPlayer = mod.SpawnAIFromAISpawner(
        spawner,
        mod.SoldierClass.Assault,
        mod.GetTeam(config.TEAM_AI_ID)
    );

    if (aiPlayer) {
        mod.Teleport(aiPlayer, spawnPosition, spawnRotation);
        // Update AI state
        ai.player = aiPlayer;
        ai.state = "Idle";
    }
}

/**
 * Clean up all AI players (called on game end).
 */
export function cleanupAllAI() {
    for (const [id] of aiPlayers) {
        try {
            mod.DestroyPlayer(id);
        } catch (e) {
            // Player may already be dead
        }
    }
    aiPlayers.clear();
}
