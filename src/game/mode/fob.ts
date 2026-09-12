/**
 * fob.ts — freely-placeable Forward Operating Bases.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "FOB Construction & Defense" / RESOLVED "FOB placement model".
 * Every symbol below is verified against `bf6-portal-mod-types@4.2.0/index.d.ts` and
 * `bf6-portal-utils@9.4.0/portal-gadget/index.d.ts` — see AGENTS.md §2.
 *
 * A player aims the Portal Gadget PDA (real gadget-hook module: `PortalGadget.onFireStart` /
 * `getLaserTarget`, confirmed in `bf6-portal-utils/portal-gadget`) at valid ground, and on
 * confirmation a FOB is built from three independently-spawned runtime objects:
 *   1. `RuntimeSpawn_Common.PlayerSpawner`            — the deploy point
 *   2. `RuntimeSpawn_Common.StationaryEmplacementSpawner` — the defense
 *   3. `RuntimeSpawn_Common.SandBags_01_C90_A` (x N)   — cover, ringed around the deploy point
 * All three are torn down together via `mod.UnspawnObject` when the FOB is destroyed/abandoned.
 */

/**
 * fob.ts — freely-placeable Forward Operating Bases.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { PortalGadget } from "../../../node_modules/bf6-portal-utils/portal-gadget/index.ts";
import { TransitionState } from "../core/transition-state.ts";
import { spendMaterials } from "../../player/wallet.ts";
import { FOB_MATERIAL_COST } from "../../config/economy.ts";

const FOB_SANDBAG_RING_COUNT = 4;
const FOB_SANDBAG_RING_RADIUS = 4;

export interface ActiveFob {
	id: number;
	ownerTeam: mod.Team;
	deploySpawnPoint: mod.SpawnPoint;
	emplacementSpawner: mod.EmplacementSpawner;
	sandbags: mod.Object[];
	position: mod.Vector;
}

const activeFobsByTeam = new Map<number, ActiveFob[]>();
let nextFobId = 1;

function placeFob(team: mod.Team, position: mod.Vector, facing: mod.Vector): ActiveFob {
	const deploySpawnPoint = mod.SpawnObject(
		mod.RuntimeSpawn_Common.PlayerSpawner,
		position,
		facing
	) as mod.SpawnPoint;

	const emplacementSpawner = mod.SpawnObject(
		mod.RuntimeSpawn_Common.StationaryEmplacementSpawner,
		position,
		facing
	) as mod.EmplacementSpawner;

	const sandbags: mod.Object[] = [];
	for (let i = 0; i < FOB_SANDBAG_RING_COUNT; i++) {
		const angle = (i / FOB_SANDBAG_RING_COUNT) * mod.Pi() * 2;
		const offset = mod.CreateVector(
			mod.XComponentOf(position) + FOB_SANDBAG_RING_RADIUS * Math.cos(angle),
			mod.YComponentOf(position),
			mod.ZComponentOf(position) + FOB_SANDBAG_RING_RADIUS * Math.sin(angle)
		);
		const bag = mod.SpawnObject(mod.RuntimeSpawn_Common.SandBags_01_C90_A, offset, facing) as mod.Object;
		sandbags.push(bag);
	}

	const fob: ActiveFob = {
		id: nextFobId++,
		ownerTeam: team,
		deploySpawnPoint,
		emplacementSpawner,
		sandbags,
		position,
	};

	const teamId = mod.GetObjId(team);
	const existing = activeFobsByTeam.get(teamId) ?? [];
	existing.push(fob);
	activeFobsByTeam.set(teamId, existing);

	return fob;
}

function tryPlaceFob(
	player: mod.Player,
	team: mod.Team,
	position: mod.Vector,
	facing: mod.Vector
): ActiveFob | undefined {
	const afforded = spendMaterials(player, FOB_MATERIAL_COST, "fobPlacement");
	if (!afforded) {
		// Fixed alongside the buy-menu/HUD/scoreboard UI pass — this was a raw string literal
		// passed to mod.Message(), the exact "unavailable"-text bug documented in
		// ui/buy-menu.ts's header comment. Registered as fob_insufficient_materials in
		// strings.json.
		mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.fob_insufficient_materials), player);
		return undefined;
	}
	return placeFob(team, position, facing);
}

function teardownFob(fob: ActiveFob): void {
	mod.UnspawnObject(fob.deploySpawnPoint);
	mod.UnspawnObject(fob.emplacementSpawner);
	for (const bag of fob.sandbags) {
		mod.UnspawnObject(bag);
	}

	const teamId = mod.GetObjId(fob.ownerTeam);
	const list = activeFobsByTeam.get(teamId);
	if (list) {
		activeFobsByTeam.set(
			teamId,
			list.filter((f) => f.id !== fob.id)
		);
	}
}

const placementGuardByPlayer = new Map<mod.Player, TransitionState>();

PortalGadget.onFireStart(async (player, _isZooming, getTarget) => {
	if (!placementGuardByPlayer.has(player)) {
		placementGuardByPlayer.set(player, new TransitionState());
	}
	const guard = placementGuardByPlayer.get(player)!;

	if (!guard.update(true)) {
		return;
	}

	const target = await getTarget();
	if (!target) {
		guard.reset();
		return;
	}

	const team = mod.GetTeam(player);
	const facing = mod.GetSoldierState(player, mod.SoldierStateVector.GetFacingDirection);
	tryPlaceFob(player, team, target, facing);

	guard.reset();
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { placeFob, tryPlaceFob, teardownFob, activeFobsByTeam };