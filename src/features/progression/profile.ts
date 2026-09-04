// src/features/progression/profile.ts
import { Events, Timers } from "bf6-portal-utils";

/**
 * Valid progression tracks matching WARDOGS dynamic sandbox roles.
 */
export type ProgressionTrackKey = "Assault" | "Medic" | "Recon" | "Support" | "Driver" | "Pilot";

/**
 * Schema tracking cumulative experience and unlocked Mastery Tiers.
 */
export interface TrackData {
    xp: number;
    level: number; // Tier 1 to 5
}

/**
 * Player Profile Class managing the lifecycle of individual mercenaries.
 * Implements persistent cash tracking throughout a match session alongside 
 * independent, non-consumable class progression milestones.
 */
export class PlayerProfile {
    public readonly player: mod.Player;
    public readonly playerId: number;
    public readonly name: string;
    
    private currentCash: number = 10000; // Standard starting cash: $10,000
    
    // Non-consumable, persistent role proficiency trackers
    public tracks: Record<ProgressionTrackKey, TrackData> = {
        Assault: { xp: 0, level: 1 },
        Medic: { xp: 0, level: 1 },
        Recon: { xp: 0, level: 1 },
        Support: { xp: 0, level: 1 },
        Driver: { xp: 0, level: 1 },
        Pilot: { xp: 0, level: 1 }
    };

    // Thresholds required to graduate to Tiers 1, 2, 3, 4, and 5 respectively
    private readonly xpThresholds = [0, 1000, 2500, 5000, 10000];

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.name = mod.GetPlayerName(player);
    }

    /**
     * Retrieves the player's active cash reserves.
     */
    public getCash(): number {
        return this.currentCash;
    }

    /**
     * Safely adds cash to the player's wallet and updates the reactive HUD.
     * @param amount Cash value to credit.
     * @param reason Optional localization string key used to flash point feedback.
     */
    public addCash(amount: number, reason?: string): void {
        if (amount <= 0) return;
        
        this.currentCash += amount;
        this.syncWalletUI(amount, reason);
    }

    /**
     * Deducts cash from the player's wallet following a checkout.
     * @param amount Cash value to debit.
     * @param reason Optional localization string key used to flash cost feedback.
     */
    public removeCash(amount: number, reason?: string): void {
        if (amount <= 0) return;

        this.currentCash = Math.max(0, this.currentCash - amount);
        this.syncWalletUI(-amount, reason);
    }

    /**
     * Direct setter for administrative balance corrections.
     */
    public setCash(amount: number): void {
        this.currentCash = Math.max(0, amount);
        this.syncWalletUI(0);
    }

    /**
     * Awards class experience to a specific progression track.
     * Handles dynamic level-ups and triggers custom SFX/VFX overlays.
     */
    public addTrackXp(track: ProgressionTrackKey, amount: number): void {
        if (amount <= 0) return;

        const data = this.tracks[track];
        if (data.level >= 5) return; // Cap reached

        data.xp += amount;
        const currentTier = data.level;
        const nextThreshold = this.xpThresholds[currentTier]; // Threshold for next level (Index matches level)

        if (data.xp >= nextThreshold) {
            data.level = Math.min(5, data.level + 1);
            
            // Dispatch a server notification to the rank-up contractor
            mod.DisplayNotificationMessage(
                mod.Message("RANK UP: {} Track unlocked Tier {}!", track, data.level),
                this.player
            );

            // Execute programmatic rank-up visuals (defibrillator spark feedback)
            const eyePos = mod.GetSoldierState(this.player, mod.SoldierStateVector.EyePosition);
            const rankSfx = mod.SpawnObject(
                mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
                eyePos,
                mod.CreateVector(0, 0, 0)
            );
            mod.PlaySound(rankSfx, 100);

            // Cascade recursive check in case of massive XP payouts spanning multiple levels
            this.addTrackXp(track, 0); 
        }
    }

    /**
     * Fires a localized screen notification showing balance changes.
     */
    private syncWalletUI(delta: number, reason?: string): void {
        // Safe UI synchronization: trigger standard ParseUI HUD updates
        const walletLabel = mod.FindUIWidgetWithName(`Shop_Wallet_${this.playerId}`);
        if (walletLabel) {
            mod.SetUITextLabel(walletLabel, mod.Message("WALLET: ${}", this.currentCash));
        }

        if (delta !== 0 && reason) {
            // Flash +$X or -$X delta transactions on the player's notification HUD
            const isCredit = delta > 0;
            mod.DisplayNotificationMessage(
                mod.Message(isCredit ? "+${} ({})" : "-${} ({})", Math.abs(delta), reason),
                this.player
            );
        }
    }
}

/**
 * Global memory-safe transactional profile directory.
 * Maps numeric player object IDs (GetObjId) directly to instantiation classes.
 */
export const mercenaryRegistry = new Map<number, PlayerProfile>();

/**
 * Centralized initialization hook for joining human contractors.
 */
export function OnPlayerJoinGame(player: mod.Player): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    const playerId = mod.GetObjId(player);
    if (!mercenaryRegistry.has(playerId)) {
        const newProfile = new PlayerProfile(player);
        mercenaryRegistry.set(playerId, newProfile);
    }
}

/**
 * Centralized cleanup hook triggered upon game leave.
 */
export function OnPlayerLeaveGame(player: mod.Player): void {
    const playerId = mod.GetObjId(player);
    if (mercenaryRegistry.has(playerId)) {
        mercenaryRegistry.delete(playerId);
    }
}
