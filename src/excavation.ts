// src/features/construction/excavation.ts
import { Events, Timers } from "bf6-portal-utils";
import { mercenaryRegistry } from "../progression/profile";

export type FortificationClass = "sandbags" | "hesco_wall" | "watchtower" | "emplacement";

export interface FortificationSocket {
    objId: number;                  // Unique Godot ObjId assigned in Level_Setup.tscn
    name: string;                   // Game-friendly name (e.g. "Front-line Hesco Wall")
    fortClass: FortificationClass;
    basePosition: mod.Vector;       // Target coordinate when fully built (surface level)
    buriedDepth: number;            // Distance (Y-axis) buried beneath terrain (e.g. -2m, -4m, -15m)
    currentHeightOffset: number;    // Current height offset (starts at buriedDepth, progresses to 0)
    liftIncrement: number;          // Height added per successful sledgehammer hit
    materialCost: number;           // Material units consumed from local FOB pool per hit/construction step
    hitsRemaining: number;
    totalHitsRequired: number;
    isBuilt: boolean;
    isActiveBlueprint: boolean;     // True once designated by a PDA scanner
    worldIconNode: mod.WorldIcon | null; // Indicator floating above the socket
    spatialAsset: mod.SpatialObject | null; // Godot scene prop node
    stationarySpawnerId?: number;   // If emplacement, the stationary weapon spawner ObjId to activate
}

/**
 * Advanced Excavation/Lift FOB Construction System for WARDOGS.
 * 
 * Bypasses the SDK's inability to dynamically spawn new collidable meshes or handle
 * transparent previews by pre-placing entities deep underneath map terrain in Godot.
 * Support and Logistics PMCs designate placements with their PDA (Portal Gadget), then
 * physically "excavate" the structures into the play-space using sledgehammer blows.
 */
export class ExcavationSystem {
    private sockets: Map<number, FortificationSocket> = new Map();
    private activeSwings: Map<number, { lastSwingTime: number }> = new Map();
    private meleeCheckInterval: any = null;

    constructor() {
        this.registerSockets();
        this.startMeleeSwingListener();
    }

    /**
     * Pre-populates unbuilt F.O.B fortification sockets based on Level_Setup.tscn coordinates.
     */
    private registerSockets(): void {
        // Pre-map unbuilt sockets with their class boundaries and depths.
        // Coordinate reference values matching MP_Granite_MilitaryStorage sectors:
        this.addSocket({
            objId: 5001,
            name: "Hesco Guard Barrier",
            fortClass: "hesco_wall",
            basePosition: mod.CreateVector(903.11, 228.33, 203.79), // Centered near active zones
            buriedDepth: -4.0,
            currentHeightOffset: -4.0,
            liftIncrement: 0.1, // Raises 10cm per hit
            materialCost: 150,
            totalHitsRequired: 40,
            hitsRemaining: 40,
            isBuilt: false,
            isActiveBlueprint: false,
            worldIconNode: null,
            spatialAsset: null
        });

        this.addSocket({
            objId: 5002,
            name: "Concentric Sandbag Fort",
            fortClass: "sandbags",
            basePosition: mod.CreateVector(915.42, 228.33, 195.12),
            buriedDepth: -2.0,
            currentHeightOffset: -2.0,
            liftIncrement: 0.2, // Raises 20cm per hit
            materialCost: 50,
            totalHitsRequired: 10,
            hitsRemaining: 10,
            isBuilt: false,
            isActiveBlueprint: false,
            worldIconNode: null,
            spatialAsset: null
        });

        this.addSocket({
            objId: 5003,
            name: "GDF009 Stationary AA Nest",
            fortClass: "emplacement",
            basePosition: mod.CreateVector(885.67, 229.50, 215.33),
            buriedDepth: -5.0, // Pre-placed protective concrete pit buried 5 meters
            currentHeightOffset: -5.0,
            liftIncrement: 0.125,
            materialCost: 400,
            totalHitsRequired: 40,
            hitsRemaining: 40,
            isBuilt: false,
            isActiveBlueprint: false,
            worldIconNode: null,
            spatialAsset: null,
            stationarySpawnerId: 121 // Connects to GDF009 Stationary Spawner ObjId 121
        });
    }

    private addSocket(socket: FortificationSocket): void {
        this.sockets.set(socket.objId, socket);
    }

    /**
     * Scans for player coordinates to locate the nearest unbuilt Godot socket.
     */
    public findNearestSocket(aimCoord: mod.Vector, maxSearchRadius: number): number | null {
        let closestId: number | null = null;
        let minDistance = maxSearchRadius;

        this.sockets.forEach((socket) => {
            if (socket.isBuilt) return;

            const distance = mod.DistanceBetween(socket.basePosition, aimCoord);
            if (distance < minDistance) {
                minDistance = distance;
                closestId = socket.objId;
            }
        });

        return closestId;
    }

