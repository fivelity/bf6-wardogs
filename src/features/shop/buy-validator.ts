// src/features/shop/buy-validator.ts
import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry, ProgressionTrackKey } from "../progression/profile";
import { ShopItem } from "./buy-menu";

/**
 * Robust Transaction Economy Manager for WARDOGS.
 * Solves the separation of concerns between CASH (transactional match utility) and 
 * XP (persistent role mastery), implementing pro-rated cost calculations and 
 * teamplay-centric pooled funding for Forward Operating Base (F.O.B) defenses.
 */
export class BuyValidator {
    private readonly maxPenaltyMultiplier = 2.0; // 200% maximum pro-rated markup for tier deficits

    /**
     * Calculates the dynamic, pro-rated cost of a shop item based on the player's active progression tier.
     * Formula: Cost = BaseCost * (1 + P_max * (T_req - T_curr) / T_req)
     * If the player's tier meets or exceeds the required tier, they pay the standard base cost.
     * 
     * @param player The Battlefield Player instance
     * @param item The target ShopItem to calculate the cost for
     * @returns The final calculated cost in integers
     */
    public calculateDynamicCost(player: mod.Player, item: ShopItem): number {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);

        // Fallback to base cost if profile registration is missing
        if (!profile) {
            console.log(`[WARDOGS ECONOMY] Profile not initialized for Player ID: ${playerId}`);
            return item.baseCost;
        }

        const currentTier = profile.tracks[item.requiredTrack].level;

        // Meets or exceeds required progression -> Pay baseline cost
        if (currentTier >= item.requiredTier) {
            return item.baseCost;
        }

        // Apply pro-rated surcharge formula:
        const tierDeficit = item.requiredTier - currentTier;
        const penaltyScale = tierDeficit / item.requiredTier;
        const finalCost = Math.round(item.baseCost * (1 + (this.maxPenaltyMultiplier * penaltyScale)));

        return finalCost;
    }

    /**
     * Evaluates a player's checkout attempt, processing individual cash deductions,
     * loadout overrides, and team-pooled asset contributions.
     * 
     * @param player The Battlefield Player initiating the transaction
     * @param item The ShopItem to purchase
     * @returns boolean True if transaction succeeded or was registered; false otherwise
     */
    public validateAndProcessTransaction(player: mod.Player, item: ShopItem): boolean {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);

        if (!profile) {
            mod.DisplayNotificationMessage(mod.Message("ERROR: Player profile not initialized."), player);
            return false;
        }

        const calculatedCost = this.calculateDynamicCost(player, item);

        // --- HANDLE COOPERATIVE POOLED FORWARD OPERATING BASE DEFENSES ---
        if (item.isPooled) {
            if (profile.getCash() <= 0) {
                mod.DisplayNotificationMessage(mod.Message("Transaction Failed: You have no cash to contribute!"), player);
                return false;
            }

            const neededCash = calculatedCost - item.pooledCash;
            const contribution = Math.min(profile.getCash(), neededCash);

            profile.removeCash(contribution);
            item.pooledCash += contribution;

            // Broadlog the contribution to the active faction/team
            mod.DisplayNotificationMessage(
                mod.Message("CO-OP UPGRADE: Contributed ${}! Total Funded: ${}/${}", contribution, item.pooledCash, calculatedCost),
                mod.GetTeam(player)
            );

            // Trigger structural spawn if co-op pooling is 100% completed
            if (item.pooledCash >= calculatedCost) {
                this.completePooledConstruction(player, item);
            }

            // Sync the reactive HUD cash wallet display (handled by profile.removeCash internally)
            return true;
        }

        // --- HANDLE INDIVIDUAL LOADOUT PURCHASES ---
        if (profile.getCash() < calculatedCost) {
            const trackLvl = profile.tracks[item.requiredTrack].level;
            mod.DisplayNotificationMessage(
                mod.Message("INSUFFICIENT FUNDS: Surcharged Cost is ${} (Your Tier Lvl: {})", calculatedCost, trackLvl),
                player
            );
            return false;
        }

        // Complete transaction: deduct MATCH cash
        profile.removeCash(calculatedCost);

        // Override loadout inventory programmatically to prevent duplicate inventory clogging
        this.grantPurchasedGear(player, item);

        // Play positive transactional SFX
        const eyePos = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
        const purchaseSfx = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
            eyePos,
            mod.CreateVector(0, 0, 0)
        );
        mod.PlaySound(purchaseSfx, 40);

        mod.DisplayNotificationMessage(
            mod.Message("Acquisition Success: Loadout Issued! -${}", calculatedCost),
            player
        );

        // Sync the reactive HUD cash wallet display (handled by profile.removeCash internally)
        return true;
    }

    /**
     * Programmatically overwrites slots to keep players at strict inventory limits.
     */
    private grantPurchasedGear(player: mod.Player, item: ShopItem): void {
        if (item.gearType === "weapon") {
            // Remove current primary weapon first to prevent overlapping bugs
            mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
            mod.AddEquipment(player, item.assetId, item.weaponPackage);
        } else if (item.gearType === "gadget") {
            // Remove current deployable gadget slot to replace cleanly
            mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);
            mod.AddEquipment(player, item.assetId);
        }
    }

    /**
     * Actives stationary spawner or toggles pre-placed Godot scene visibility layers.
     */
    private completePooledConstruction(player: mod.Player, item: ShopItem): void {
        mod.DisplayNotificationMessage(
            mod.Message("COOPERATIVE UNLOCK: {} is fully funded and constructed!", item.name),
            mod.GetTeam(player)
        );

        // Turn on the pre-placed Godot scene entities natively using their specific ObjId
        if (item.gearType === "emplacement") {
            const spawner = mod.GetEmplacementSpawner(item.assetId);
            mod.SetEmplacementSpawnerAutoSpawn(spawner, true);
            mod.ForceEmplacementSpawnerSpawn(spawner);
        }

        // Reset pooled contribution totals so repeatable elements can be rebuilt if destroyed
        item.pooledCash = 0;
    }
}
