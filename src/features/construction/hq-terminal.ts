import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "../progression/profile";

export interface CarrierState {
    playerId: number;
    hasCrate: boolean;
    teamId: number;
}

/**
 * HQ Supply Loading Terminals.
 * Implements the logistics supply chain origin. Drivers/Pilots load heavy Supply Crates
 * at their faction HQs, applying a 0.7x speed multiplier and disabling sprints/slides 
 * until deposited at a Forward Operating Base (F.O.B.).
 */
export class HQLogisticsTerminalSystem {
    private carriers: Map<number, CarrierState> = new Map();
    private activeTerminals = [111, 221, 331]; // Standard HQ Console terminal ObjIds [245]

    constructor() {
        this.registerHQTerminalEvents();
    }

    private registerHQTerminalEvents(): void {
        // Intercept interaction with the HQ consoles
        Events.OnPlayerInteract.subscribe((player, interactPoint) => {
            const interactId = mod.GetObjId(interactPoint);
            
            // Ensure player is interacting with their own Faction's HQ buy station console [245]
            if (this.activeTerminals.indexOf(interactId) !== -1) {
                const team = mod.GetTeam(player);
                const teamId = mod.GetObjId(team);
                
                // Secure team mapping validation: Terminal 111 -> Team 1, 221 -> Team 2, 331 -> Team 3 [253]
                const terminalMatch = (interactId === 111 && teamId === 1) || 
                                      (interactId === 221 && teamId === 2) || 
                                      (interactId === 331 && teamId === 3);

                if (terminalMatch) {
                    this.tryLoadLogisticsCrate(player, teamId);
                }
            }
        });

        // Intercept player deployment to clear speed debuffs and reset states on respawn [177]
        Events.OnPlayerDeployed.subscribe((player) => {
            const playerId = mod.GetObjId(player);
            if (this.carriers.has(playerId)) {
                this.removeCarrierDebuffs(player);
                this.carriers.delete(playerId);
            }
        });

        // Intercept player death to drop cargo in the world if killed in transit [177]
        Events.OnPlayerDied.subscribe((player) => {
            const playerId = mod.GetObjId(player);
            if (this.carriers.has(playerId) && this.carriers.get(playerId)!.hasCrate) {
                this.removeCarrierDebuffs(player);
                this.carriers.delete(playerId);
                
                console.log(`[WARDOGS LOGISTICS] Carrier killed in transit. Cargo destroyed or dropped.`);
                mod.DisplayNotificationMessage(
                    mod.Message("CARGO DESTROYED: Supply truck driver was eliminated in transit!"),
                    player
                );
            }
        });
    }

    /**
     * Equips a heavy supply cargo pack and applies high-stakes movement restrictions.
     */
    public tryLoadLogisticsCrate(player: mod.Player, teamId: number): boolean {
        if (!mod.IsPlayerValid(player)) return false;

        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);
        if (!profile) return false;

        // Check A: Prevent carrying multiple crates concurrently
        if (this.carriers.has(playerId) && this.carriers.get(playerId)!.hasCrate) {
            mod.DisplayNotificationMessage(
                mod.Message("LOADING DENIED: You are already carrying a heavy Logistics Cargo Pack!"),
                player
            );
            return false;
        }

        // Check B: Ensure player has a primary slot or Gadget slot free to carry the cargo
        if (mod.HasEquipment(player, mod.Gadgets.Deployable_Vehicle_Supply_Crate)) {
            mod.DisplayNotificationMessage(
                mod.Message("LOADING DENIED: Gadget slots are currently occupied."),
                player
            );
            return false;
        }

        // Equip the physical Logistics Cargo Pack (repurposing native supply crate mesh) [240]
        try {
            mod.AddEquipment(
              player,
              mod.Gadgets.Deployable_Vehicle_Supply_Crate,
            );
        } catch (e) {
            console.log(`[WARDOGS LOGISTICS] Fail-safe error adding cargo pack equipment: ${e}`);
            return false;
        }

        // Set carrier memory states
        this.carriers.set(playerId, {
            playerId,
            hasCrate: true,
            teamId
        });

        // Apply Heavy Object Weight Debuffs to mimic Project Reality and Squad: [29]
        // 1. Slow movement velocity to 0.7x normal speeds
        mod.SetPlayerMovementSpeedMultiplier(player, 0.7);
        // 2. Lock sprinting capabilities
        mod.EnableInputRestriction(player, mod.RestrictedInputs.Sprint, true);
     
        console.log(`[WARDOGS LOGISTICS] Player ${profile.name} loaded heavy logistics crate. Speed throttled to 0.7x.`);
        
        mod.DisplayNotificationMessage(
            mod.Message("CARGO LOADED: Heavy supplies acquired! Speed: 0.7x. Sprint/Slide: LOCKED. Deliver to an active F.O.B. Buy Station."),
            player
        );

        return true;
    }

    /**
     * Called by fob-stockpile.ts upon successful delivery to safely strip speed multipliers and input locks.
     */
    public clearCarrierAfterDelivery(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        if (this.carriers.has(playerId)) {
            this.removeCarrierDebuffs(player);
            this.carriers.delete(playerId);
            console.log(`[WARDOGS LOGISTICS] Carrier successfully cleared of weight debuffs post-delivery.`);
        }
    }

    private removeCarrierDebuffs(player: mod.Player): void {
        if (!mod.IsPlayerValid(player)) return;

        // Restore baseline physics values
        mod.SetPlayerMovementSpeedMultiplier(player, 1.0);
        mod.EnableInputRestriction(player, mod.RestrictedInputs.Sprint, false);
    }
}