    /**
     * Activates a socket as a "Placed Blueprint," spawning visual 3D indicators for building teams.
     */
    public registerBlueprint(player: mod.Player, socketId: number): boolean {
        const socket = this.sockets.get(socketId);
        if (!socket || socket.isBuilt || socket.isActiveBlueprint) return false;

        socket.isActiveBlueprint = true;

        // Resolve spatial asset from Godot engine and lock its starting buried coordinate
        socket.spatialAsset = mod.GetSpatialObject(socket.objId);
        const buriedPos = mod.CreateVector(
            mod.XComponentOf(socket.basePosition),
            mod.YComponentOf(socket.basePosition) + socket.buriedDepth,
            mod.ZComponentOf(socket.basePosition)
        );
        mod.SetObjectPosition(socket.spatialAsset, buriedPos);

        // Spawn world icon locator slightly floating above the surface position
        const iconPos = mod.CreateVector(
            mod.XComponentOf(socket.basePosition),
            mod.YComponentOf(socket.basePosition) + 1.0,
            mod.ZComponentOf(socket.basePosition)
        );
        socket.worldIconNode = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            iconPos,
            mod.CreateVector(0, 0, 0)
        ) as mod.WorldIcon;

        mod.SetWorldIconImage(socket.worldIconNode, mod.WorldIconImages.Supplies);
        mod.EnableWorldIconImage(socket.worldIconNode, true);
        mod.SetWorldIconColor(socket.worldIconNode, mod.CreateVector(1.0, 0.8, 0.0)); // Blueprint Warning Yellow
        mod.EnableWorldIconText(socket.worldIconNode, true);

        // Format and push blueprint label
        mod.SetWorldIconText(
            socket.worldIconNode, 
            mod.Message(`UNBUILT: ${socket.name}\n[Sledgehammer Required]`)
        );

        mod.DisplayNotificationMessage(
            mod.Message("PDA BLUEPRINT SET: {} is marked for construction!", socket.name),
            null, // Broadlog to team
            mod.GetTeam(player)
        );

