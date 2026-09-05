import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry } from "../progression/profile";

export interface VehicleCarcassState {
    vehicleObjId: number;
    name: string;
    position: mod.Vector;
    scrapMaterialsRemaining: number;
    isFullySalvaged: boolean;
    vehicleType: string; // Added for more comprehensive vehicle type detection
}

/**
 * Dynamic Vehicle Wreck Salvaging.
 * Enables Support engineers to extract raw building materials from blown-up vehicle carcasses
 * on the front lines by physically striking them with the Sledgehammer.
 * Integrates directly with the captured FOB's material stockpiles. [170]
 */
export class VehicleWreckSalvageSystem {
    private carcasses: Map<number, VehicleCarcassState> = new Map();
    private tickTimerId: any = null;

    private readonly SALVAGE_RANGE = 4.5;    // Maximum range in meters to swing and salvage scrap
    private readonly SCRAP_PER_HIT = 10;     // Materials extracted per sledgehammer hit
    private readonly MAX_SCRAP_PER_VEHICLE = 150; // Total materials available in a single husk [170]

    // Callback to add salvaged materials directly to the nearest FOB sector stockpile
    private depositMaterialsCallback: (sectorId: number, amount: number) => void;

    constructor(depositMaterialsCallback: (sectorId: number, amount: number) => void) {
        this.depositMaterialsCallback = depositMaterialsCallback;
        this.registerVehicleCarcassHooks();
        this.startCarcassSweep();
    }

    private registerVehicleCarcassHooks(): void {
        // Listen for vehicle destruction events to properly track when vehicles are destroyed
        mod.Events.OnVehicleDestroyed.subscribe((vehicle) => {
            const vehicleId = mod.GetObjId(vehicle);
            
            // Get vehicle position
            const pos = mod.GetObjectPosition(vehicle);
            
            // Determine vehicle type based on its object ID or other characteristics
            const vehicleType = this.determineVehicleType(vehicleId);
            
            // Register the vehicle as a carcass
            this.carcasses.set(vehicleId, {
                vehicleObjId: vehicleId,
                name: "Destroyed Vehicle Husk",
                position: pos,
                scrapMaterialsRemaining: this.MAX_SCRAP_PER_VEHICLE,
                isFullySalvaged: false,
                vehicleType: vehicleType
            });
            
            console.log(`[WARDOGS SALVAGE] Destroyed vehicle husk registered at: ${mod.XComponentOf(pos)}, ${mod.ZComponentOf(pos)} (Type: ${vehicleType})`);
        });
    }

    private determineVehicleType(vehicleId: number): string {
        // Map vehicle IDs to their types for better identification
        const vehicleTypes: Record<number, string> = {
            101: "M1A2 Abrams",
            102: "F-35 Lightning II",
            103: "AH-64 Apache",
            104: "UH-60 Black Hawk",
            105: "M2A1 Bradley",
            106: "M1128 Stryker",
            110: "M109A7 Howitzer",
            220: "F-15 Eagle",
            330: "Mi-28 Havoc"
        };
        
        return vehicleTypes[vehicleId] || "Unknown Vehicle";
    }

    private startCarcassSweep(): void {
        // 1. Throttled 1Hz sweeper: Scans for active vehicle wrecks on the map
        this.tickTimerId = Timers.setInterval(() => {
            // Retrieve all vehicle entities natively spawned in the world [185]
            // We search for standard vehicle ObjIds from level.spatial.json (Abrams, Wildcats, AH64, UH60)
            const activeVehicleObjIds = [101, 102, 103, 104, 105, 106, 110, 220, 330];

            for (const objId of activeVehicleObjIds) {
                try {
                    const vehicle = mod.GetVehicle(objId);
                    if (vehicle && !mod.GetVehicleState(vehicle, mod.VehicleStateBool.IsAlive)) {
                        // If vehicle is dead/destroyed and not yet registered as a carcass
                        if (!this.carcasses.has(objId)) {
                            const pos = mod.GetObjectPosition(vehicle);
                            
                            this.carcasses.set(objId, {
                                vehicleObjId: objId,
                                name: "Destroyed Vehicle Husk",
                                position: pos,
                                scrapMaterialsRemaining: this.MAX_SCRAP_PER_VEHICLE,
                                isFullySalvaged: false
                            });

                            console.log(`[WARDOGS SALVAGE] Destroyed vehicle husk registered at: ${mod.XComponentOf(pos)}, ${mod.ZComponentOf(pos)}`);
                        }
                    }
                } catch (e) {
                    // Fail-safe: Skip indices that are not actively spawned in the current session
                }
            }

            // 2. 10Hz swing loop: Detects sledgehammer hits on active carcass coordinates [179]
            this.evaluateSledgehammerSwings();
        }, 1000);
    }

