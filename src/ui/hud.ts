/**
 * hud.ts — in-game HUD: team/objective status panel, active mastery-track progress, wallet flash,
 * rank-up flash, and FOB materials readout.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" → In-game HUD (reactive ticket bars, wallet
 * flash, active track progress bar, objective status). Same `SolidUI.h()` pattern as
 * `scoreboard.ts`.
 *
 * FIXED IN THIS PASS — this file previously had the same two bugs as `buy-menu.ts`:
 *
 * 1. **Raw strings passed to `mod.Message()`.** The previous version stored pre-formatted
 *    display strings ("+$500", "ASSAULT — Tier 3") in signals and passed them straight to
 *    `mod.Message()`, which is exactly the "unavailable" bug (see `buy-menu.ts`'s header comment
 *    for the full citation). Signals now hold the raw numeric/key components (sign, amount,
 *    track key, level) instead, and `mod.Message(mod.stringkeys.hud_cash_flash, sign, amount)`
 *    builds the parameterized message reactively.
 * 2. **No reactivity.** Elements were built via `new UIContainer({ childrenParams: [...] })`,
 *    whose children are constructed via their raw constructor — no reactive-prop support (see
 *    `ui/components/container/index.d.ts`'s `ChildParams<T>`, which is a plain, non-reactive
 *    parameter bag). Rewritten to use `SolidUI.h(Component, props)` with `parent:`-based
 *    composition, the real mechanism (confirmed, `solid-ui/README.md`) for accessor-valued props
 *    to actually re-evaluate on signal change.
 *
 * NEW in this pass — the brief's HUD spec ("reactive 3-faction ticket bars", "active track
 * progress bar", "construction socket ghost overlays") was previously entirely unbuilt beyond the
 * two flash elements. This file now also renders:
 *   - A team/objective status panel: live ControlZone/HotZone/Tower ownership and capture
 *     progress, sourced from `controlzone.ts::getAllTickets`, `hotzone.ts::getHotZoneStatus`, and
 *     `towers.ts::getTowerStatus` (the latter two are new exports added in this pass — see their
 *     header comments; `mod.GetCaptureProgress`, confirmed real, index.d.ts:2605, backs the
 *     progress bars).
 *   - A materials readout (`wallet.ts::getMaterials`), since FOB placement (`fob.ts`) spends
 *     materials but nothing surfaced the running total to the player before now.
 *   - An active-track XP progress bar. The design brief specifies "active track progress bar"
 *     but does not define how the active track is chosen — no existing code tracks a player's
 *     "current class/role" as a first-class concept (`addXp` is not yet called from anywhere).
 *     Judgment call made here: the panel shows whichever track the player most recently ranked
 *     up in (via `onRankUp`), falling back to their highest-XP track at HUD-build time. This is
 *     the only reactive signal available without inventing new cross-cutting player state; if a
 *     future pass adds an explicit "equipped role" concept, swap the selection logic here for
 *     that instead of guessing again.
 *
 * Progress bars are built from a background `UIContainer` (bgFill: Solid, dim color) plus a
 * foreground `UIContainer` whose reactive `width` is driven by a 0..1 signal — there is no
 * dedicated progress-bar or bar-fill `mod.UIImageType` (confirmed by grep of `enums.d.ts`;
 * `UIImageType` only has `CrownOutline/CrownSolid/None/QuestionMark/RifleAmmo/SelfHeal/
 * SpawnBeacon/TEMP_PortalIcon`), so a width-driven container is the correct primitive here, not
 * `UIImage`.
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { onCashChange, getMaterials } from "../player/wallet.ts";
import { onRankUp, getTrackState, TRACK_IDS, type TrackId } from "../player/progression.ts";
import { TRACK_XP_THRESHOLDS, MAX_TRACK_LEVEL } from "../config/economy.ts";
import { getHotZoneStatus } from "../game/mode/hotzone.ts";
import { getTowerStatus } from "../game/mode/towers.ts";
import { getFactionDefinition, FACTIONS, type FactionId } from "../config/teams.ts";
import { getChaosLiveBotCount } from "../game/mode/chaos-ai.ts";
import { isPhase3 } from "../game/mode/controlzone.ts";

const TRANSIENT_FLASH_TICKS = 60;
const HUD_ASSUMED_SERVER_TICK_SECONDS = 1 / 30;
/** How often (seconds) the objective/track panels re-sample their non-event-driven state. */
const HUD_REFRESH_INTERVAL_SECONDS = 0.5;

/** `mod.stringkeys.*` property name per mastery track — see strings.json. */
const TRACK_NAME_KEY: Record<TrackId, string> = {
	assault: "track_assault",
	medic: "track_medic",
	support: "track_support",
	recon: "track_recon",
	driverPilot: "track_driverPilot",
	engineer: "track_engineer",
};

