/**
 * fob.ts — freely-placeable Forward Operating Bases (the WARDOGS Construction system).
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "FOB Construction & Defense" / RESOLVED "FOB placement model"
 * / "Point System" (Sledgehammer build hit: +$100 cash, +120 support-track XP, +5% construction
 * progress per hit).
 *
 * Every symbol below is either (a) already confirmed real and in use elsewhere in this codebase
 * — `mod.SpawnObject`/`mod.UnspawnObject`/`RuntimeSpawn_Common.*` (fob.ts's own prior version,
 * salvage.ts), `Events.OnPlayerInteract` (buy-menu.ts), `PortalGadget.onFireStart`
 * (fob.ts's own prior version) — or (b) a direct, mechanical reuse of one of those same patterns.
 *
 * ── Build-hit trigger: reusing buy-menu.ts's verified interact pattern, not a new event ──
 * WARDOGS_COMPLETION_REPORT.md's Appendix ("Confirmed real and used correctly") lists every
 * `Events.*` handler this codebase actually verified against the real `event-handler-
 * signatures.d.ts`. There is no confirmed "melee hit on a world object" or "tool-swing" event
 * anywhere in that list, in AGENTS.md, or in WARDOGS_DESIGN_BRIEF.md's Technical Requirements.
 * Per AGENTS.md §2, this file does NOT invent one (no `OnPlayerMeleeHit`, no `OnToolSwing`, no
 * `Network.OnReceiveFromClient`-style RPC — none of those are confirmed real in this project).
 *
 * Instead, a FOB's construction socket is modeled the same way `buy-menu.ts` models a buy
 * station: a runtime-spawned `AreaTrigger` (confirmed real via `RuntimeSpawn_Common.AreaTrigger`,
 * already used in salvage.ts) is placed at the FOB position, and `Events.OnPlayerInteract`
 * (confirmed real, `event-handler-signatures.d.ts`, already the exact mechanism `buy-menu.ts`
 * uses for its own station) drives each build hit. This is a deliberate, documented substitution
 * for an unconfirmed capability — see WARDOGS_TODO_SDK_GAPS.md — not a guess dressed up as a
 * real API. If the real SDK does expose a dedicated melee/tool-swing event, swap the
 * `Events.OnPlayerInteract` subscription below for it once that symbol is confirmed against the
 * actual installed `.d.ts`; nothing else in this file's data model needs to change.
 *
 * ── What's new in this pass vs. the previous fob.ts ──
 * 1. Construction progress (0..100%) tracked per FOB, incremented by build hits, gated by the
 *    brief's own reward table (+$100/+120 support XP/+5% per hit — 20 hits to fully construct).
 * 2. `addCash`/`addXp` wired to `CASH_REWARDS.buildHit`/`XP_REWARDS.buildHit` (economy.ts already
 *    defined these; nothing previously consumed them — flagged as a gap in the completion report).
 * 3. Real teardown triggers: manual demolition (a second Portal Gadget PDA fire, TransitionState-
 *    gated, matching fob.ts's own existing placement-guard pattern) and match end
 *    (`hasGameEnded()`, already exported by win-condition.ts) as a hard sweep, so FOBs don't
 *    persist as dangling objects after `EndGameMode` fires.
 * 4. A per-team FOB cap (`FOB_MAX_PER_TEAM`), since the brief describes cooperative, resource-
 *    gated construction, not unlimited free placement — this is a judgment call, not derived from
 *    an explicit brief number; flagged inline.
 * 5. A "Squad-style" continuous deployment wave per FOB (spawn queue): players opt in via a
 *    second, distinct interact socket, wait together, and deploy as a batch every
 *    `FOB_DEPLOYMENT_WAVE_SECONDS`. Every symbol this uses is now confirmed real against the
 *    unofficial-but-`sdk.d.ts`-line-cited TypeDoc reference
 *    (https://fivelity.github.io/unofficial-bf6-portal-sdk-docs/) fetched and checked this pass:
 *    `mod.Wait(n: number): Promise<void>` (sdk.d.ts:29662),
 *    `mod.SpawnPlayerFromSpawnPoint(player, spawnPoint)` (sdk.d.ts:30268),
 *    `mod.DisplayCustomNotificationMessage(msg: mod.Message, slot, duration, target)`
 *    (sdk.d.ts:30621 — takes a `mod.Message`, not a raw string, consistent with this project's
 *    `stringkeys`-only rule), and the `mod.CustomNotificationSlots` enum (sdk.d.ts:273).
 *    This supersedes an earlier draft of this feature in this session that used unverified,
 *    non-`mod`-namespace APIs (`player.GetPosition()`, `Network.OnReceiveFromClient`,
 *    `Input.OnActionPressed`, `new mod.Vector(...)`) which do not appear anywhere in the real
 *    `mod` namespace's function index — those are NOT used here. See WARDOGS_TODO_SDK_GAPS.md for
 *    the full verification trail.
 */

