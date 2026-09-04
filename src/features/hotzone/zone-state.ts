// src/features/hotzone/zone-state.ts
import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry } from "../progression/profile";
import { ZoneMath, Point2D } from "./zone-math";

/**
 * Interface tracking a player's real-time occupancy status across the concentric zones.
 */
export interface PlayerZoneState {
    insideControl: boolean;
    insideHot: boolean;
}

/**
 * Central State Manager for the WARDOGS drifting objectives and match scoring.
 * Establishes a double-multiplier HotZone inside a larger ControlZone polygon,
 * handles programmatic random walk drifting with inward polygon offset buffering (60m),
 * and ticks majority-rule faction points alongside player cash/XP presence rewards.
 */
export class HotZoneManager {
    public teamScores: Record<number, number> = { 1: 0, 2: 0, 3: 0 }; // Scores for Lonestar, Manticore, Valkyra
    private readonly victoryThreshold = 100;
    
    // In-memory directory tracking each player's zone status
    private zonePlayers: Map<number, PlayerZoneState> = new Map();
    
    // Core spatial nodes center coordinates (defaulted to Granite Military Storage center)
    private currentHotZonePos: Point2D = { x: 903.11, z: 203.79 };
    private readonly hotZoneAltitude = 227.5; // Altitude (Y) for HotZone CapturePoint and Icons
    private readonly driftStepSize = 2.0; // Speed of drift in meters per second
    
    // ControlZone polygonal boundaries exported from Godot
    private readonly controlZoneVertices: Point2D[] = [
        { x: 826.498, z: 260.967 },
        { x: 845.551, z: 261.098 },
        { x: 913.979, z: 294.246 },
        { x: 944.174, z: 298.164 },
        { x: 973.544, z: 285.895 },
        { x: 984.731, z: 265.881 },
        { x: 984.937, z: 239.559 },
        { x: 973.668, z: 208.443 },
        { x: 976.799, z: 179.116 },
        { x: 976.220, z: 151.118 },
        { x: 944.987, z: 124.984 },
        { x: 813.310, z: 121.779 },
        { x: 800.352, z: 130.851 },
        { x: 803.250, z: 153.794 },
        { x: 814.402, z: 172.954 },
        { x: 829.338, z: 186.818 },
        { x: 825.681, z: 198.701 }
    ];

    // Pre-cached inward-offset (shrunk) boundary vertices to keep the 60m radius enclosed
    private innerControlZone: Point2D[] = [];

    private driftTimerId: any = null;
    private scoringTimerId: any = null;

    constructor() {
        this.initializeZoneContainment();
        this.initializeAreaListeners();
        this.startLoops();
    }

    /**
     * Pre-calculates the buffered inner boundary polygon at match startup.
     * Shrinks the outer ControlZone by exactly 60m to prevent HotZone boundaries from clipping past the edge.
     */
    private initializeZoneContainment(): void {
        console.log("[WARDOGS ZONE] Pre-computing 60m inward polygon buffering...");
        this.innerControlZone = ZoneMath.shrinkPolygon(this.controlZoneVertices, 60.0);
        
        // Failsafe: if the polygon is too small to offset, fall back to the raw outer vertices
        if (this.innerControlZone.length < 3) {
            console.log("[WARDOGS ZONE] Warning: Offset polygon collapsed. Falling back to outer boundary.");
            this.innerControlZone = this.controlZoneVertices;
        }
    }

    /**
     * Registers native engine callbacks for Area Triggers using the Event broker.
     */
    private initializeAreaListeners(): void {
        // Outer Control Zone trigger ID is 900; Drifting HotZone trigger ID is 901
        Events.OnPlayerEnterAreaTrigger.subscribe((player, trigger) => {
            const triggerId = mod.GetObjId(trigger);
            const state = this.getOrCreateState(player);

            if (triggerId === 900) {
                state.insideControl = true;
            } else if (triggerId === 901) {
                state.insideHot = true;
            }
        });

        Events.OnPlayerExitAreaTrigger.subscribe((player, trigger) => {
            const triggerId = mod.GetObjId(trigger);
            const state = this.getOrCreateState(player);

            if (triggerId === 900) {
                state.insideControl = false;
            } else if (triggerId === 901) {
                state.insideHot = false;
            }
        });

        // Ensure disconnected players are cleaned up to prevent directory leakage
        Events.OnPlayerLeaveGame.subscribe((player) => {
            const playerId = mod.GetObjId(player);
            this.zonePlayers.delete(playerId);
        });
    }

    /**
     * Instantiates the async loops for HotZone movement and background points ticking.
     */
    private startLoops(): void {
        // 1. HotZone Drift walk loop: updates center position every second [1Hz]
        this.driftTimerId = Timers.setInterval(() => {
            this.currentHotZonePos = ZoneMath.calculateNextDrift(
                this.currentHotZonePos,
                this.innerControlZone,
                this.driftStepSize,
                0.15
            );

            this.teleportHotZoneAssets();
        }, 1000);

        // 2. Ticket allocation tick loop: evaluates dominant team presence every 4 seconds [0.25Hz]
        this.scoringTimerId = Timers.setInterval(() => {
            this.evaluatePresenceAndAwardTickets();
        }, 4000);
    }

    /**
     * Programmatically teleports and snaps HotZone capture poles and indicators 
     * to the latest horizontal (X, Z) calculated coordinate.
     */
    private teleportHotZoneAssets(): void {
        const targetVector = ZoneMath.toModVector(this.currentHotZonePos, this.hotZoneAltitude);

        // Snap CapturePoint_HotZone_1_1 (ObjId 9001) natively
        const capturePole = mod.GetCapturePoint(9001);
        if (capturePole) {
            mod.SetCapturePointPosition(capturePole, targetVector);
        }

        // Snap WorldIcon_HotZone_1_1 (ObjId 902) natively to float slightly above the pole
        const worldIcon = mod.GetWorldIcon(902);
        if (worldIcon) {
            const iconFloatingPos = mod.CreateVector(
                mod.XComponentOf(targetVector),
                mod.YComponentOf(targetVector) + 6.0, // Floating 6 meters up for visibility
                mod.ZComponentOf(targetVector)
            );
            mod.SetWorldIconPosition(worldIcon, iconFloatingPos);
        }
    }

