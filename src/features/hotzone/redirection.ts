import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { SolidUI } from 'bf6-portal-utils/solid-ui';
import { mercenaryRegistry } from "../progression/profile";
import { Point2D, ZoneMath } from "../hotzone/zone-math";

export interface RadioTowerState {
    objId: number;
    name: string;
    position: Point2D;
    controllingTeam: number; // 0 = Neutral, 1 = Lonestar, 2 = Manticore, 3 = Valkyra
    decryptionProgress: Record<number, number>; // TeamId -> Progress (0 to 100%)
    isRedirecting: boolean;
    redirectTimeRemaining: number; // Duration of HotZone lock in seconds
}

/**
 * Concentric Towers & HotZone Redirection System.
 * Tracks radio tower capture states, manages cryptographic decryption uploads per team,
 * and allows Support PMCs to lock the drifting HotZone's vector directly onto their fortified location.
 */
export class TowerRedirectionSystem {
    private towers: Map<number, RadioTowerState> = new Map();
    private activeRedirectionTower: number | null = null;
    private tickTimerId: any = null;

    // Hardcoded mp_granite tower coordinate definitions from level.spatial.json
    private readonly TOWER_CONFIGS = [
        { objId: 1001, name: "Radio Tower Alpha", x: 648.96, z: 297.27 }, // CapturePoint_A_1 coordinates [78]
        { objId: 2001, name: "Radio Tower Beta", x: 543.98, z: 482.61 }   // CapturePoint_B_1 coordinates [79]
    ];

    private readonly DECRYPTION_SPEED = 2; // % progress added per second when holding tower
    private readonly PROGRESS_DECAY = 1;    // % progress lost per second when not holding tower
    private readonly REDIRECTION_DURATION = 60; // How long the HotZone lock lasts in seconds

    constructor() {
        this.initializeTowers();
        this.startTowerLifecycle();
    }

    private initializeTowers(): void {
        for (const config of this.TOWER_CONFIGS) {
            this.towers.set(config.objId, {
                objId: config.objId,
                name: config.name,
                position: { x: config.x, z: config.z },
                controllingTeam: 0, // 0 = Neutral
                decryptionProgress: { 1: 0, 2: 0, 3: 0 },
                isRedirecting: false,
                redirectTimeRemaining: 0
            });
        }

        // Subscribe to capture events using bf6-portal-utils central events broker
        Events.OnCapturePointCaptured.subscribe((capturePoint, team) => {
            const cpId = mod.GetObjId(capturePoint);
            const teamId = mod.GetObjId(team);

            if (this.towers.has(cpId)) {
                const tower = this.towers.get(cpId)!;
                tower.controllingTeam = teamId;

                console.log(`[WARDOGS TOWERS] ${tower.name} captured by Faction ${teamId}`);
                
                // Alert the capturing team
                mod.DisplayNotificationMessage(
                    mod.Message(`TOWER CONNECTED: ${tower.name} is now uploading decryption keys!`),
                    undefined,
                    team
                );
            }
        });
    }

    private startTowerLifecycle(): void {
        // Runs a 1Hz clock update loop to progress decryption scales and redirection durations
        this.tickTimerId = Timers.setInterval(() => {
            this.towers.forEach((tower) => {
                // 1. Process active redirection cooldowns/locks
                if (tower.isRedirecting) {
                    tower.redirectTimeRemaining--;
                    if (tower.redirectTimeRemaining <= 0) {
                        tower.isRedirecting = false;
                        this.activeRedirectionTower = null;
                        
                        console.log(`[WARDOGS TOWERS] Redirection lock expired for ${tower.name}. Resuming standard drift walk.`);
                        mod.DisplayNotificationMessage(
                            mod.Message("REDIRECTION LOCK LOST: HotZone vector has resumed standard randomized drift walk.")
                        );
                    }
                }

                // 2. Tick upload and decay progressions
                for (let teamId = 1; teamId <= 3; teamId++) {
                    const currentProgress = tower.decryptionProgress[teamId];

                    if (tower.controllingTeam === teamId && !tower.isRedirecting) {
                        // Increment decryption progress when team controls the node
                        const newProgress = Math.min(100, currentProgress + this.DECRYPTION_SPEED);
                        tower.decryptionProgress[teamId] = newProgress;

                        if (newProgress === 100 && currentProgress < 100) {
                            console.log(`[WARDOGS TOWERS] Cryptographic Key Decrypted for Faction ${teamId} at ${tower.name}!`);
                            mod.DisplayNotificationMessage(
                                mod.Message(`DECRYPTION SECURED: Keys fully decrypted at ${tower.name}! Support players can redirect the HotZone.`),
                                undefined,
                                mod.GetTeam(teamId)
                            );
                        }
                    } else {
                        // Decay progress when team does not control the node
                        tower.decryptionProgress[teamId] = Math.max(0, currentProgress - this.PROGRESS_DECAY);
                    }
                }
            });
        }, 1000);
    }

    /**
     * Attempts to trigger HotZone Redirection.
     * Can only be triggered by a Support player when their team holds 100% decryption keys for that tower.
     */
    public tryTriggerRedirection(player: mod.Player, towerObjId: number): boolean {
        if (!mod.IsPlayerValid(player)) return false;

        const playerTeam = mod.GetTeam(player);
        const teamId = mod.GetObjId(playerTeam);
        if (teamId < 1 || teamId > 3) return false;

        const tower = this.towers.get(towerObjId);
        if (!tower) return false;

        // Validation A: Ensure Faction owns 100% decryption keys
        if (tower.decryptionProgress[teamId] < 100) {
            mod.DisplayNotificationMessage(
                mod.Message(`ACCESS DENIED: Direct redirection requires 100% Decryption Progress (Current: ${tower.decryptionProgress[teamId]}%)`),
                player
            );
            return false;
        }

        // Validation B: Ensure there is no active redirection block on another tower
        if (this.activeRedirectionTower !== null && this.activeRedirectionTower !== towerObjId) {
            mod.DisplayNotificationMessage(
                mod.Message("REDIRECTION DENIED: Satellite uplink is currently occupied by another active tower lock!"),
                player
            );
            return false;
        }

        // Activate lock
        tower.isRedirecting = true;
        tower.redirectTimeRemaining = this.REDIRECTION_DURATION;
        this.activeRedirectionTower = towerObjId;

        // Reset decryption progress so they must re-earn redirection locks
        tower.decryptionProgress[teamId] = 0;

        console.log(`[WARDOGS REDIRECT] Faction ${teamId} has forced satellite redirection to ${tower.name}!`);
        
        // Dynamic world announcement
        mod.DisplayNotificationMessage(
            mod.Message(`SATELLITE REDIRECT: HotZone vector has locked onto ${tower.name} coordinates!`)
        );

        // Award Support XP to the redirection initiator
        const profile = mercenaryRegistry.get(mod.GetObjId(player));
        if (profile) {
            profile.addTrackXp("Support", 300);
        }

        return true;
    }

    /**
     * Retreives the current programmatic redirection coordinates override if a lock is active.
     * Queried by the drift loop inside zone-state.ts.
     */
    public getRedirectTargetCoordinates(): Point2D | null {
        if (this.activeRedirectionTower === null) return null;

        const tower = this.towers.get(this.activeRedirectionTower);
        return tower ? tower.position : null;
    }

    /**
     * Gets the raw decryption states for HUD bindings.
     */
    public getTowerState(towerObjId: number): RadioTowerState | undefined {
        return this.towers.get(towerObjId);
    }

    public shutdown(): void {
        if (this.tickTimerId) {
            Timers.clearInterval(this.tickTimerId);
        }
    }
}
