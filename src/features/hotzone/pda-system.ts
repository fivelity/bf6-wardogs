import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry } from "../progression/profile";
import { TowerRedirectionSystem } from "./redirection";

/**
 * PDA Interaction System for Tower Redirection.
 * Enables Support players to interact with radio towers using their PDA to trigger redirection.
 */
export class PdaTowerInteractionSystem {
    private towerRedirectionSystem: TowerRedirectionSystem;
    private pdaInteractionTimerId: any = null;

    constructor(towerRedirectionSystem: TowerRedirectionSystem) {
        this.towerRedirectionSystem = towerRedirectionSystem;
        this.registerPdaInteractionHooks();
        this.startPdaInteractionLoop();
    }

    private registerPdaInteractionHooks(): void {
        // Listen for PDA interaction events - we'll simulate this with button presses
        // In a real implementation, you'd use the actual UI event system
        Events.OnPlayerUIButtonEvent.subscribe((player, widget, event) => {
            // This is where you would handle specific PDA UI interactions
            // For now, we'll simulate it by checking if player is near a tower
            this.handlePdaInteraction(player);
        });
    }

    private startPdaInteractionLoop(): void {
        // Run a 1Hz loop to check for PDA interactions
        this.pdaInteractionTimerId = Timers.setInterval(() => {
            // This would be where we check for PDA button presses or UI interactions
            // For now, we'll just log that we're checking
        }, 1000);
    }

    /**
     * Handle PDA interaction with radio towers.
     * This is a simplified version - in reality you'd implement proper UI handling.
     */
    private handlePdaInteraction(player: mod.Player): void {
        if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;

        const playerPos = mod.GetPlayerState(player, mod.PlayerStateVector.Position);
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);

        if (!profile) return;

        // Check if player is near any radio tower
        const towers = this.towerRedirectionSystem.getAllTowers();
        
        for (const [objId, tower] of towers.entries()) {
            const distance = mod.DistanceBetween(playerPos, 
                mod.CreateVector(tower.position.x, 227.5, tower.position.z));
            
            // Check if player is within interaction range (e.g., 10 meters)
            if (distance <= 10.0) {
                // Check if player has Support role or appropriate gear
                if (this.isSupportPlayer(player)) {
                    this.attemptRedirection(player, objId);
                } else {
                    mod.DisplayNotificationMessage(
                        mod.Message("ACCESS DENIED: Only Support players can access tower redirection systems."),
                        player
                    );
                }
                break; // Only interact with the closest tower
            }
        }
    }

    private isSupportPlayer(player: mod.Player): boolean {
        // Check if player has support role gear or equipment
        // This could be checking for specific gadgets or class roles
        const hasSupportGadget = mod.HasEquipment(player, mod.Gadgets.U_DeployableCover) || 
                               mod.HasEquipment(player, mod.Gadgets.Misc_PortalGadget);
        
        return hasSupportGadget;
    }

    /**
     * Attempt to trigger redirection at a tower.
     * This is the main method called when a player interacts with a tower via PDA.
     */
    private attemptRedirection(player: mod.Player, towerObjId: number): void {
        const playerTeam = mod.GetTeam(player);
        const teamId = mod.GetObjId(playerTeam);
        
        if (teamId < 1 || teamId > 3) return;

        // Call the redirection system to try triggering redirection
        const success = this.towerRedirectionSystem.tryTriggerRedirection(player, towerObjId);
        
        if (success) {
            // Show visual feedback for successful redirection
            mod.DisplayNotificationMessage(
                mod.Message("REDIRECTION INITIATED: Satellite vector lock engaged!"),
                player
            );
            
            // Play success sound effect
            const pos = mod.GetPlayerState(player, mod.PlayerStateVector.Position);
            const sfx = mod.SpawnObject(
                mod.RuntimeSpawn_Common.SFX_UI_Artillery,
                pos,
                mod.CreateVector(0, 0, 0)
            );
            mod.EnableSFX(sfx, true);
            mod.PlaySound(sfx, 1.0);
        } else {
            // Show failure feedback
            mod.DisplayNotificationMessage(
                mod.Message("REDIRECTION FAILED: Cannot initiate satellite lock at this time."),
                player
            );
        }
    }

    public shutdown(): void {
        if (this.pdaInteractionTimerId) {
            Timers.clearInterval(this.pdaInteractionTimerId);
        }
    }
}