    /**
     * Evaluates tactical zone occupancy, counting faction headcounts 
     * and ticking scores to enforce the end-game victory criteria.
     */
    private evaluatePresenceAndAwardTickets(): void {
        const presence: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
        const players = mod.AllPlayers();
        const count = mod.CountOf(players);

        for (let i = 0; i < count; i++) {
            const player = mod.ValueInArray(players, i);

            // Ignore dead players, spectators, or Team 4 bots (they do not participate in scoring)
            if (!mod.GetSoldierState(player, mod.SoldierStateBool.IsAlive)) continue;
            
            const team = mod.GetTeam(player);
            const teamId = mod.GetObjId(team);
            if (teamId < 1 || teamId > 3) continue; // Skip Team 4 or spectators

            const state = this.getOrCreateState(player);
            let scoreWeight = 0;

            if (state.insideHot) {
                scoreWeight = 2; // Double multiplier inside HotZone
            } else if (state.insideControl) {
                scoreWeight = 1; // Baseline presence inside ControlZone
            }

            presence[teamId] += scoreWeight;

            // --- RESOLVE CONCURRENT CASH PAYOUTS ---
            if (scoreWeight > 0) {
                const playerId = mod.GetObjId(player);
                const profile = mercenaryRegistry.get(playerId);
                
                if (profile) {
                    const cashPayout = scoreWeight === 2 ? 200 : 100;
                    profile.addCash(cashPayout, scoreWeight === 2 ? "HotZone Multipresence" : "ControlZone Presence");
                    profile.addTrackXp("Assault", scoreWeight === 2 ? 50 : 25);
                }
            }
        }

        // Determine majority ownership of the zone
        let dominantTeam = 0;
        let highestPresence = 0;
        let isTie = false;

        for (let teamId = 1; teamId <= 3; teamId++) {
            if (presence[teamId] > highestPresence) {
                highestPresence = presence[teamId];
                dominantTeam = teamId;
                isTie = false;
            } else if (presence[teamId] === highestPresence && highestPresence > 0) {
                isTie = true;
            }
        }

        // Award match points to the majority-rule faction
        if (dominantTeam > 0 && !isTie) {
            this.teamScores[dominantTeam] = Math.min(this.victoryThreshold, this.teamScores[dominantTeam] + 1);
            
            // Log point tickets to server console
            console.log(`[WARDOGS SCORE] Team ${dominantTeam} earns 1 Point. New totals: Lonestar: ${this.teamScores[1]}/100 | Manticore: ${this.teamScores[2]}/100 | Valkyra: ${this.teamScores[3]}/100`);
            
            this.syncScoreHUDs();
            this.evaluateVictoryConditions();
        }
    }

    /**
     * Enforces the Ticket Bleed Fallback.
     * When a player dies or undeploys, subtracts 1 point from their team's score.
     */
    public applyTicketBleed(teamId: number): void {
        if (teamId >= 1 && teamId <= 3) {
            this.teamScores[teamId] = Math.max(0, this.teamScores[teamId] - 1);
            console.log(`[WARDOGS BLEED] Faction ${teamId} suffered ticket bleed! New Score: ${this.teamScores[teamId]}`);
            this.syncScoreHUDs();
        }
    }

    /**
     * Evaluates if any faction has reached the match point cap.
     */
    private evaluateVictoryConditions(): void {
        for (let teamId = 1; teamId <= 3; teamId++) {
            if (this.teamScores[teamId] >= this.victoryThreshold) {
                console.log(`[WARDOGS GAME OVER] Faction ${teamId} has won the match contract!`);
                const winningTeam = mod.GetTeam(teamId);
                
                // End game natively via engine hooks
                mod.EndGameMode(winningTeam);
            }
        }
    }

    /**
     * Syncs score changes dynamically to all active player SolidUI HUD overlays.
     */
    private syncScoreHUDs(): void {
        mercenaryRegistry.forEach((profile) => {
            if (profile && profile.ProgressUI) {
                // Update friendly/enemy team bars inside the profile HUD container
                profile.ProgressUI.updateBar(mod.GetTeam(1), this.teamScores[1]);
                profile.ProgressUI.updateBar(mod.GetTeam(2), this.teamScores[2]);
                profile.ProgressUI.updateBar(mod.GetTeam(3), this.teamScores[3]);
            }
        });
    }

    /**
     * Retrieves or instantiates the player's zone tracking state.
     */
    private getOrCreateState(player: mod.Player): PlayerZoneState {
        const id = mod.GetObjId(player);
        if (!this.zonePlayers.has(id)) {
            this.zonePlayers.set(id, { insideControl: false, insideHot: false });
        }
        return this.zonePlayers.get(id)!;
    }

    /**
     * External coordinate fetcher allowing external subsystems (such as Rogue AI) 
     * to intercept the active drifting target coordinates.
     */
    public getActiveHotZonePos(): mod.Vector {
        return ZoneMath.toModVector(this.currentHotZonePos, this.hotZoneAltitude);
    }

    /**
     * Safely terminates timers on game-mode endings.
     */
    public shutdown(): void {
        if (this.driftTimerId) Timers.clearInterval(this.driftTimerId);
        if (this.scoringTimerId) Timers.clearInterval(this.scoringTimerId);
    }
}
