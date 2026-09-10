/**
 * salvage.ts — Salvage Pack drop-on-undeploy (Known Issue #1's "ragdoll limbo bug" workaround).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "Combat Elimination & Salvage" / Known Issues #1.
 * Subscribes to `Events.OnPlayerUndeploy` specifically, NOT `OnPlayerDied` — per the brief, dead
 * players who aren't revived don't reliably fire a clean death callback, so the pack spawns on
 * undeploy instead (confirmed real event, `event-handler-signatures.d.ts`, per BUILD_GUIDE.md §4).
 *
 * A Salvage Pack is: one `mod.SpawnLoot` call for ammo (confirmed real, overloaded,
 * `index.d.ts:897-906`) plus a runtime `AreaTrigger` spawned at the same position purely to detect
 * pickup for the cash portion — there is no native currency API (AGENTS.md §2), so the cash payout
 * has to be application logic gated on a real, confirmed event
 * (`Events.OnPlayerEnterAreaTrigger`) rather than an invented "on loot picked up" callback.
 *
 * NOTE (AGENTS.md §2): the exact `RuntimeSpawn_Common` member name for a spawnable, runtime
 * `AreaTrigger` prefab (used below as `RuntimeSpawn_Common.AreaTrigger`) has not been
 * independently re-confirmed by this file's author against
 * `node_modules/bf6-portal-mod-types/runtime-spawn-enums/common.d.ts` — verify it exists under
 * that exact name before shipping; if the real enum uses a different member name for a spawnable
 * trigger volume, update the one `mod.SpawnObject` call in `dropSalvagePack()` below. Likewise,
 * `mod.SpawnLoot`'s exact overload for a plain ammo crate (as opposed to weapon/gadget/armor loot)
 * should be double-checked against its real overload list before this ships.
 */

/**
 * salvage.ts — Salvage Pack drop-on-undeploy.
[cite: 10] */

import { Events } from "bf6-portal-utils/events/index.ts";
import { addCash } from "../../player/wallet.ts";
import { SALVAGE_PACK_CASH, SALVAGE_PACK_LIFETIME_SECONDS } from "../../config/constants.ts";

interface ActiveSalvagePack {
	id: number;
	pickupTrigger: mod.AreaTrigger;
	lootSpawner: mod.LootSpawner;
	claimed: boolean;
}

const activePacks = new Map<number, ActiveSalvagePack>();
let nextPackId = 1;

function despawnPack(pack: ActiveSalvagePack): void {
	mod.UnspawnObject(pack.pickupTrigger);
	mod.UnspawnObject(pack.lootSpawner);
	activePacks.delete(pack.id);
}

function dropSalvagePack(position: mod.Vector, facing: mod.Vector): void {
	const lootSpawner = mod.SpawnObject(
		mod.RuntimeSpawn_Common.LootSpawner,
		position,
		facing
	) as unknown as mod.LootSpawner;
	mod.SpawnLoot(lootSpawner, mod.Gadgets.Misc_Supply_Pouch);

	const pickupTrigger = mod.SpawnObject(
		mod.RuntimeSpawn_Common.AreaTrigger,
		position,
		facing
	) as mod.AreaTrigger;

	const pack: ActiveSalvagePack = {
		id: nextPackId++,
		pickupTrigger,
		lootSpawner,
		claimed: false,
	};
	activePacks.set(pack.id, pack);

	let elapsed = 0;
	const ASSUMED_SERVER_TICK_SECONDS = 1 / 30;
	const unsubscribe = Events.OngoingGlobal.subscribe(() => {
		if (!activePacks.has(pack.id)) {
			unsubscribe();
			return;
		}
		elapsed += ASSUMED_SERVER_TICK_SECONDS;
		if (elapsed >= SALVAGE_PACK_LIFETIME_SECONDS) {
			despawnPack(pack);
			unsubscribe();
		}
	});
}

Events.OnPlayerUndeploy.subscribe((eventPlayer) => {
	const position = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetPosition);
	const facing = mod.GetSoldierState(eventPlayer, mod.SoldierStateVector.GetFacingDirection);
	dropSalvagePack(position, facing);
});

Events.OnPlayerEnterAreaTrigger.subscribe((eventPlayer, eventAreaTrigger) => {
	for (const pack of activePacks.values()) {
		if (pack.claimed) {
			continue;
		}
		if (mod.Equals(eventAreaTrigger, pack.pickupTrigger)) {
			pack.claimed = true;
			addCash(eventPlayer, SALVAGE_PACK_CASH, "salvagePickup");
			despawnPack(pack);
			break;
		}
	}
});

export { dropSalvagePack };
