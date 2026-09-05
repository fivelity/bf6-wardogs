// src/features/construction/pda-scanner.ts
import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry } from "../progression/profile";
import { excavationManager } from "./excavation";

/**
 * Interface representing a player's active PDA scanning state.
 */
interface PDAScanState {
    isAiming: boolean;
    activeTargetCoord: mod.Vector | null;
    visualCursor: mod.SpatialObject | null;
}

/**
 * High-Tech Building PDA Scanner System for WARDOGS.
 * Repurposes the official Portal Gadget to act as a target-designating device
 * for placing, planning, and selecting F.O.B construction sockets.
 */
export class PDAScannerSystem {
    private scanStates: Map<number, PDAScanState> = new Map();
    private raycastIntervalId: any = null;
    private readonly maxBuildRange = 8.0; // 8 meters maximum designation range

    constructor() {
        this.initializePDACallbacks();
        this.startScanningClock();
    }

    /**
     * Binds native Portal Gadget callbacks and central event systems.
     */
    private initializePDACallbacks(): void {
        // 1. Aiming / Zoom input triggers (Aiming down sights opens cursor preview)
        Events.OnPortalGadgetAimStart.subscribe((player) => {
            this.setAimState(player, true);
        });

        Events.OnPortalGadgetAimStop.subscribe((player) => {
            this.setAimState(player, false);
            this.cleanupCursor(player);
        });

        // 2. Firing / Trigger inputs (Pressing Fire selects or activates blueprint)
        Events.OnPortalGadgetFireStart.subscribe((player) => {
            this.handlePDADesignation(player);
        });

        // 3. Cleanup on death/undeployment or disconnection
        Events.OnPlayerUndeploy.subscribe((player) => {
            this.cleanupPlayerPDAState(player);
        });

        Events.OnPlayerLeaveGame.subscribe((playerId) => {
            const state = this.scanStates.get(playerId);
            if (state && state.visualCursor) {
                mod.UnspawnObject(state.visualCursor);
            }
            this.scanStates.delete(playerId);
        });
    }

    /**
     * Periodically triggers Raycasts for all players currently aiming with the PDA.
     * Uses a lightweight 5Hz (200ms) interval to minimize server compute overhead.
     */
    private startScanningClock(): void {
        this.raycastIntervalId = Timers.setInterval(() => {
            this.scanStates.forEach((state, playerId) => {
                if (!state.isAiming) return;

                const player = mod.GetPlayer(playerId);
                if (!player || !mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) {
                    this.cleanupCursor(player);
                    return;
                }

                // Fire an engine-level RayCast along the player's vector
                this.performRaycast(player);
            });
        }, 200);
    }

    /**
     * Sets a player's zoom state, registering their PDA profile if missing.
     */
    private setAimState(player: mod.Player, isAiming: boolean): void {
        const playerId = mod.GetObjId(player);
        let state = this.scanStates.get(playerId);

        if (!state) {
            state = { isAiming: false, activeTargetCoord: null, visualCursor: null };
            this.scanStates.set(playerId, state);
        }

        state.isAiming = isAiming;
    }

    /**
     * Calculates the eye-start and facing-endpoint vectors to fire the raycast.
     */
    private performRaycast(player: mod.Player): void {
        const eyePos = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
        const facing = mod.Normalize(mod.GetSoldierState(player, mod.SoldierStateVector.GetFacingDirection));

        // Offset start slightly forward to prevent self-colliding with the player mesh
        const startPoint = mod.Add(eyePos, mod.Multiply(facing, 0.5));
        const endPoint = mod.Add(startPoint, mod.Multiply(facing, this.maxBuildRange));

        // Natively invoke the engine's RayCast query
        mod.RayCast(player, startPoint, endPoint);
    }

    /**
     * Callback triggered natively when a player's raycast successfully collides with geometry.
     * Renders a physical ground decal cursor to designate the construction cursor point.
     */
    public handleRaycastHit(player: mod.Player, hitPoint: mod.Vector, normal: mod.Vector): void {
        const playerId = mod.GetObjId(player);
        const state = this.scanStates.get(playerId);

        if (!state || !state.isAiming) return;

        state.activeTargetCoord = hitPoint;

        // Spawn or update the holographic cursor VFX loop at the target surface
        if (!state.visualCursor) {
            state.visualCursor = mod.SpawnObject(
              mod.RuntimeSpawn_Common.FX_Gadget_Sabotage_02_SparkLoop, // Highly visible sparking cursor decal
              hitPoint,
              mod.CreateVector(0, 0, 0),
            );
        } else {
            // Slide cursor smoothly to new coordinates
            mod.SetObjectPosition(state.visualCursor, hitPoint);
        }
    }

    /**
     * Callback triggered natively when a raycast misses or exceeds maxBuildRange.
     */
    public handleRaycastMiss(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const state = this.scanStates.get(playerId);

        if (!state) return;

        state.activeTargetCoord = null;
        this.cleanupCursor(player);
    }

    /**
     * Triggered when the player pulls the PDA's trigger.
     * Selects and activates the unbuilt Godot construction socket at their cursor coordinates.
     */
    private handlePDADesignation(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const state = this.scanStates.get(playerId);
        const profile = mercenaryRegistry.get(playerId);

        if (!state || !state.activeTargetCoord || !profile) {
            mod.DisplayNotificationMessage(mod.Message("PDA ERROR: Aim at ground terrain to designate blueprint"), player);
            return;
        }

        // Cross-reference coordinate sweeps against our unbuilt Godot socket list
        const socketId = excavationManager.findNearestSocket(state.activeTargetCoord, 3.5);

        if (socketId === null) {
            mod.DisplayNotificationMessage(
                mod.Message("PDA ERROR: No pre-placed socket in range of target coord"),
                player
            );
            return;
        }

        // Try activating the designated socket as an active construction target
        const activated = excavationManager.registerBlueprint(player, socketId);

        if (activated) {
            // Play success confirmation chime
            const eyePos = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
            const confirmationSfx = mod.SpawnObject(
                mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
                eyePos,
                mod.CreateVector(0, 0, 0)
            );
            mod.PlaySound(confirmationSfx, 50);
        }
    }

    private cleanupCursor(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const state = this.scanStates.get(playerId);

        if (state && state.visualCursor) {
            mod.UnspawnObject(state.visualCursor);
            state.visualCursor = null;
        }
    }

    private cleanupPlayerPDAState(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        this.cleanupCursor(player);
        this.scanStates.delete(playerId);
    }

    public shutdown(): void {
        if (this.raycastIntervalId) {
            Timers.clearInterval(this.raycastIntervalId);
        }
        this.scanStates.forEach((state) => {
            if (state.visualCursor) {
                mod.UnspawnObject(state.visualCursor);
            }
        });
        this.scanStates.clear();
    }
}

// Centrally instantiated scanner registry
export const pdaScanner = new PDAScannerSystem();