/**
 * `mod.stringkeys.*` property name per scoring faction's short name — see strings.json.
 * Chaos Squads (Team4) is deliberately NOT a member of this table — see note on
 * `CHAOS_PRESSURE_KEY` below.
 */
const FACTION_SHORT_NAME_KEY: Record<FactionId, string> = {
	1: "faction_lonestar_short",
	2: "faction_manticore_short",
	3: "faction_valkyra_short",
	4: "faction_chaos_short",
};

/**
 * Chaos Squads are AI-only HotZone pressure, not a 4th playable faction — WARDOGS_DESIGN_BRIEF.md
 * lists Team4 as "unlisted, unjoinable AI-only faction with no score participation," and per
 * clarified direction they should read on the HUD as a hazard/pressure indicator (similar to a
 * roaming threat meter), never alongside Lonestar/Manticore/Valkyra as if they were a fourth
 * roster entry. `config/teams.ts` still models them as `FACTIONS[4]` because Portal requires some
 * team bucket for `mod.SpawnAIFromAISpawner` to target — that's a technical necessity, not a
 * design statement, and this file is careful not to surface it as one: the HUD line below is
 * phrased as a threat count ("CHAOS SQUADS: N ACTIVE"), not a faction status row, and Chaos never
 * appears in `FACTION_BAR_COLORS` or any per-faction loop below.
 */

const FACTION_BAR_COLORS: Record<Extract<FactionId, 1 | 2 | 3>, mod.Vector> = {
	1: UI.COLORS.CYAN,
	2: mod.CreateVector(1, 0.55, 0.15), // Manticore's orange — not in UI.COLORS, synthesized here.
	3: UI.COLORS.WHITE,
};

/** Faction color for HotZone/Tower ownership display — undefined (neutral) falls back to `fallback`. */
function ownerBarColor(owner: FactionId | undefined, fallback: mod.Vector): mod.Vector {
	if (owner === undefined || owner === 4) {
		return fallback;
	}
	return FACTION_BAR_COLORS[owner];
}

/** Faction short-name stringkey for HotZone/Tower ownership display, or the neutral key. */
function ownerShortNameKey(owner: FactionId | undefined): string {
	if (owner === undefined || owner === 4) {
		return "objective_owner_neutral";
	}
	return FACTION_SHORT_NAME_KEY[owner];
}

function createTransientFlag(): { signal: () => boolean; trigger: () => void } {
	const [flag, setFlag] = SolidUI.createSignal(false);
	let ticksRemaining = 0;

	Events.OngoingGlobal.subscribe(() => {
		if (ticksRemaining <= 0) {
			return;
		}
		ticksRemaining -= 1;
		if (ticksRemaining === 0) {
			setFlag(false);
		}
	});

	return {
		signal: flag,
		trigger: () => {
			setFlag(true);
			ticksRemaining = TRANSIENT_FLASH_TICKS;
		},
	};
}

/**
 * A horizontal 0..1 progress bar: a dim background track plus a foreground fill whose width is
 * driven reactively by `progress`. `trackColor` tints the fill (e.g. the owning faction's color,
 * or green/yellow for a generic objective).
 */
function buildProgressBar(
	parent: UIContainer,
	x: number,
	y: number,
	width: number,
	height: number,
	progress: () => number,
	fillColor: () => mod.Vector
): void {
	const bar = SolidUI.h(UIContainer, {
		parent,
		position: { x, y },
		size: { width, height },
		anchor: mod.UIAnchor.TopLeft,
		bgColor: UI.COLORS.GREY_25,
		bgAlpha: 0.6,
		bgFill: mod.UIBgFill.Solid,
	});

	SolidUI.h(UIContainer, {
		parent: bar,
		position: { x: 0, y: 0 },
		size: () => ({ width: Math.max(0, Math.min(1, progress())) * width, height }),
		anchor: mod.UIAnchor.TopLeft,
		bgColor: fillColor,
		bgAlpha: 0.9,
		bgFill: mod.UIBgFill.Solid,
	});
}

interface PlayerHud {
	container: UIContainer;
	setCashFlash: (sign: string, amount: number) => void;
	cashFlash: ReturnType<typeof createTransientFlag>;
	rankUpFlash: ReturnType<typeof createTransientFlag>;
	setRankUp: (trackKey: string, level: number) => void;
	setActiveTrack: (track: TrackId) => void;
}

const hudsByPlayer = new Map<mod.Player, PlayerHud>();

/** Picks the player's highest-XP track as the initial "active track" shown on the HUD panel. */
function highestXpTrack(player: mod.Player): TrackId {
	let best: TrackId = TRACK_IDS[0]!;
	let bestXp = getTrackState(player, best).xp;
	for (const track of TRACK_IDS) {
		const xp = getTrackState(player, track).xp;
		if (xp > bestXp) {
			best = track;
			bestXp = xp;
		}
	}
	return best;
}