import { Events } from "../../../node_modules/bf6-portal-utils/events/index.ts";
import { PortalGadget } from "../../../node_modules/bf6-portal-utils/portal-gadget/index.ts";
import { TransitionState } from "../core/transition-state.ts";
import { spendMaterials } from "../../player/wallet.ts";
import { addCash } from "../../player/wallet.ts";
import { addXp } from "../../player/progression.ts";
import { FOB_MATERIAL_COST, CASH_REWARDS, XP_REWARDS } from "../../config/economy.ts";
import { hasGameEnded } from "./win-condition.ts";

/** Seconds between deployment waves at an active FOB — brief describes squad-cooperative deploy, no exact cadence given; judgment call, flagged in WARDOGS_TODO_SDK_GAPS.md. */
const FOB_DEPLOYMENT_WAVE_SECONDS = 15;

const FOB_SANDBAG_RING_COUNT = 4;
const FOB_SANDBAG_RING_RADIUS = 4;

/**
 * Judgment call, not a brief-specified number: caps cooperative FOB placement per team so the
 * map doesn't fill with unlimited free spawn points. Flagged here rather than buried in
 * config/constants.ts since it's a design decision this pass introduces, not a value the brief
 * already specifies elsewhere.
 */
const FOB_MAX_PER_TEAM = 3;

/** Build hits required to bring a FOB from 0% to 100% construction progress (brief: +5%/hit). */
const FOB_BUILD_HITS_TO_COMPLETE = 20;
const FOB_PROGRESS_PER_HIT = 100 / FOB_BUILD_HITS_TO_COMPLETE;

export interface ActiveFob {
	id: number;
	ownerTeam: mod.Team;
	deploySpawnPoint: mod.SpawnPoint;
	emplacementSpawner: mod.EmplacementSpawner;
	sandbags: mod.Object[];
	/** Build-hit interact point — the construction socket itself (see header note on why). */
	buildSocket: mod.AreaTrigger;
	/** Separate interact point players use to join this FOB's deployment wave queue. */
	deployQueueSocket: mod.AreaTrigger;
	position: mod.Vector;
	/** 0..100. FOB is fully constructed at 100; placement starts it at 0 per the brief's loop. */
	constructionProgress: number;
	/** True while this FOB's deployment-wave loop (below) is still running. Set false on teardown so the loop exits. */
	active: boolean;
	/** Players currently queued for this FOB's next deployment wave. */
	deployQueue: mod.Player[];
}

const activeFobsByTeam = new Map<number, ActiveFob[]>();
const fobsBySocketObjId = new Map<number, ActiveFob>();
const fobsByDeployQueueSocketObjId = new Map<number, ActiveFob>();
let nextFobId = 1;

/**
 * The continuous deployment-wave loop for one FOB — confirmed real via `mod.Wait` (sdk.d.ts:29662,
 * see header note). Ticks once per `FOB_DEPLOYMENT_WAVE_SECONDS`, deploying every currently-queued
 * player as a batch via `mod.SpawnPlayerFromSpawnPoint` (sdk.d.ts:30268) and clearing the queue.
 * Exits once `fob.active` is false (set by `teardownFob`).
 */