    private evaluateSledgehammerSwings(): void {
        mod.AllPlayers().forEach((player) => {
            if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;

            // Step A: Ensure player is holding their Sledgehammer and swinging/firing [188]
            const isHoldingMelee = mod.HasEquipment(player, mod.Weapons.Melee_Sledgehammer) &&
                                   mod.GetSoldierState(player, mod.SoldierStateBool.IsFiring);

            if (!isHoldingMelee) return;

            const playerPos = mod.GetPlayerState(player, mod.PlayerStateVector.Position);

            // Step B: Check proximity to any registered vehicle carcasses
            this.carcasses.forEach((carcass, objId) => {
                if (carcass.isFullySalvaged) return;

                const distance = mod.DistanceBetween(playerPos, carcass.position);

                if (distance <= this.SALVAGE_RANGE) {
                    this.executeSalvageHit(player, carcass);
                }
            });
        });
    }

    private executeSalvageHit(player: mod.Player, carcass: VehicleCarcassState): void {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);
        if (!profile) return;

        // Perform transactional material reduction
        carcass.scrapMaterialsRemaining -= this.SCRAP_PER_HIT;
        
        // Play metallic thucking impact sound effect natively [166]
        const hitSFX = mod.SpawnObject(
            mod.RuntimeSpawn_Common.SFX_Search_Core_Kit, // Standard heavy foley click [166]
            carcass.position,
            mod.CreateVector(0, 0, 0)
        );
        mod.EnableSFX(hitSFX, true);
        mod.PlaySound(hitSFX, 1.0);

        // Spawn visual effect at the salvage location for feedback
        const salvageEffect = mod.SpawnObject(
            mod.RuntimeSpawn_Common.FX_Misc_Explosion_Smoke_GS,
            carcass.position,
            mod.CreateVector(0, 0, 0)
        );
        mod.EnableVFX(salvageEffect, true);

        // Resolve closest captured FOB sector to dump materials into
        const nearestSectorId = this.findNearestFobSector(carcass.position);
        
        // Deposit materials directly to the F.O.B stockpile
        this.depositMaterialsCallback(nearestSectorId, this.SCRAP_PER_HIT);

        // Award Support Track progression XP to the engineer [234]
        profile.addTrackXp("Support", 15);
        profile.addCash(50, "Battlefield Salvage Bounty"); // Bonus cash per scrap extraction

        console.log(`[WARDOGS SALVAGE] Contractor ${profile.name} salvaged +10 scrap from carcass ${carcass.vehicleObjId}.`);

        if (carcass.scrapMaterialsRemaining <= 0) {
            carcass.isFullySalvaged = true;
            console.log(`[WARDOGS SALVAGE] Wreck carcass ${carcass.vehicleObjId} fully salvaged.`);
            
            // Show special visual effect for full salvage
            const fullSalvageEffect = mod.SpawnObject(
                mod.RuntimeSpawn_Common.FX_Misc_Explosion_Large_GS,
                carcass.position,
                mod.CreateVector(0, 0, 0)
            );
            mod.EnableVFX(fullSalvageEffect, true);
            
            mod.DisplayNotificationMessage(
                mod.Message("WRECK DEPLETED: All structural scrap metal has been completely salvaged!"),
                player
            );
        } else {
            mod.DisplayNotificationMessage(
                mod.Message(`SALVAGING WRECK: +10 Materials (+50 cash) sent to closest FOB stockpile! [${carcass.scrapMaterialsRemaining} scrap left]`),
                player
            );
        }
    }

    /**
     * Resolves which F.O.B. sector coordinates are closest to the carcass.
     */
    private findNearestFobSector(carcassPos: mod.Vector): number {
        // Granite Map pre-placed sector coordinates [253]
        const sectors = [
            { id: 3001, x: 835.36, z: 254.90 }, // Alpha Sector
            { id: 3002, x: 589.42, z: 529.15 }, // Beta Sector
            { id: 3003, x: 285.91, z: 513.31 }  // Gamma Sector
        ];

        let closestSectorId = 3001;
        let minDistance = Infinity;

        for (const sector of sectors) {
            const sectorVec = mod.CreateVector(sector.x, 150.0, sector.z);
            const dist = mod.DistanceBetween(carcassPos, sectorVec);

            if (dist < minDistance) {
                minDistance = dist;
                closestSectorId = sector.id;
            }
        }

        return closestSectorId;
    }

    public shutdown(): void {
        if (this.tickTimerId) {
            Timers.clearInterval(this.tickTimerId);
        }
    }
}