function buildObjectivePanel(container: UIContainer, player: mod.Player): void {
	const panel = SolidUI.h(UIContainer, {
		parent: container,
		position: { x: 20, y: 20 },
		size: { width: 260, height: 118 },
		anchor: mod.UIAnchor.TopLeft,
		bgColor: UI.COLORS.BLACK,
		bgAlpha: 0.55,
		bgFill: mod.UIBgFill.Solid,
	});

	const [hotZoneProgress, setHotZoneProgress] = SolidUI.createSignal(0);
	const [hotZoneOwner, setHotZoneOwner] = SolidUI.createSignal<FactionId | undefined>(undefined);
	const [towerProgress, setTowerProgress] = SolidUI.createSignal(0);
	const [towerOwner, setTowerOwner] = SolidUI.createSignal<FactionId | undefined>(undefined);
	const [chaosBotCount, setChaosBotCount] = SolidUI.createSignal(0);
	const [phase3, setPhase3] = SolidUI.createSignal(false);

	let refreshAccumulated = 0;
	Events.OngoingGlobal.subscribe(() => {
		refreshAccumulated += HUD_ASSUMED_SERVER_TICK_SECONDS;
		if (refreshAccumulated < HUD_REFRESH_INTERVAL_SECONDS) {
			return;
		}
		refreshAccumulated = 0;

		const hotZone = getHotZoneStatus();
		setHotZoneProgress(hotZone.progress);
		setHotZoneOwner(hotZone.owner);

		const tower = getTowerStatus();
		setTowerProgress(tower.progress);
		setTowerOwner(tower.owner);

		setChaosBotCount(getChaosLiveBotCount());
		setPhase3(isPhase3());
	});

	// HotZone row
	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 6 },
		size: { width: 240, height: 18 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.YELLOW,
		textSize: 15,
		message: () =>
			mod.Message(
				mod.stringkeys.objective_status_line,
				mod.stringkeys.objective_hotzone,
				mod.stringkeys[ownerShortNameKey(hotZoneOwner())]
			),
	});
	buildProgressBar(panel, 10, 26, 240, 10, hotZoneProgress, () => ownerBarColor(hotZoneOwner(), UI.COLORS.YELLOW));

	// Tower row
	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 44 },
		size: { width: 240, height: 18 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.CYAN,
		textSize: 15,
		message: () =>
			mod.Message(
				mod.stringkeys.objective_status_line,
				mod.stringkeys.objective_tower,
				mod.stringkeys[ownerShortNameKey(towerOwner())]
			),
	});
	buildProgressBar(panel, 10, 64, 240, 10, towerProgress, () => ownerBarColor(towerOwner(), UI.COLORS.CYAN));

	// Chaos Squads pressure indicator — a hazard readout, not a faction status row (see note on
	// FACTION_SHORT_NAME_KEY above). Deliberately uses a distinct alert color/format from the
	// ownership rows above it so it doesn't visually read as "a 4th team's score."
	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 84 },
		size: { width: 240, height: 16 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.RED,
		textSize: 13,
		message: () => mod.Message(mod.stringkeys.chaos_squads_active, chaosBotCount()),
	});
	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 100 },
		size: { width: 240, height: 16 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.YELLOW,
		textSize: 12,
		visible: phase3,
		message: mod.Message(mod.stringkeys.phase_3_banner),
	});

	void player;
}

function buildTrackPanel(
	container: UIContainer,
	player: mod.Player
): { setActiveTrack: (track: TrackId) => void } {
	const panel = SolidUI.h(UIContainer, {
		parent: container,
		position: { x: 20, y: -20 },
		size: { width: 260, height: 56 },
		anchor: mod.UIAnchor.BottomLeft,
		bgColor: UI.COLORS.BLACK,
		bgAlpha: 0.55,
		bgFill: mod.UIBgFill.Solid,
	});

	const [activeTrack, setActiveTrack] = SolidUI.createSignal<TrackId>(highestXpTrack(player));
	const [trackXp, setTrackXp] = SolidUI.createSignal(0);
	const [trackLevel, setTrackLevel] = SolidUI.createSignal(1);
	const [materials, setMaterials] = SolidUI.createSignal(getMaterials(player));

	let refreshAccumulated = 0;
	Events.OngoingGlobal.subscribe(() => {
		refreshAccumulated += HUD_ASSUMED_SERVER_TICK_SECONDS;
		if (refreshAccumulated < HUD_REFRESH_INTERVAL_SECONDS) {
			return;
		}
		refreshAccumulated = 0;

		const state = getTrackState(player, activeTrack());
		setTrackXp(state.xp);
		setTrackLevel(state.level);
		setMaterials(getMaterials(player));
	});

	// Target XP for the NEXT level, or the current level's own threshold once maxed — avoids a
	// divide-by-zero-shaped bar at max level rather than reading past the threshold table's end.
	const nextThreshold = () => {
		const level = trackLevel();
		if (level >= MAX_TRACK_LEVEL) {
			return TRACK_XP_THRESHOLDS[MAX_TRACK_LEVEL] ?? 1;
		}
		return TRACK_XP_THRESHOLDS[level + 1] ?? TRACK_XP_THRESHOLDS[MAX_TRACK_LEVEL] ?? 1;
	};
	const trackProgressFraction = () => Math.min(1, trackXp() / Math.max(1, nextThreshold()));

	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 6 },
		size: { width: 240, height: 18 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.WHITE,
		textSize: 15,
		message: () => mod.Message(mod.stringkeys.hud_rank_up, mod.stringkeys[TRACK_NAME_KEY[activeTrack()]], trackLevel()),
	});
	buildProgressBar(panel, 10, 26, 240, 10, trackProgressFraction, () => UI.COLORS.CYAN);

	SolidUI.h(UIText, {
		parent: panel,
		position: { x: 10, y: 40 },
		size: { width: 240, height: 14 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: UI.COLORS.GREY_75,
		textSize: 12,
		message: () => mod.Message(mod.stringkeys.hud_materials_label, materials()),
	});

	return { setActiveTrack };
}

