import { Timers } from 'bf6-portal-utils/timers';
import { Point2D } from "./zone-math";

/**
 * Anti-Camping Mortar Barrages.
 * Evaluates live HotZone occupancies. If a single team holds the double-scoring HotZone 
 * uncontested for more than 45 seconds, the server triggers alarms and launches localized 
 * artillery shells to deter passive camping and force tactical relocations. [147, 160]
 */
export class HotZoneAntiCampingSystem {
    private holdTimerRecord: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    private uncontestedTeamId = 0; // Current team holding the zone uncontested
    private checkTimerId: any = null;
    private barrageTimerId: any = null;

    private readonly CAMPING_THRESHOLD = 45; // Time in seconds before mortar strikes trigger
    private readonly DETONATION_INTERVAL = 1500; // Time in milliseconds between mortar shells [168]
    
    private getZonePlayers: () => Record<number, number>; // Callback to query player counts inside HotZone
    private getHotZonePos: () => Point2D;                 // Callback to fetch live HotZone center coordinates

    constructor(getZonePlayers: () => Record<number, number>, getHotZonePos: () => Point2D) {
        this.getZonePlayers = getZonePlayers;
        this.getHotZonePos = getHotZonePos;
        this.startAntiCampingMonitor();
    }

    private startAntiCampingMonitor(): void {
        this.checkTimerId = Timers.setInterval(() => {
            const counts = this.getZonePlayers(); // Returns e.g. { 1: num, 2: num, 3: num }
            
            // 1. Identify if a team holds the HotZone uncontested
            let holdingTeam = 0;
            let activeFactionsCount = 0;

            for (let teamId = 1; teamId <= 3; teamId++) {
                if (counts[teamId] > 0) {
                    holdingTeam = teamId;
                    activeFactionsCount++;
                }
            }

            // Uncontested means exactly one team occupies the HotZone, with no contest from others
            if (activeFactionsCount === 1) {
                this.uncontestedTeamId = holdingTeam;
                this.holdTimerRecord[holdingTeam]++;

                console.log(`[WARDOGS MORTARS] Faction ${holdingTeam} holds HotZone uncontested: ${this.holdTimerRecord[holdingTeam]}/${this.CAMPING_THRESHOLD}s`);

                // 2. Warn players when approaching the threshold (e.g. 15s and 5s left)
                const timeLeft = this.CAMPING_THRESHOLD - this.holdTimerRecord[holdingTeam];
                if (timeLeft === 15) {
                    this.broadcastWarning("PMC DETECTED: Static camping alert! Satellite radar locking coordinates inside HotZone...");
                } else if (timeLeft === 5) {
                    this.broadcastWarning("FIRE IN THE HOLE: Cockpit radar desync! Incoming mortar barrage detonating inside HotZone in 5s!");
                    this.triggerWarningSirens();
                } else if (timeLeft === 0) {
                    this.triggerBarrage();
                }
            } else {
                // If contested or empty, decay the counters slowly to allow quick resets on cleanups
                for (let teamId = 1; teamId <= 3; teamId++) {
                    this.holdTimerRecord[teamId] = Math.max(0, this.holdTimerRecord[teamId] - 2);
                }
                
                // If a barrage was actively hitting, stop it
                if (this.barrageTimerId) {
                    Timers.clearInterval(this.barrageTimerId);
                    this.barrageTimerId = null;
                    console.log("[WARDOGS MORTARS] Barrage ceased. Zone is now contested or empty.");
                }
            }
        }, 1000);
    }

    private triggerWarningSirens(): void {
        const center = this.getHotZonePos();
        const centerVec = mod.CreateVector(center.x, 150.0, center.z); // High altitude alert [190]
        
        // Spawn siren SFX natively [190]
        const siren = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Alarm, centerVec, mod.CreateVector(0, 0, 0));
        mod.EnableSFX(siren, true);
        mod.PlaySound(siren, 1.0); // Global volume sweep [190]
    }

    private triggerBarrage(): void {
        if (this.barrageTimerId) return; // Prevent double-triggering

        console.log(`[WARDOGS MORTARS] Static threshold crossed by Faction ${this.uncontestedTeamId}! Launching mortar shells.`);

        // Detonate shells periodically until the zone becomes contested/vacated
        this.barrageTimerId = Timers.setInterval(() => {
            const center = this.getHotZonePos();
            
            // Calculate a randomized coordinate within the 60-meter circular HotZone radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 50.0; // Keep slightly inside the 60m radius to stay central

            const shellX = center.x + Math.cos(angle) * distance;
            const shellZ = center.z + Math.sin(angle) * distance;
            
            // Target altitude should snap to terrain floor. We telecast a raycast downward to snap, or use default altitude
            const detonationVec = mod.CreateVector(shellX, 224.99, shellZ); // Spawns relative to HotZone Y altitude [67]

            // Spawn physics-safe explosive VFX particle [190]
            const explosion = mod.SpawnObject(
                mod.RuntimeSpawn_Common.FX_ArtilleryStrike_Explosion_GS,
                detonationVec,
                mod.CreateVector(0, 0, 0)
            );
            mod.EnableVFX(explosion, true);

            // Play accompanying detonation sound [190]
            const sound = mod.SpawnObject(
                mod.RuntimeSpawn_Common.SFX_Gadgets_C4_Activate_OneShot3D,
                detonationVec,
                mod.CreateVector(0, 0, 0)
            );
            mod.EnableSFX(sound, true);
            mod.PlaySound(sound, 1.0);

            // Apply direct area splash damage to players standing near the impact vector [189]
            mod.AllPlayers().forEach((player) => {
                if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) return;

                const playerPos = mod.GetPlayerState(player, mod.PlayerStateVector.Position);
                const distanceToImpact = mod.DistanceBetween(playerPos, detonationVec);

                // Splash falloff math (lethal within 3 meters, scaling down to 10 meters)
                if (distanceToImpact < 10.0) {
                    let damage = 0;
                    if (distanceToImpact <= 3.0) {
                        damage = 100; // Lethal core strike [189]
                    } else {
                        damage = Math.floor(100 * (1 - (distanceToImpact - 3.0) / 7.0)); // Falloff damage scale [189]
                    }

                    mod.DealDamage(player, damage);
                }
            });
        }, this.DETONATION_INTERVAL);
    }

    private broadcastWarning(messageText: string): void {
        mod.DisplayNotificationMessage(
            mod.Message(messageText)
        );
    }

    public shutdown(): void {
        if (this.checkTimerId) Timers.clearInterval(this.checkTimerId);
        if (this.barrageTimerId) Timers.clearInterval(this.barrageTimerId);
    }
}