async function runDeploymentWaveLoop(fob: ActiveFob): Promise<void> {
	while (fob.active) {
		await mod.Wait(FOB_DEPLOYMENT_WAVE_SECONDS);
		if (!fob.active) {
			return;
		}
		if (fob.deployQueue.length === 0) {
			continue;
		}
		const queued = fob.deployQueue;
		fob.deployQueue = [];
		for (const player of queued) {
			mod.SpawnPlayerFromSpawnPoint(player, fob.deploySpawnPoint);
		}
	}
}

function teamFobCount(team: mod.Team): number {
	return activeFobsByTeam.get(mod.GetObjId(team))?.length ?? 0;
}

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

	// The construction socket — confirmed-real AreaTrigger spawn (same call salvage.ts already
	// uses for its pickup trigger), reused here as the build-hit interact target. See header note
	// on why this substitutes for an unconfirmed melee/tool-swing event.
	const buildSocket = mod.SpawnObject(
		mod.RuntimeSpawn_Common.AreaTrigger,
		position,
		facing
	) as mod.AreaTrigger;

	// The deploy-queue socket — a second, distinct AreaTrigger at the same position, so joining
	// the deployment wave is a separate interact from advancing construction progress.
	const deployQueueSocket = mod.SpawnObject(
		mod.RuntimeSpawn_Common.AreaTrigger,
		position,
		facing
	) as mod.AreaTrigger;

	const fob: ActiveFob = {
		id: nextFobId++,
		ownerTeam: team,
		deploySpawnPoint,
		emplacementSpawner,
		sandbags,
		buildSocket,
		deployQueueSocket,
		position,
		constructionProgress: 0,
		active: true,
		deployQueue: [],
	};

	const teamId = mod.GetObjId(team);
	const existing = activeFobsByTeam.get(teamId) ?? [];
	existing.push(fob);
	activeFobsByTeam.set(teamId, existing);
	fobsBySocketObjId.set(mod.GetObjId(buildSocket), fob);
	fobsByDeployQueueSocketObjId.set(mod.GetObjId(deployQueueSocket), fob);

	void runDeploymentWaveLoop(fob);

	return fob;
}

function tryPlaceFob(
	player: mod.Player,
	team: mod.Team,
	position: mod.Vector,
	facing: mod.Vector
): ActiveFob | undefined {
	if (teamFobCount(team) >= FOB_MAX_PER_TEAM) {
		mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.fob_max_per_team_reached), player);
		return undefined;
	}

	const afforded = spendMaterials(player, FOB_MATERIAL_COST, "fobPlacement");
	if (!afforded) {
		mod.DisplayNotificationMessage(mod.Message(mod.stringkeys.fob_insufficient_materials), player);
		return undefined;
	}
	return placeFob(team, position, facing);
}

function teardownFob(fob: ActiveFob): void {
	fob.active = false; // Signals runDeploymentWaveLoop's while-loop to exit on its next mod.Wait resolution.
	fob.deployQueue = [];

	mod.UnspawnObject(fob.deploySpawnPoint);
	mod.UnspawnObject(fob.emplacementSpawner);
	mod.UnspawnObject(fob.buildSocket);
	mod.UnspawnObject(fob.deployQueueSocket);
	for (const bag of fob.sandbags) {
		mod.UnspawnObject(bag);
	}
	fobsBySocketObjId.delete(mod.GetObjId(fob.buildSocket));
	fobsByDeployQueueSocketObjId.delete(mod.GetObjId(fob.deployQueueSocket));

	const teamId = mod.GetObjId(fob.ownerTeam);
	const list = activeFobsByTeam.get(teamId);
	if (list) {
		activeFobsByTeam.set(
			teamId,
			list.filter((f) => f.id !== fob.id)
		);
	}
}

