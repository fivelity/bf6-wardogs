/**
 * scoreboard.ts — the custom 3-faction scoreboard overlay.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" (native BF6 overlays only support 2 teams —
 * Known Issue #3). Built with `SolidUI.h(Component, {...})` trees, driven by
 * `SolidUI.createSignal()` state that's coalesced from `controlzone.ts`'s tracked ticket totals
 * on a throttled cadence (`{ deferTicks }`) rather than repainting 30x/second.
 *
 * This file only *displays* state — it never subscribes to `OnPlayerUIButtonEvent` itself, since
 * the `UI` module already owns that hook internally.
 *
 * Deliberately shows only the three scoring factions (`SCORING_FACTION_IDS`) — Chaos Squads
 * (Team4) is AI-only HotZone pressure, not a fourth playable faction (see `config/teams.ts`'s
 * header note), and never earns tickets, so it has no row here. `ui/hud.ts` surfaces Chaos
 * Squads' live bot count separately, phrased as a threat readout rather than a faction score.
 *
 * FIXED IN THIS PASS: the previous version built its element tree via plain
 * `new UIContainer({ childrenParams: [...] })` calls. `UIContainer.ChildParams<T>`
 * (`ui/components/container/index.d.ts`) constructs children via their raw
 * `new (params: T) => UI.Element` constructor — it has NO reactivity mechanism, so
 * function-valued props passed through `childrenParams` were never evaluated as accessors and
 * never updated after first paint (and the header/short-name label was also a raw string literal
 * passed to `mod.Message()` — see `buy-menu.ts`'s header comment for the full citation of why
 * that renders as "unavailable"). The real reactive-composition pattern (confirmed,
 * `solid-ui/README.md` + `h()`'s own doc comment) is: every element — container or leaf — is
 * created via its own `SolidUI.h(Component, props, options)` call, and a child is attached to a
 * parent via the `parent:` prop (a real property on every `UI.Element`), not by nesting
 * descriptor objects. Only `SolidUI.h()` reads function-valued props as accessors, sets up the
 * initial value, and creates an effect that re-runs on signal change. Ticket-repaint throttling
 * now uses `{ deferTicks: 20 }` on the `h()` call instead of a hand-rolled tick accumulator —
 * `deferTicks` is a per-call options property (confirmed, `solid-ui/index.d.ts`), not a
 * standalone function, so once bindings go through `h()` the library's own logical-tick
 * coalescing replaces the manual `Events.OngoingGlobal` counter entirely.
 */

import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { getAllTickets } from "../game/mode/controlzone.ts";
import { SCORING_FACTION_IDS, type FactionId } from "../config/teams.ts";
import { VICTORY_TICKET_TARGET } from "../config/constants.ts";

const [tickets1, setTickets1] = SolidUI.createSignal(0);
const [tickets2, setTickets2] = SolidUI.createSignal(0);
const [tickets3, setTickets3] = SolidUI.createSignal(0);

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

const FACTION_COLORS: Record<Extract<FactionId, 1 | 2 | 3>, mod.Vector> = {
	1: UI.COLORS.CYAN,
	2: mod.CreateVector(1, 0.55, 0.15), // Manticore's orange — not in UI.COLORS, synthesized here.
	3: UI.COLORS.WHITE,
};

/** `mod.stringkeys.*` property name per scoring faction's short name — see strings.json. */
const FACTION_SHORT_NAME_KEY: Record<Extract<FactionId, 1 | 2 | 3>, string> = {
	1: "faction_lonestar_short",
	2: "faction_manticore_short",
	3: "faction_valkyra_short",
};

function refreshTicketSignals(): void {
	const tickets = getAllTickets();
	for (const faction of SCORING_FACTION_IDS) {
		ticketSetters[faction as Extract<FactionId, 1 | 2 | 3>](tickets[faction]);
	}
}

Events.OngoingGlobal.subscribe(() => {
	refreshTicketSignals();
});

/** Builds one faction's row (short-name label + live ticket count) as children of `parent`. */
function buildFactionRow(parent: UIContainer, faction: Extract<FactionId, 1 | 2 | 3>, index: number): void {
	const row = SolidUI.h(UIContainer, {
		parent,
		position: { x: 0, y: index * 40 },
		size: { width: 240, height: 36 },
		anchor: mod.UIAnchor.TopCenter,
	});

	SolidUI.h(UIText, {
		parent: row,
		position: { x: 10, y: 0 },
		size: { width: 100, height: 36 },
		anchor: mod.UIAnchor.TopLeft,
		textColor: FACTION_COLORS[faction],
		textSize: 22,
		message: mod.Message(mod.stringkeys[FACTION_SHORT_NAME_KEY[faction]]),
	});

	// Reactive: message re-evaluates whenever this faction's ticket signal changes. Coalesced to
	// once every 20 logical ticks via the library's own `deferTicks` option (matching the
	// previous hand-rolled accumulator's cadence, but via the confirmed real mechanism).
	SolidUI.h(
		UIText,
		{
			parent: row,
			position: { x: 0, y: 0 },
			size: { width: 100, height: 36 },
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
		position: { x: 10, y: 30 },
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
			position: { x: 10, y: 30 },
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
		size: { width: 240, height: 20 + SCORING_FACTION_IDS.length * 40 },
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
