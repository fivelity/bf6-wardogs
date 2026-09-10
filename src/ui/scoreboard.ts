/**
 * scoreboard.ts — the custom 3-faction scoreboard overlay.
 *
 * Design: WARDOGS_DESIGN_BRIEF.md → "UI Elements" (native BF6 overlays only support 2 teams —
 * Known Issue #3). Built with `SolidUI.h(UI.X, {...})` trees per AGENTS.md §5, driven by
 * `SolidUI.createSignal()` state that's coalesced from `controlzone.ts`'s tracked ticket totals
 * on a throttled cadence (`deferTicks`) rather than repainting 30x/second.
 *
 * This file only *displays* state — it never subscribes to `OnPlayerUIButtonEvent` itself, since
 * the `UI` module already owns that hook internally (AGENTS.md §4).
 *
 * NOTE (AGENTS.md §2): the exact `SolidUI` export names/signatures used below
 * (`createSignal`, `h`, `deferTicks`) are per BUILD_GUIDE.md §5's own citation of the
 * `solid-ui/README.md` Quick Start pattern; re-read that README verbatim against
 * `node_modules/bf6-portal-utils/solid-ui/` before shipping and adjust call shapes if they differ.
 */

// src/ui/scoreboard.ts
import { Events } from "../../node_modules/bf6-portal-utils/events/index.ts";
import { SolidUI } from "../../node_modules/bf6-portal-utils/solid-ui/index.ts";
import { UI } from "../../node_modules/bf6-portal-utils/ui/index.ts";
import { UIContainer } from "../../node_modules/bf6-portal-utils/ui/components/container/index.ts";
import { UIText } from "../../node_modules/bf6-portal-utils/ui/components/text/index.ts";
import { getAllTickets } from "../game/mode/controlzone.ts";
import { FACTIONS, SCORING_FACTION_IDS } from "../config/teams.ts";

const [tickets1, setTickets1] = SolidUI.createSignal(0);
const [tickets2, setTickets2] = SolidUI.createSignal(0);
const [tickets3, setTickets3] = SolidUI.createSignal(0);

const ticketSetters: Record<number, (value: number) => void> = {
	1: setTickets1,
	2: setTickets2,
	3: setTickets3,
};
const ticketSignals: Record<number, () => number> = {
	1: tickets1,
	2: tickets2,
	3: tickets3,
};

const FACTION_COLORS: Record<number, mod.Vector> = {
	1: UI.COLORS.CYAN,
	2: UI.COLORS.RED,
	3: UI.COLORS.WHITE,
};

function refreshTicketSignals(): void {
	const tickets = getAllTickets();
	for (const faction of SCORING_FACTION_IDS) {
		ticketSetters[faction](tickets[faction]);
	}
}

let ticketAccumulator = 0;
Events.OngoingGlobal.subscribe(() => {
	ticketAccumulator++;
	if (ticketAccumulator >= 20) {
		ticketAccumulator = 0;
		refreshTicketSignals();
	}
});

function buildScoreboard(player: mod.Player): UIContainer {
	return new UIContainer({
		position: { x: 0, y: 20 },
		size: { width: 240, height: 140 },
		anchor: mod.UIAnchor.TopCenter,
		receiver: player,
		visible: true,
		uiInputModeWhenVisible: false,
		childrenParams: SCORING_FACTION_IDS.map((faction, index) => ({
			type: UIContainer,
			position: { x: 0, y: index * 44 },
			size: { width: 240, height: 40 },
			anchor: mod.UIAnchor.TopCenter,
			childrenParams: factionRowChildren(faction),
		})) as UIContainer.ChildParams<any>[],
	});
}

function factionRowChildren(faction: number): UIContainer.ChildParams<any>[] {
	const definition = FACTIONS[faction as 1 | 2 | 3];
	return [
		{
			type: UIText,
			position: { x: 10, y: 0 },
			size: { width: 100, height: 40 },
			anchor: mod.UIAnchor.TopLeft,
			textColor: FACTION_COLORS[faction],
			textSize: 22,
			message: mod.Message(definition.shortName),
		},
		{
			type: UIText,
			position: { x: 0, y: 0 },
			size: { width: 100, height: 40 },
			anchor: mod.UIAnchor.TopRight,
			textColor: UI.COLORS.WHITE,
			textSize: 22,
			message: () => mod.Message(String(ticketSignals[faction]())),
		},
	];
}

const scoreboardsByPlayer = new Map<mod.Player, UIContainer>();

Events.OnPlayerDeployed.subscribe((eventPlayer) => {
	if (!scoreboardsByPlayer.has(eventPlayer)) {
		scoreboardsByPlayer.set(eventPlayer, buildScoreboard(eventPlayer));
	}
});

Events.OnPlayerLeaveGame.subscribe((_eventNumber) => {});

export { factionRowChildren };