        return true;
    }

    /**
     * Dynamic clock checking for sledgehammer melee attacks.
     * Evaluates active weapon states and fires raycasts on attack ticks to simulate hit registration.
     */
    private startMeleeSwingListener(): void {
        this.meleeCheckInterval = Timers.setInterval(() => {
            const players = mod.AllPlayers();
            const playerCount = mod.CountOf(players);

            for (let i = 0; i < playerCount; i++) {
                const player = mod.ValueInArray(players, i);
                if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) continue;
                if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) continue;

                const playerId = mod.GetObjId(player);

                // Verify the player has their Melee weapon equipped and is actively swinging
                const hasMeleeEquipped = mod.IsInventorySlotActive(player, mod.InventorySlots.SecondaryWeapon); // Note: Melee mapped to secondary/knife slots in SDK
                const isSwinging = mod.GetSoldierState(player, mod.SoldierStateBool.IsFiring);

                if (hasMeleeEquipped && isSwinging) {
                    const now = Date.now();
                    const lastSwing = this.activeSwings.get(playerId) || { lastSwingTime: 0 };

                    // Debounce swings to match physical sledgehammer recovery times (e.g. 1.2 seconds)
                    if (now - lastSwing.lastSwingTime >= 1200) {
                        this.activeSwings.set(playerId, { lastSwingTime: now });
                        this.performSledgehammerRaycast(player);
                    }
                }
            }
        }, 100);
    }

    /**
     * Executes short-range raycasting to register structural hits.
     */
    private performSledgehammerRaycast(player: mod.Player): void {
        const eyePos = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
        const facing = mod.Normalize(mod.GetSoldierState(player, mod.SoldierStateVector.GetFacingDirection));
        
        const startPoint = mod.Add(eyePos, mod.Multiply(facing, 0.4));
        const endPoint = mod.Add(startPoint, mod.Multiply(facing, 2.5)); // 2.5 meters melee strike length

        // Perform raycast check
        this.sockets.forEach((socket, socketId) => {
            if (socket.isBuilt || !socket.isActiveBlueprint) return;

            const distanceToSocket = mod.DistanceBetween(socket.basePosition, endPoint);
            if (distanceToSocket <= 3.0) { // Ray hit within structural hitbox
                this.executeExcavationHit(player, socketId);
            }
        });
    }

    /**
     * Increments height progress, plays audio feedback, and executes material pooling checks.
     */
    private executeExcavationHit(player: mod.Player, socketId: number): void {
        const socket = this.sockets.get(socketId);
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);

        if (!socket || !profile) return;

        // Check if player's team owns the F.O.B sector first
        // (In WARDOGS, team materials are simulated from individual cash conversions during construction)
        const hitMaterialCost = Math.round(socket.materialCost / socket.totalHitsRequired);
        if (profile.cash < hitMaterialCost) {
            mod.DisplayNotificationMessage(
                mod.Message("CONSTRUCTION FAILED: Insufficient Cash for Material Conversion"),
                player
            );
            return;
        }

        // Deduct transactional cash, converting it to active structural materials
        profile.removeCash(hitMaterialCost, "Fortification Materials");
        profile.addTrackXp("Support", 15); // Award Support XP for building bases

        // Play sledgehammer impact thud audio at hitting coordinate
        const eyePos = mod.GetSoldierState(player, mod.SoldierStateVector.EyePosition);
        const hitSfx = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D, // Repurposing defib spark thud as metallic hammer clank
            eyePos,
            mod.CreateVector(0, 0, 0)
        );
        mod.PlaySound(hitSfx, 75);

        // Update progress height metrics
        socket.hitsRemaining--;
        socket.currentHeightOffset = Math.min(0, socket.currentHeightOffset + socket.liftIncrement);

        const progressPercent = Math.round(((socket.totalHitsRequired - socket.hitsRemaining) / socket.totalHitsRequired) * 100);

        // DYNAMIC LIFT TRANSFORMATION: Smoothly slide object up by lift increment
        const nextPosition = mod.CreateVector(
            mod.XComponentOf(socket.basePosition),
            mod.YComponentOf(socket.basePosition) + socket.currentHeightOffset,
            mod.ZComponentOf(socket.basePosition)
        );

        if (socket.spatialAsset) {
            // Programmatically slide object vertical upward through map terrain
            mod.MoveObjectOverTime(
                socket.spatialAsset,
                nextPosition,
                mod.CreateVector(0, 0, 0), // Maintain original rotation
                0.2, // Fast, snappy 200ms slide increments
                false,
                false
            );
        }

        // Update active WorldIcon description labels
        if (socket.worldIconNode) {
            mod.SetWorldIconText(
                socket.worldIconNode,
                mod.Message(`BUILDING: ${socket.name}\nProgress: {}% (${socket.hitsRemaining} hits left)`, progressPercent)
            );
        }

        // Check for 100% excavation completion
        if (socket.hitsRemaining <= 0) {
            this.completeExcavation(player, socket);
        }
    }

    /**
     * Spawns completed assets and activates stationary spawners for heavy weapon pits.
     */
    private completeExcavation(player: mod.Player, socket: FortificationSocket): void {
        socket.isBuilt = true;
        socket.isActiveBlueprint = false;

        // Force snap spatial object to perfect surface coordinates
        if (socket.spatialAsset) {
            mod.SetObjectPosition(socket.spatialAsset, socket.basePosition);
        }

        // Clean up unneeded construction icons
        if (socket.worldIconNode) {
            mod.UnspawnObject(socket.worldIconNode);
            socket.worldIconNode = null;
        }

        // --- HANDLE STATIONARY WEAPONS DELIVERIES ---
        if (socket.fortClass === "emplacement" && socket.stationarySpawnerId !== undefined) {
            const spawner = mod.GetEmplacementSpawner(socket.stationarySpawnerId);
            mod.SetEmplacementSpawnerAutoSpawn(spawner, true);
            mod.ForceEmplacementSpawnerSpawn(spawner); // Snaps AA gun natively into the excavated pit platform
        }

        // Play large assembly success explosion/dust effect
        const successSfx = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SFX_Gadgets_Defibrillator_Equipped_Fire_OneShot2D,
            socket.basePosition,
            mod.CreateVector(0, 0, 0)
        );
        mod.PlaySound(successSfx, 100);

        mod.DisplayNotificationMessage(
            mod.Message("FORTIFICATION COMPILED: {} is fully constructed!", socket.name),
            null, // Broadlog
            mod.GetTeam(player)
        );
    }

    public shutdown(): void {
        if (this.meleeCheckInterval) {
            Timers.clearInterval(this.meleeCheckInterval);
        }
        this.sockets.forEach((socket) => {
            if (socket.worldIconNode) {
                mod.UnspawnObject(socket.worldIconNode);
            }
        });
        this.sockets.clear();
        this.activeSwings.clear();
    }
}

// Centrally instantiated excavation builder manager
export const excavationManager = new ExcavationSystem();
