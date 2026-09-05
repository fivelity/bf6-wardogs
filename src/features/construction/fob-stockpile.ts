// src/features/construction/fob-stockpile.ts
import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "../progression/profile";

/**
 * Advanced F.O.B logistics and material stockpile manager.
 * Structures the tactical coordinate chain, validating physical Cargo Pack deliveries,
 * updating Sector material pools natively, and rewarding Logistics Carriers cash/XP.
 */
export class FobLogisticsManager {
    // Maps Sector ObjIds directly to in-memory material stockpiles
    private fobMaterialStockpiles: Map<number, number> = new Map();
    private readonly maxStockpileCapacity = 2000; // Cap to prevent infinite construction hoarding
    private readonly supplyCargoAwardCash = 800; // Cash payout per cargo crate delivered
    private readonly supplyCargoAwardXp = 300; // Driver XP awarded to logistics players

    constructor() {
        // Initialize FOB Alpha (Sector 3001) with 100 baseline materials
        this.fobMaterialStockpiles.set(3001, 100);
        // Initialize FOB Beta (Sector 3002) with 100 baseline materials
        this.fobMaterialStockpiles.set(3002, 100);
        // Initialize FOB Gamma (Sector 3003) with 100 baseline materials
        this.fobMaterialStockpiles.set(3003, 100);

        this.registerLogisticsHooks();
    }

    /**
     * Binds lifecycle hooks to intercept physical supply crate delivery interactions.
     */
    private registerLogisticsHooks(): void {
        // Logistics carrier unloads supplies by interacting with the FOB terminal
        Events.OnPlayerInteract.subscribe((player, interactPoint) => {
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

            const interactId = mod.GetObjId(interactPoint);
            
            // Check if player is interacting with an FOB Buy Station (ObjIds 111, 221, 331)
            if (interactId === 111 || interactId === 221 || interactId === 331) {
                this.tryUnloadSupplyCargo(player, interactId);
            }
        });
    }

    /**
     * Resolves and processes physical cargo unloads. Deducts the backpack asset,
     * credits the player's wallet, awards Driver XP, and deposits materials.
     */
    private tryUnloadSupplyCargo(player: mod.Player, buyStationId: number): void {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);

        if (!profile) {
            console.log(`[WARDOGS LOGISTICS] Profile missing for player ID: ${playerId}`);
            return;
        }

        // Check if player is carrying a role-defining Logistics Cargo Pack
        // Repurposed from standard Deployable Supply Crate slot (GadgetOne)
        if (mod.HasEquipment(player, mod.Gadgets.Class_Supply_Bag)) {
          // Unload cargo pack programmatically by stripping the slot
          mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);

          // Resolve target FOB Sector based on buyStationId
          const targetSectorId = this.getSectorFromBuyStation(buyStationId);
          const currentMaterials =
            this.fobMaterialStockpiles.get(targetSectorId) ?? 0;

          if (currentMaterials >= this.maxStockpileCapacity) {
            mod.DisplayNotificationMessage(
              mod.Message(
                "DELIVERY BLOCKED: FOB Stockpile is already at maximum capacity (2,000/2,000)!",
              ),
              player,
            );
            // Return the crate to the player's loadout to prevent loss
            mod.AddEquipment(player, mod.Gadgets.Class_Supply_Bag);
            return;
          }

          // Credit 500 Materials to the FOB's local stockpile
          const newMaterials = Math.min(
            this.maxStockpileCapacity,
            currentMaterials + 500,
          );
          this.fobMaterialStockpiles.set(targetSectorId, newMaterials);

          // Award persistent match cash and specialized Driver track XP
          profile.addCash(
            this.supplyCargoAwardCash,
            "FOB Logistics Cargo Dropoff",
          );
          profile.addTrackXp("Driver", this.supplyCargoAwardXp);

          // Trigger positive pickup audio feedback
          const eyePos = mod.GetSoldierState(
            player,
            mod.SoldierStateVector.EyePosition,
          );
          const dropoffSfx = mod.SpawnObject(
            mod.RuntimeSpawn_Common
              .SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
            eyePos,
            mod.CreateVector(0, 0, 0),
          );
          mod.PlaySound(dropoffSfx, 50);

          // Broadcast delivery notifications directly to the player's HUD
          mod.DisplayNotificationMessage(
            mod.Message(
              "CARGO SECURED: +500 FOB Materials. Earnings: +${}, +{} Driver XP!",
              this.supplyCargoAwardCash,
              this.supplyCargoAwardXp,
            ),
            player,
          );

          console.log(
            `[WARDOGS LOGISTICS] Contractor ${profile.name} delivered Supplies to FOB Sector ${targetSectorId}. New Stockpile: ${newMaterials}/2000`,
          );
        } else {
          // Player interacted without supplies
          const targetSectorId = this.getSectorFromBuyStation(buyStationId);
          const currentMaterials =
            this.fobMaterialStockpiles.get(targetSectorId) ?? 0;

          mod.DisplayNotificationMessage(
            mod.Message(
              "FOB Stockpile: {} / 2,000 Materials. (Requires Cargo Pack from HQ)",
              currentMaterials,
            ),
            player,
          );
        }
    }

    /**
     * Resolves the coordinate Sector ObjId associated with a specific Buy Station console ObjId.
     */
    private getSectorFromBuyStation(buyStationId: number): number {
        switch (buyStationId) {
            case 111: return 3001; // Alpha FOB [Granite Sector Alpha]
            case 221: return 3002; // Beta FOB
            case 331: return 3003; // Gamma FOB
            default: return 3001;
        }
    }

    /**
     * Public getter to query F.O.B material stockpiles from building managers.
     */
    public getFobStockpile(sectorId: number): number {
        return this.fobMaterialStockpiles.get(sectorId) ?? 0;
    }

    /**
     * Programmatically consumes materials from the local stockpile during F.O.B construction strikes.
     * @returns true if materials were successfully deducted; false if stockpile was insufficient.
     */
    public consumeMaterials(sectorId: number, amount: number): boolean {
        const current = this.getFobStockpile(sectorId);
        if (current < amount) return false;

        this.fobMaterialStockpiles.set(sectorId, current - amount);
        return true;
    }
}
