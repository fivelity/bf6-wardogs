/**
 * combat-rewards.ts — human-vs-human kill/assist/revive cash + XP payouts.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Point System": +$500/+150 assault XP per kill, +$300/+200
 * medic XP per field revive. Assist rewards (+$150/+60 assault XP) are a natural extension of the
 * same table, since "points and cash are still rewarded to players for kills/assists" per current
 * direction. Chaos Squads kill/assist rewards are handled separately in `game/mode/chaos-ai.ts`
 * (smaller payout — see that file's header note), since Chaos isn't a scoring team and its
 * reward path needs its own victim-identity check against the `liveBots` Set.
 *
 * This closes a gap flagged during the last full audit: nothing in the codebase previously called
 * `progression.ts`'s `addXp`, so mastery tracks could never actually level up from live play.
 *
 * ── Real SDK events used (confirmed against
 * https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/) ──
 * - `Events.OnPlayerEarnedKill(eventPlayer, eventOtherPlayer, eventDeathType, eventWeaponUnlock)`
 *   fires specifically to credit `eventPlayer` with a kill on `eventOtherPlayer` — this is a
 *   more precise hook for reward purposes than deriving "who gets credit" from `OnPlayerDied`
 *   (which fires from the *victim's* perspective and does not by itself distinguish a credited
 *   kill from a suicide/environmental death).
 * - `Events.OnPlayerEarnedKillAssist(eventPlayer, eventOtherPlayer)` fires when `eventPlayer`
 *   earns assist credit on `eventOtherPlayer`'s death.
 * - `Events.OnRevived(eventPlayer, eventOtherPlayer)` fires on a successful revive; per the
 *   brief's "Core Rules" #5 (native revive-loop exploits blocked; Medic defibrillator actions are
 *   the sole revive path), this is the correct hook to reward the reviving medic on, regardless
 *   of which specific revive-capable gadget triggered it.
 *
 * Each handler only pays out when the credited player (`eventPlayer` for earned-kill/assist,
 * `eventOtherPlayer` for revive — see the per-handler comment) is a tracked human player;
 * `getPlayerState` returns `undefined` for AI-spawned Chaos bots (only `OnPlayerJoinGame`, which
 * never fires for AI soldiers, populates `player-state.ts`'s Map), so these handlers naturally
 * exclude Chaos bots as reward recipients without needing to check `liveBots` directly.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { getPlayerState } from "../../player/player-state.ts";
import { addCash } from "../../player/wallet.ts";
import { addXp } from "../../player/progression.ts";
import { CASH_REWARDS, XP_REWARDS, XP_REWARD_TRACK } from "../../config/economy.ts";

Events.OnPlayerEarnedKill.subscribe((eventPlayer) => {
	const killerState = getPlayerState(eventPlayer);
	if (!killerState) {
		return; // Not a tracked human player (shouldn't happen for a human-credited kill, but defensive).
	}
	addCash(eventPlayer, CASH_REWARDS.kill, "kill");
	addXp(eventPlayer, XP_REWARD_TRACK.kill, XP_REWARDS.kill);
});

Events.OnPlayerEarnedKillAssist.subscribe((eventPlayer) => {
	const assisterState = getPlayerState(eventPlayer);
	if (!assisterState) {
		return;
	}
	addCash(eventPlayer, CASH_REWARDS.assist, "assist");
	addXp(eventPlayer, XP_REWARD_TRACK.assist, XP_REWARDS.assist);
});

Events.OnRevived.subscribe((_eventRevivedPlayer, eventRevivingPlayer) => {
	const reviverState = getPlayerState(eventRevivingPlayer);
	if (!reviverState) {
		return;
	}
	addCash(eventRevivingPlayer, CASH_REWARDS.revive, "revive");
	addXp(eventRevivingPlayer, XP_REWARD_TRACK.revive, XP_REWARDS.revive);
});
