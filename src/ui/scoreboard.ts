/**
 * scoreboard.ts — the custom 3-faction "Team Score" scoreboard overlay.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" (native BF6 overlays only support 2 teams —
 * Known Issue #3). Built with `SolidUI.h(Component, {...})` trees, driven by
 * `SolidUI.createSignal()` state that's coalesced from `controlzone.ts`'s tracked ticket/
 * player-count totals on a throttled cadence (`{ deferTicks }`) rather than repainting
 * 30x/second.
 *
 * ── Team colors (per current direction) ──
 * Lonestar = BLUE, Manticore = GREEN, Valkyra = RED — sourced from `config/teams.ts`'s
 * `FACTION_COLOR_RGB` (the single source of truth for faction color, shared with `ui/hud.ts`)
 * rather than a locally hard-coded table.
 *
 * ── Player-count row (new in this pass) ──
 * Per the updated Control Zone/HotZone tracking spec, each faction's row now shows the live
 * number of tracked players that faction currently has inside the Control Zone and/or HotZone
 * (`controlzone.ts`'s `getAllPlayerCounts` — the *raw* headcount, not the HotZone-weighted count
 * used to decide which faction earns the tick's ticket), alongside the ticket count and the
 * victory-progress bar.
 *
 * This file only *displays* state — it never subscribes to `OnPlayerUIButtonEvent` itself, since
 * the `UI` module already owns that hook internally.
 *
 * Deliberately shows only the three scoring factions (`SCORING_FACTION_IDS`) — Chaos Squads
 * (Team4) is AI-only HotZone pressure, not a fourth playable faction (see `config/teams.ts`'s
 * header note), and never earns tickets, so it has no row here. `ui/hud.ts` surfaces Chaos
 * Squads' live bot count separately, phrased as a threat readout rather than a faction score.
 *
 * Every element — container or leaf — is created via its own `SolidUI.h(Component, props,
 * options)` call, and a child is attached to a parent via the `parent:` prop (a real property on
 * every `UI.Element`), not by nesting descriptor objects — only `SolidUI.h()` reads
 * function-valued props as accessors and re-evaluates them on signal change. Ticket/player-count
 * repaint throttling uses `{ deferTicks: 20 }` on the `h()` call, the library's own logical-tick
 * coalescing mechanism (confirmed, `solid-ui/index.d.ts`).
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { getAllTickets, getAllPlayerCounts } from "../game/mode/controlzone.ts";
import { SCORING_FACTION_IDS, FACTION_COLOR_RGB, type FactionId } from "../config/teams.ts";
import { VICTORY_TICKET_TARGET } from "../config/constants.ts";

const [tickets1, setTickets1] = SolidUI.createSignal(0);
const [tickets2, setTickets2] = SolidUI.createSignal(0);
const [tickets3, setTickets3] = SolidUI.createSignal(0);

const [players1, setPlayers1] = SolidUI.createSignal(0);
const [players2, setPlayers2] = SolidUI.createSignal(0);
const [players3, setPlayers3] = SolidUI.createSignal(0);

const ticketSetters: Record<Extract<FactionId, 1 | 2 | 3>, (value: number) => void> = {
	1: setTickets1,
	2: setTickets2,
	3: setTickets3,
};
const ticketSignals: Record<Extract<FactionId, 1 | 2 | 3>, () => number> = {
	1: tickets1,
	2: tickets2,
	3: tickets3,
};

const playerCountSetters: Record<Extract<FactionId, 1 | 2 | 3>, (value: number) => void> = {
	1: setPlayers1,
	2: setPlayers2,
	3: setPlayers3,
};
const playerCountSignals: Record<Extract<FactionId, 1 | 2 | 3>, () => number> = {
	1: players1,
	2: players2,
	3: players3,
};

/** Per-faction `mod.Vector` color, built once from `config/teams.ts`'s RGB source of truth. */
const FACTION_COLORS: Record<Extract<FactionId, 1 | 2 | 3>, mod.Vector> = {
	1: mod.CreateVector(...FACTION_COLOR_RGB[1]),
	2: mod.CreateVector(...FACTION_COLOR_RGB[2]),
	3: mod.CreateVector(...FACTION_COLOR_RGB[3]),
};

/** `mod.stringkeys.*` property name per scoring faction's short name — see strings.json. */
const SCOREBOARD_FACTION_SHORT_NAME_KEY: Record<Extract<FactionId, 1 | 2 | 3>, string> = {
	1: "faction_lonestar_short",
	2: "faction_manticore_short",
	3: "faction_valkyra_short",
};

