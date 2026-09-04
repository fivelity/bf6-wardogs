import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "./profile";

/**
 * Faction-Switcher Mannequin Hooks.
 * Intercepts physical interactions with base mannequins (ObjIds 998 and 999),
 * enforcing strict 12-player team size limits, team balance thresholds,
 * and a $1,000 transfer surcharge to prevent mid-game bandwagon exploits. [230]
 */
export class TeamSwitcherSystem {
    private readonly MANNEQUIN_A = 998; // Cycles team forward (1 -> 2 -> 3 -> 1)
    private readonly MANNEQUIN_B = 999; // Swaps to lowest-populated team

    private readonly TRANSFER_FEE = 1000; // Surcharge in cash to switch factions [230]
    private readonly MAX_TEAM_SIZE = 12;   // Strict WARDOGS team size limit [230]

    constructor() {
        this.registerMannequinListeners();
    }

    private registerMannequinListeners(): void {
        Events.OnPlayerInteract.subscribe((player, interactPoint) => {
            const interactId = mod.GetObjId(interactPoint);

            if (interactId === this.MANNEQUIN_A) {
                this.handleCycleTeamSwitch(player);
            } else if (interactId === this.MANNEQUIN_B) {
                this.handleLowestTeamSwitch(player);
            }
        });
    }

    /**
     * Cycles the player forward to the next faction index, if balances and limits permit.
     */
    private handleCycleTeamSwitch(player: mod.Player): void {
        if (!mod.IsPlayerValid(player)) return;

        const currentTeam = mod.GetTeam(player);
        const currentTeamId = mod.GetObjId(currentTeam);
        if (currentTeamId < 1 || currentTeamId > 3) return; // Skip invalid indices

        // Cycle Faction IDs: 1 -> 2 -> 3 -> 1
        const targetTeamId = (currentTeamId % 3) + 1;
        this.executeTeamTransfer(player, targetTeamId);
    }

    /**
     * Identifies the team with the lowest headcount and transfers the player directly.
     */
    private handleLowestTeamSwitch(player: mod.Player): void {
        if (!mod.IsPlayerValid(player)) return;

        const currentTeam = mod.GetTeam(player);
        const currentTeamId = mod.GetObjId(currentTeam);
        if (currentTeamId < 1 || currentTeamId > 3) return;

        // Count headcounts
        const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
        mod.AllPlayers().forEach((p) => {
            const tid = mod.GetObjId(mod.GetTeam(p));
            if (tid >= 1 && tid <= 3) {
                counts[tid]++;
            }
        });

        // Determine lowest
        let targetTeamId = currentTeamId;
        let lowestCount = Infinity;

        for (let tid = 1; tid <= 3; tid++) {
            if (counts[tid] < lowestCount) {
                lowestCount = counts[tid];
                targetTeamId = tid;
            }
        }

        if (targetTeamId === currentTeamId) {
            mod.DisplayNotificationMessage(
                mod.Message("TRANSFER SKIPPED: Your current team already has the lowest or equal headcount!"),
                player
            );
            return;
        }

        this.executeTeamTransfer(player, targetTeamId);
    }

    private executeTeamTransfer(player: mod.Player, targetTeamId: number): void {
        const playerId = mod.GetObjId(player);
        const profile = mercenaryRegistry.get(playerId);
        if (!profile) return;

        // Validation 1: Enforce $1,000 Transfer Fee
        if (profile.getCash() < this.TRANSFER_FEE) {
            mod.DisplayNotificationMessage(
                mod.Message(`TRANSFER DENIED: Switching PMCs requires a $1,000 contractor fee (Wallet: $${profile.getCash()})`),
                player
            );
            // Play error sound effect
            mod.PlaySound(mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_Alarm, mod.GetPlayerState(player, mod.PlayerStateVector.Position), mod.CreateVector(0, 0, 0)), 1, mod.GetTeam(player));
            return;
        }

        // Validation 2: Enforce strict 12-player team limits [230]
        let targetHeadcount = 0;
        mod.AllPlayers().forEach((p) => {
            if (mod.GetObjId(mod.GetTeam(p)) === targetTeamId) {
                targetHeadcount++;
            }
        });

        if (targetHeadcount >= this.MAX_TEAM_SIZE) {
            mod.DisplayNotificationMessage(
                mod.Message(`TRANSFER BLOCKED: Target Faction is at maximum capacity (12/12 players)!`),
                player
            );
            return;
        }

        // Deduct Transfer Surcharge
        profile.addCash(-this.TRANSFER_FEE, "PMC Contractor Switching Fee");

        // Swap team natively [186]
        const targetTeamObj = mod.GetTeam(targetTeamId);
        mod.SetTeam(player, targetTeamObj);

        console.log(`[WARDOGS TRANSFER] PMC Contractor ${profile.name} transferred to Faction ${targetTeamId}. Surcharge $1,000 deducted.`);

        mod.DisplayNotificationMessage(
            mod.Message(`CONTRACT EXECUTED: Transferred to Faction ${targetTeamId}! Surcharge -$1,000 applied. Dedeploying to HQ...`),
            player
        );

        // Force redeployment to clear equipment assemblies and spawn safely at the new HQ
        mod.Kill(player);
    }
}