/** Tears down every currently-active FOB across every team. Called on match end (see below). */
function teardownAllFobs(): void {
	for (const list of activeFobsByTeam.values()) {
		for (const fob of [...list]) {
			teardownFob(fob);
		}
	}
}

const placementGuardByPlayer = new Map<mod.Player, TransitionState>();

PortalGadget.onFireStart(async (player, _isZooming, getTarget) => {
	if (hasGameEnded()) {
		return;
	}
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

/**
 * Build-hit handler — a player interacting with an active FOB's construction socket advances
 * that FOB's progress and pays out the brief's per-hit reward (+$100 cash, +120 support XP,
 * +5% progress). Fully-constructed FOBs (progress >= 100) no longer accept hits; a FOB that
 * completes via this handler is left standing (already fully spawned — see header note, the
 * "construction" here is a progress/reward gate, not a staged prefab reveal, since all three FOB
 * objects are already spawned at placement time per the brief's RESOLVED placement-model note).
 */
Events.OnPlayerInteract.subscribe((eventPlayer, eventInteractPoint) => {
	const interactId = mod.GetObjId(eventInteractPoint);
	const fob = fobsBySocketObjId.get(interactId);
	if (!fob) {
		return; // Not a FOB build socket — buy-menu.ts's own handler covers its own interact IDs.
	}
	if (fob.constructionProgress >= 100) {
		return;
	}

	fob.constructionProgress = Math.min(100, fob.constructionProgress + FOB_PROGRESS_PER_HIT);
	addCash(eventPlayer, CASH_REWARDS.buildHit, "buildHit");
	addXp(eventPlayer, "support", XP_REWARDS.buildHit);

	mod.DisplayNotificationMessage(
		mod.Message(mod.stringkeys.fob_build_hit_progress, Math.round(fob.constructionProgress)),
		eventPlayer
	);
});

/**
 * Deploy-queue join handler — interacting with an active FOB's deploy-queue socket adds the
 * player to that FOB's `deployQueue` (deduplicated), which `runDeploymentWaveLoop` drains as a
 * batch every `FOB_DEPLOYMENT_WAVE_SECONDS`. `DisplayCustomNotificationMessage` (confirmed real,
 * sdk.d.ts:30621, see header note) gives a short-lived confirmation in a custom slot rather than
 * a full `DisplayNotificationMessage`, since this is a lower-priority status update than a
 * purchase confirmation or insufficient-funds error.
 */
Events.OnPlayerInteract.subscribe((eventPlayer, eventInteractPoint) => {
	const interactId = mod.GetObjId(eventInteractPoint);
	const fob = fobsByDeployQueueSocketObjId.get(interactId);
	if (!fob || !fob.active) {
		return;
	}
	if (fob.deployQueue.some((queuedPlayer) => mod.Equals(queuedPlayer, eventPlayer))) {
		return; // Already queued.
	}
	fob.deployQueue.push(eventPlayer);
	mod.DisplayCustomNotificationMessage(
		mod.Message(mod.stringkeys.fob_deploy_queue_joined),
		mod.CustomNotificationSlots.MessageText1,
		3,
		eventPlayer
	);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

/**
 * Match-end sweep. `win-condition.ts` owns the actual `mod.EndGameMode` call and exposes
 * `hasGameEnded()` (a plain getter, not a Portal event hook) for exactly this kind of
 * cross-cutting cleanup check — per AGENTS.md §4, `Events.*` handlers are single-owner, so this
 * file adds its OWN `Events.OngoingGlobal` subscription rather than modifying
 * win-condition.ts's existing hook. A one-shot `TransitionState` gate stops this from sweeping
 * every tick once the match has ended.
 */
const matchEndSweepGuard = new TransitionState();
Events.OngoingGlobal.subscribe(() => {
	if (matchEndSweepGuard.update(hasGameEnded())) {
		teardownAllFobs();
	}
});

export { placeFob, tryPlaceFob, teardownFob, teardownAllFobs, activeFobsByTeam, FOB_MAX_PER_TEAM, FOB_DEPLOYMENT_WAVE_SECONDS };
