// src/features/ai/chaos-ai.ts
import { Timers } from "bf6-portal-utils/timers";

export interface AISquadMember {
    bot: mod.Player;
    isLeader: boolean;
}

/**
 * Squad container for Rogue AI agents.
 * Organizes bots into fireteams and manages tactical cohesion.
 */
export class ChaosAISquad {
    public id: string;
    public members: AISquadMember[] = [];
    public leader: mod.Player | null = null;

    constructor(id: string) {
        this.id = id;
    }

    public addMember(bot: mod.Player, isLeader: boolean): void {
        this.members.push({ bot, isLeader });
        if (isLeader) {
            this.leader = bot;
        }
    }

    /**
     * Enforces tight combat grouping. If squad members stray further than 30m 
     * from their leader, they are ordered to regroup instantly.
     */
    public EnforceCohesion(): void {
        if (!this.leader || !mod.IsPlayerValid(this.leader)) return;
        if (!mod.GetSoldierState(this.leader, mod.SoldierStateBool.IsAlive)) return;

        const leaderPos = mod.GetPlayerState(this.leader, mod.PlayerStateVector.Position);

        for (const member of this.members) {
            if (member.isLeader || !mod.IsPlayerValid(member.bot)) continue;
            if (!mod.GetSoldierState(member.bot, mod.SoldierStateBool.IsAlive)) continue;

            const memberPos = mod.GetPlayerState(member.bot, mod.PlayerStateVector.Position);
            const distance = mod.DistanceBetween(memberPos, leaderPos);

            // Re-route bot straight to squad leader position if they wander > 30m away
            if (distance > 30.0) {
                mod.SetAISoldierMoveTo(member.bot, leaderPos);
            }
        }
    }

    /**
     * Sends the entire squad to march toward a target coordinate.
     */
    public MoveTo(targetPos: mod.Vector): void {
        for (const member of this.members) {
            if (!mod.IsPlayerValid(member.bot)) continue;
            if (!mod.GetSoldierState(member.bot, mod.SoldierStateBool.IsAlive)) continue;

            // Direct AI movement natively
            mod.SetAISoldierMoveTo(member.bot, targetPos);
        }
    }
}

/**
 * Rogue AI Faction Manager (v2).
 * Operates a permanent, fully staffed unlisted 4th Faction of 12 bots (4 squads of 3)
 * assigned exclusively to harass players inside the Control Zone and HotZone.
 */
export class RogueAIManager {
    private squads: ChaosAISquad[] = [];
    private controlZoneCenter = mod.CreateVector(903.11, 228.33, 203.79); // mp_granite ControlZone center
    private activeZonePosition = mod.CreateVector(903.11, 228.33, 203.79);
    private updateTimerId: any = null;
    private cohesionTimerId: any = null;

    constructor() {
        this.initializeSchedules();
    }

    /**
     * Performs initial spawning and squad partitioning of 12 bots into 4 squads of 3.
     */
    public SpawnChaosFactions(): void {
        const nativeSpawner = mod.GetSpawner(401); // Pre-placed Godot spawner node
        
        console.log("[WARDOGS AI] Spawning permanent 4th Faction: Rogue AI (12 Bots total)");

        for (let i = 1; i <= 4; i++) {
            const squad = new ChaosAISquad(`chaos_squad_${i}`);

            for (let memberIdx = 0; memberIdx < 3; memberIdx++) {
                const isLeader = (memberIdx === 0);
                
                // Spawn AI natively on unjoinable Team 4
                const bot = mod.SpawnAIFromAISpawner(nativeSpawner, mod.GetTeam(4));
                squad.addMember(bot, isLeader);

                // Apply massive 2.5x health boost to make them formidable disruptors
                mod.SetMaxHealth(bot, 250);
                mod.SetHealth(bot, 250);

                // Position squad members in a tight cluster near the spawner
                const spawnOffset = mod.CreateVector(
                    this.controlZoneCenter.x + (Math.random() * 10 - 5),
                    this.controlZoneCenter.y + 1.5,
                    this.controlZoneCenter.z + (Math.random() * 10 - 5)
                );
                mod.Teleport(bot, spawnOffset, mod.CreateVector(0, 0, 0));
            }

            this.squads.push(squad);
        }
    }

    /**
     * Dynamically updates the AI threat target (e.g. tracking the drifting HotZone).
     * @param currentHotZonePos The latest calculated center vector of the drifting HotZone.
     */
    public updateTargetCoordinates(currentHotZonePos: mod.Vector): void {
        this.activeZonePosition = currentHotZonePos;
    }

    /**
     * Periodically updates bot pathfinding targets and squad cohesion checks.
     */
    private initializeSchedules(): void {
        // 1. Cohesion sweep: keep squads grouped together [every 1.5s]
        this.cohesionTimerId = Timers.setInterval(() => {
            for (const squad of this.squads) {
                squad.EnforceCohesion();
            }
        }, 1500);

        // 2. Tactical sweep: update bot pathfinding to target the active HotZone [every 4s]
        this.updateTimerId = Timers.setInterval(() => {
            console.log(`[WARDOGS AI] Routing 12 Rogue bots to active HotZone: ${mod.XComponentOf(this.activeZonePosition)}, ${mod.ZComponentOf(this.activeZonePosition)}`);
            for (const squad of this.squads) {
                squad.MoveTo(this.activeZonePosition);
            }
        }, 4000);
    }

    /**
     * Releases timers and resources.
     */
    public shutdown(): void {
        if (this.updateTimerId) Timers.clearInterval(this.updateTimerId);
        if (this.cohesionTimerId) Timers.clearInterval(this.cohesionTimerId);
    }
}
