/**
 * wallet.ts — all cash and materials mutation. No native currency API exists (see AGENTS.md §2 /
 * economy.ts header) — every mutation here is custom application state on `JsPlayer`.
 *
 * Every caller must go through `addCash` / `spendCash` (never mutate `JsPlayer.currentCash`
 * directly) so the transaction-flash hook below stays the single source `ui/hud.ts` listens on,
 * per BUILD_GUIDE.md §2.
 *
 * `addKillReward` is a small convenience added in this pass: both a human kill (via
 * `game/mode/win-condition.ts`-adjacent combat handling) and a Chaos Squads AI kill
 * (`game/mode/chaos-ai.ts`) pay identical-shaped rewards (cash + assault-track XP), just with
 * different amounts — see `config/teams.ts`'s header note on why Chaos kills still pay out even
 * though Chaos isn't a scoring team. Centralizing this avoids the cash and XP awards drifting out
 * of sync between the two call sites.
 */

import { requirePlayerState } from "./player-state.ts";
import { SURCHARGE_MAX_MULTIPLIER, SURCHARGE_MIN_MULTIPLIER, MAX_TRACK_LEVEL } from "../config/economy.ts";
import { addXp, type TrackId } from "./progression.ts";

export type CashReason = "kill" | "assist" | "revive" | "cargoDelivery" | "buildHit" | "salvagePickup" | "purchase" | "chaosKill" | "chaosAssist";
export type MaterialsReason = "cargoDelivery" | "fobPlacement" | "buildHit";

type CashListener = (player: mod.Player, delta: number, reason: CashReason, newBalance: number) => void;
const cashListeners: CashListener[] = [];

/** Subscribe to every cash mutation (for the HUD's `+$X` flash). Returns an unsubscribe function. */
export function onCashChange(listener: CashListener): () => void {
	cashListeners.push(listener);
	return () => {
		const index = cashListeners.indexOf(listener);
		if (index !== -1) {
			cashListeners.splice(index, 1);
		}
	};
}

/** Adds cash to a player's wallet. `amount` must be positive — use `spendCash` to deduct. */
export function addCash(player: mod.Player, amount: number, reason: CashReason): void {
	if (amount <= 0) {
		return;
	}
	const state = requirePlayerState(player);
	state.currentCash += amount;
	for (const listener of cashListeners) {
		listener(player, amount, reason, state.currentCash);
	}
}

/**
 * Attempts to deduct `amount` from a player's wallet. Returns `true` and deducts if the player
 * can afford it; returns `false` and leaves the balance untouched otherwise. Every caller
 * (buy-validator, FOB placement cost, etc.) must branch on the return value — this never lets a
 * balance go negative.
 */
export function spendCash(player: mod.Player, amount: number, reason: CashReason): boolean {
	if (amount <= 0) {
		return true;
	}
	const state = requirePlayerState(player);
	if (state.currentCash < amount) {
		return false;
	}
	state.currentCash -= amount;
	for (const listener of cashListeners) {
		listener(player, -amount, reason, state.currentCash);
	}
	return true;
}

export function getCash(player: mod.Player): number {
	return requirePlayerState(player).currentCash;
}

/** Adds FOB/fortification materials to a player's pool. */
export function addMaterials(player: mod.Player, amount: number, _reason: MaterialsReason): void {
	if (amount <= 0) {
		return;
	}
	requirePlayerState(player).materials += amount;
}

/**
 * Attempts to deduct `amount` materials. Returns `true` and deducts if affordable, `false`
 * (balance untouched) otherwise. `fob.ts` calls this before spawning any FOB object.
 */
export function spendMaterials(player: mod.Player, amount: number, _reason: MaterialsReason): boolean {
	if (amount <= 0) {
		return true;
	}
	const state = requirePlayerState(player);
	if (state.materials < amount) {
		return false;
	}
	state.materials -= amount;
	return true;
}

export function getMaterials(player: mod.Player): number {
	return requirePlayerState(player).materials;
}

/**
 * Grants a combined cash + mastery-track-XP reward for a kill, regardless of whether the victim
 * was a human player or a Chaos Squads AI bot. `reason` distinguishes the two in the cash-flash
 * listener stream (`"kill"` vs `"chaosKill"`) purely for UI/analytics purposes — both still
 * increment the same wallet and the same `track`'s XP.
 */
export function addKillReward(
	player: mod.Player,
	cashAmount: number,
	xpAmount: number,
	track: TrackId,
	reason: Extract<CashReason, "kill" | "assist" | "chaosKill" | "chaosAssist">
): void {
	addCash(player, cashAmount, reason);
	addXp(player, track, xpAmount);
}

/**
 * Pro-rated shop surcharge. WARDOGS_DESIGN_BRIEF.md → "Core Rules" #4: items from other
 * progression tracks incur up to 200% markup if the player's track level is deficient, scaling
 * to baseline pricing (0% markup) once the item's required tier unlocks. This is a pure function
 * — independently testable, no `mod.*` or player-state dependency.
 *
 * @param playerTrackLevel The player's current level (1-MAX_TRACK_LEVEL) in the track that gates
 *   this item.
 * @param itemRequiredTier The track level required to unlock baseline pricing on this item.
 * @returns A multiplier to apply to the item's base price (e.g. 1.0 = no surcharge, 2.0 = +200%).
 */
export function getSurcharge(playerTrackLevel: number, itemRequiredTier: number): number {
	if (playerTrackLevel >= itemRequiredTier) {
		return 1 + SURCHARGE_MIN_MULTIPLIER;
	}
	const deficiency = itemRequiredTier - playerTrackLevel;
	const maxDeficiency = MAX_TRACK_LEVEL - 1;
	const fraction = Math.min(1, deficiency / maxDeficiency);
	const markup = SURCHARGE_MIN_MULTIPLIER + fraction * (SURCHARGE_MAX_MULTIPLIER - SURCHARGE_MIN_MULTIPLIER);
	return 1 + markup;
}

/** Applies `getSurcharge` to a base price and rounds to the nearest whole cash unit. */
export function getSurchargedPrice(basePrice: number, playerTrackLevel: number, itemRequiredTier: number): number {
	return Math.round(basePrice * getSurcharge(playerTrackLevel, itemRequiredTier));
}