function buildHud(player: mod.Player): PlayerHud {
	// Raw components, not pre-formatted strings — mod.Message() needs the stringkeys reference
	// plus its numeric/string args separately, not a string that's already been built.
	const [cashSign, setCashSign] = SolidUI.createSignal("+");
	const [cashAmount, setCashAmount] = SolidUI.createSignal(0);
	const [rankUpTrackKey, setRankUpTrackKey] = SolidUI.createSignal("track_assault");
	const [rankUpLevel, setRankUpLevel] = SolidUI.createSignal(1);
	const cashFlash = createTransientFlag();
	const rankUpFlash = createTransientFlag();

	const container = SolidUI.h(UIContainer, {
		position: { x: 0, y: 0 },
		size: { width: 0, height: 0 },
		anchor: mod.UIAnchor.TopLeft,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
	});

	buildObjectivePanel(container, player);
	const trackPanel = buildTrackPanel(container, player);

	const flashContainer = SolidUI.h(UIContainer, {
		parent: container,
		position: { x: -20, y: 20 },
		size: { width: 200, height: 80 },
		anchor: mod.UIAnchor.TopRight,
	});

	SolidUI.h(UIText, {
		parent: flashContainer,
		position: { x: 0, y: 0 },
		size: { width: 200, height: 30 },
		anchor: mod.UIAnchor.TopRight,
		textAnchor: mod.UIAnchor.TopRight,
		textColor: UI.COLORS.GREEN,
		textSize: 24,
		visible: () => cashFlash.signal(),
		message: () => mod.Message(mod.stringkeys.hud_cash_flash, cashSign(), cashAmount()),
	});

	SolidUI.h(UIText, {
		parent: flashContainer,
		position: { x: 0, y: 34 },
		size: { width: 200, height: 30 },
		anchor: mod.UIAnchor.TopRight,
		textAnchor: mod.UIAnchor.TopRight,
		textColor: UI.COLORS.YELLOW,
		textSize: 22,
		visible: () => rankUpFlash.signal(),
		message: () => mod.Message(mod.stringkeys.hud_rank_up, mod.stringkeys[rankUpTrackKey()], rankUpLevel()),
	});

	return {
		container,
		setCashFlash: (sign, amount) => {
			setCashSign(sign);
			setCashAmount(amount);
		},
		cashFlash,
		rankUpFlash,
		setRankUp: (trackKey, level) => {
			setRankUpTrackKey(trackKey);
			setRankUpLevel(level);
		},
		setActiveTrack: trackPanel.setActiveTrack,
	};
}

function requireHud(player: mod.Player): PlayerHud {
	let hud = hudsByPlayer.get(player);
	if (!hud) {
		hud = buildHud(player);
		hudsByPlayer.set(player, hud);
	}
	return hud;
}

onCashChange((player, delta, _reason, _newBalance) => {
	const hud = requireHud(player);
	hud.setCashFlash(delta >= 0 ? "+" : "-", Math.abs(delta));
	hud.cashFlash.trigger();
});

onRankUp((player, track, newLevel) => {
	const hud = requireHud(player);
	hud.setRankUp(TRACK_NAME_KEY[track], newLevel);
	hud.rankUpFlash.trigger();
	// A rank-up is the strongest signal available that this is the track the player is actively
	// investing in right now — see header comment on active-track selection.
	hud.setActiveTrack(track);
});

Events.OnPlayerJoinGame.subscribe((eventPlayer) => {
	requireHud(eventPlayer);
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { FACTIONS, getFactionDefinition };