function refreshSignals(): void {
	const tickets = getAllTickets();
	const playerCounts = getAllPlayerCounts();
	for (const faction of SCORING_FACTION_IDS) {
		const key = faction as Extract<FactionId, 1 | 2 | 3>;
		ticketSetters[key](tickets[faction]);
		playerCountSetters[key](playerCounts[faction]);
	}
}

Events.OngoingGlobal.subscribe(() => {
	refreshSignals();
});

/** Builds one faction's row (short-name label, live player count, live ticket count) as children of `parent`. */
function buildFactionRow(parent: UIContainer, faction: Extract<FactionId, 1 | 2 | 3>, index: number): void {
	const row = SolidUI.h(UIContainer, {
		parent,
		position: { x: 0, y: index * 44 },
		size: { width: 240, height: 40 },
		anchor: mod.UIAnchor.TopCenter,
	});

	SolidUI.h(UIText, {
		parent: row,
		position: { x: 10, y: 0 },
		size: { width: 90, height: 22 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: FACTION_COLORS[faction],
		textSize: 22,
		message: mod.Message(mod.stringkeys[SCOREBOARD_FACTION_SHORT_NAME_KEY[faction]]),
	});

	// Live player-in-zone count — reactive, coalesced to once every 20 logical ticks via the
	// library's own `deferTicks` option.
	SolidUI.h(
		UIText,
		{
			parent: row,
			position: { x: 100, y: 0 },
			size: { width: 90, height: 22 },
			anchor: mod.UIAnchor.TopLeft,
			textColor: UI.COLORS.GREY_75,
			textSize: 15,
			message: () => mod.Message(mod.stringkeys.scoreboard_player_count, playerCountSignals[faction]()),
		},
		{ deferTicks: 20 }
	);

	// Reactive ticket count: message re-evaluates whenever this faction's ticket signal changes.
	SolidUI.h(
		UIText,
		{
			parent: row,
			position: { x: 0, y: 0 },
			size: { width: 100, height: 22 },
			anchor: mod.UIAnchor.TopRight,
			textAnchor: mod.UIAnchor.TopRight,
			textColor: UI.COLORS.WHITE,
			textSize: 22,
			message: () => mod.Message(mod.stringkeys.scoreboard_ticket_count, ticketSignals[faction]()),
		},
		{ deferTicks: 20 }
	);

	// Underlying progress-toward-victory bar — the raw ticket count alone doesn't communicate how
	// close a faction is to VICTORY_TICKET_TARGET at a glance.
	const barWidth = 220;
	SolidUI.h(UIContainer, {
		parent: row,
		position: { x: 10, y: 26 },
		size: { width: barWidth, height: 4 },
		anchor: mod.UIAnchor.TopLeft,
		bgColor: UI.COLORS.GREY_25,
		bgAlpha: 0.6,
		bgFill: mod.UIBgFill.Solid,
	});
	SolidUI.h(
		UIContainer,
		{
			parent: row,
			position: { x: 10, y: 26 },
			size: () => ({
				width: Math.max(0, Math.min(1, ticketSignals[faction]() / VICTORY_TICKET_TARGET)) * barWidth,
				height: 4,
			}),
			anchor: mod.UIAnchor.TopLeft,
			bgColor: FACTION_COLORS[faction],
			bgAlpha: 0.9,
			bgFill: mod.UIBgFill.Solid,
		},
		{ deferTicks: 20 }
	);
}

function buildScoreboard(player: mod.Player): UIContainer {
	const container = SolidUI.h(UIContainer, {
		position: { x: 0, y: 20 },
		size: { width: 240, height: 20 + SCORING_FACTION_IDS.length * 44 },
		anchor: mod.UIAnchor.TopCenter,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
	});

	SolidUI.h(UIText, {
		parent: container,
		position: { x: 0, y: 0 },
		size: { width: 240, height: 16 },
		anchor: mod.UIAnchor.TopCenter,
		textColor: UI.COLORS.GREY_75,
		textSize: 12,
		message: mod.Message(mod.stringkeys.scoreboard_ticket_target, VICTORY_TICKET_TARGET),
	});

	SCORING_FACTION_IDS.forEach((faction, index) =>
		buildFactionRow(container, faction as Extract<FactionId, 1 | 2 | 3>, index)
	);

	return container;
}

const scoreboardsByPlayer = new Map<mod.Player, UIContainer>();

Events.OnPlayerDeployed.subscribe((eventPlayer) => {
	if (!scoreboardsByPlayer.has(eventPlayer)) {
		scoreboardsByPlayer.set(eventPlayer, buildScoreboard(eventPlayer));
	}
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { buildFactionRow };
