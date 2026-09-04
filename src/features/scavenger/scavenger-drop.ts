// ============================================
// Scavenger Module: Salvage Pack Drop System
// ============================================

import mod from "mod";
import * as config from "../core/config";

// ============================================================
// Salvage Pack Tracking
// ============================================================

interface SalvagePack {
    id: number;
    position: mod.Vector;
    ownerTeamId: number;
    droppedBy: number;
    createdAt: number;
    expired: boolean;
}

const salvagePacks: Map<number, SalvagePack> = new Map();
let salvagePackCounter: number = 0;

// ============================================================
// Drop Logic
// ============================================================

/**
 * Spawn a salvage pack when a player is eliminated.
 */
export async function OnPlayerDied(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
) {
    // Only drop pack for human players
    if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsAISoldier)) {
        return;
    }

    const playerId = mod.GetObjId(eventPlayer);
    const teamId = mod.GetObjId(mod.GetTeam(eventPlayer));

    // Get player position
    const position = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetPosition);

    // Spawn salvage pack
    spawnSalvagePack(position, teamId, playerId);
}

/**
 * Spawn a salvage pack at the given position.
 */
export function spawnSalvagePack(
    position: mod.Vector,
    ownerTeamId: number,
    droppedBy: number
) {
    salvagePackCounter++;
    const packId = salvagePackCounter;

    // Spawn the backpack object in Godot
    // (Would use mod.SpawnObject or similar)

    const pack = {
        id: packId,
        position,
        ownerTeamId,
        droppedBy,
        createdAt: Date.now(),
        expired: false,
    };

    salvagePacks.set(packId, pack);

    // Start garbage collection timer
    const expiryTime = pack.createdAt + (config.SALVAGE_BACKPACK_DURATION * 1000);

    setTimeout(() => {
        if (salvagePacks.get(packId) && !salvagePacks.get(packId)!.expired) {
            cleanupSalvagePack(packId);
        }
    }, expiryTime - Date.now());
}

/**
 * Player picks up salvage pack.
 */
export async function OnPlayerInteract(
    player: mod.Player,
    interactPoint: mod.InteractPoint,
    interactId: number
) {
    // Check if interacting with salvage pack
    const pack = salvagePacks.values().find(
        pack => !pack.expired && pack.position === interactId
    );

    if (!pack) {
        return;
    }

    // Only allow team members to loot their own pack (or cross-team loot if enabled)
    const playerTeamId = mod.GetObjId(mod.GetTeam(player));
    if (pack.ownerTeamId !== playerTeamId) {
        return;
    }

    // Grant loot rewards
    const cash = Math.floor(Math.random() * (config.SALVAGE_CASH_RANGE_MAX - config.SALVAGE_CASH_RANGE_MIN + 1)) + config.SALVAGE_CASH_RANGE_MIN;
    events.AddCash(playerTeamId, cash); // Or individual player

    events.AddXP(playerTeamId, config.SALVAGE_XP_REWARD, "ASSAULT");

    // Show loot notification
    events.ShowNotificationMessage(
        MakeMessage("Salvaged Equipment: $", cash),
        player
    );

    // Remove the pack
    cleanupSalvagePack(interactId);
}

/**
 * Clean up expired salvage packs.
 */
export function cleanupSalvagePack(packId: number) {
    const pack = salvagePacks.get(packId);
    if (pack) {
        pack.expired = true;
        // Destroy the Godot object
        mod.DestroyObject(packId);
        salvagePacks.delete(packId);
    }
}
