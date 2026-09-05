// src/features/interface/scoreboard.ts
import { SolidUI } from "bf6-portal-utils/solid-ui";
import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "../progression/profile";

/**
 * Structure of a player's entry inside our scoreboard.
 */
export interface PlayerScoreEntry {
    playerId: number;
    name: string;
    factionId: number; // 1 = Lonestar, 2 = Manticore, 3 = Valkyra
    cash: number;
    kills: number;
    deaths: number;
    fobAssetsBuilt: number;
}

/**
 * Single reactive state container (Store) managing match metrics.
 * Using SolidUI's createStore to ensure fine-grained updates without per-tick redrawing.
 */
export const [scoreboardState, setScoreboardState] = SolidUI.createStore<{
    factionScores: { [factionId: number]: number };
    players: { [playerId: number]: PlayerScoreEntry };
}>({
    factionScores: { 1: 0, 2: 0, 3: 0 },
    players: {}
});

/**
 * Individual Screen-Space Scoreboard UI renderer for each player.
 * Implements a blur-backed overlay showing faction totals and the full contractor list.
 */
export class WARDOGSScoreboardUI {
    private rootWidget: mod.UIWidget | null = null;
    private readonly player: mod.Player;
    private readonly playerId: number;

    // Faction color themes matching WARDOGS specs
    private readonly colors = {
        1: [0.380, 0.878, 1.000], // Lonestar Cyan
        2: [1.000, 0.561, 0.384], // Manticore Orange
        3: [0.816, 0.859, 0.847]  // Valkyra White/Silver
    };

    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.rootWidget = this.render();
    }

    /**
     * Declares the UI widget hierarchy using SolidUI's layout wrappers.
     */
    private render(): mod.UIWidget {
        return SolidUI.render(() => {
            return {
                type: "Container",
                name: `WardogsSB_Root_${this.playerId}`,
                position: [0, 0, 0],
                size: [1100, 650, 0],
                anchor: mod.UIAnchor.Center,
                bgColor: [0.03, 0.03, 0.03],
                bgAlpha: 0.90,
                bgFill: mod.UIBgFill.Blur, // Applies native Frostbite background blur
                visible: false, // Hidden by default, toggled via client key/button hold
                children: [
                    // --- HEADER SECTION: Faction scores ---
                    this.createFactionHeader(),
                    // --- PLAYER LIST GRID ---
                    this.createPlayerListGrid()
                ]
            };
        }, this.player);
    }

    /**
     * Renders the reactive score counters for all 3 factions at the top of the screen.
     */
    private createFactionHeader(): any {
        return {
            type: "Container",
            name: `SB_Header_${this.playerId}`,
            position: [0, -280, 0],
            size: [1000, 80, 0],
            anchor: mod.UIAnchor.TopCenter,
            bgFill: mod.UIBgFill.None,
            children: [
                // Lonestar Score
                {
                    type: "Text",
                    name: `SB_Header_LSTR_${this.playerId}`,
                    textLabel: {
                        text: "LSTR: {}",
                        arg: [() => scoreboardState.factionScores[1]] // Reactive binding to team score
                    },
                    position: [-300, 0, 1],
                    size: [200, 50, 0],
                    textSize: 28,
                    textColor: this.colors[1],
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                },
                // Manticore Score
                {
                    type: "Text",
                    name: `SB_Header_MNTR_${this.playerId}`,
                    textLabel: {
                        text: "MNTR: {}",
                        arg: [() => scoreboardState.factionScores[2]]
                    },
                    position: [0, 0, 1],
                    size: [200, 50, 0],
                    textSize: 28,
                    textColor: this.colors[2],
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                },
                // Valkyra Score
                {
                    type: "Text",
                    name: `SB_Header_VLYR_${this.playerId}`,
                    textLabel: {
                        text: "VLYR: {}",
                        arg: [() => scoreboardState.factionScores[3]]
                    },
                    position: [300, 0, 1],
                    size: [200, 50, 0],
                    textSize: 28,
                    textColor: this.colors[3],
                    textAnchor: mod.UIAnchor.Center,
                    anchor: mod.UIAnchor.Center
                }
            ]
        };
    }

    /**
     * Constructs the column headers and the reactive grid list of all players.
     */
    private createPlayerListGrid(): any {
        return {
            type: "Container",
            name: `SB_Grid_${this.playerId}`,
            position: [0, 40, 0],
            size: [1000, 480, 0],
            anchor: mod.UIAnchor.Center,
            bgFill: mod.UIBgFill.None,
            children: [
                // Grid Column Headers
                {
                    type: "Text",
                    name: `SB_Grid_Headers_${this.playerId}`,
                    textLabel: { text: "OPERATIVE           FACTION     CASH        KILLS     DEATHS     FOB BUILD" },
                    position: [-480, -220, 1],
                    size: [960, 30, 0],
                    textSize: 16,
                    textColor: [0.6, 0.6, 0.6],
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.TopLeft
                },
                // Reactive Loop structures rendered through dynamic JS mapping inside SolidUI
                SolidUI.For(() => Object.values(scoreboardState.players), (playerEntry: PlayerScoreEntry) => {
                    return this.renderPlayerRow(playerEntry);
                })
            ]
        };
    }

    /**
     * Renders a single row representing an operative's live statistics.
     */
    private renderPlayerRow(entry: PlayerScoreEntry): any {
        const factionNames = { 1: "LONESTAR", 2: "MANTICORE", 3: "VALKYRA" };
        const factionColor = this.colors[entry.factionId] || [1, 1, 1];

        return {
            type: "Container",
            name: `Row_Player_${entry.playerId}`,
            size: [960, 35, 0],
            bgFill: mod.UIBgFill.Solid,
            bgColor: [0.1, 0.1, 0.1],
            bgAlpha: 0.4,
            children: [
                // Operative Name
                {
                    type: "Text",
                    name: `Row_PlayerName_${entry.playerId}`,
                    textLabel: { text: entry.name },
                    position: [-480, 0, 1],
                    size: [250, 30, 0],
                    textSize: 15,
                    textColor: factionColor,
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                },
                // Faction Label
                {
                    type: "Text",
                    name: `Row_PlayerFaction_${entry.playerId}`,
                    textLabel: { text: factionNames[entry.factionId] || "PMC" },
                    position: [-230, 0, 1],
                    size: [120, 30, 0],
                    textSize: 14,
                    textColor: factionColor,
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                },
                // Wallet Cash
                {
                    type: "Text",
                    name: `Row_PlayerCash_${entry.playerId}`,
                    textLabel: { text: "${}", arg: [entry.cash] },
                    position: [-110, 0, 1],
                    size: [100, 30, 0],
                    textSize: 14,
                    textColor: [0.4, 0.9, 0.4], // Cash green
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                },
                // Kills
                {
                    type: "Text",
                    name: `Row_PlayerKills_${entry.playerId}`,
                    textLabel: { text: "{}", arg: [entry.kills] },
                    position: [10, 0, 1],
                    size: [60, 30, 0],
                    textSize: 14,
                    textColor: [1, 1, 1],
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                },
                // Deaths
                {
                    type: "Text",
                    name: `Row_PlayerDeaths_${entry.playerId}`,
                    textLabel: { text: "{}", arg: [entry.deaths] },
                    position: [110, 0, 1],
                    size: [60, 30, 0],
                    textSize: 14,
                    textColor: [1.000, 0.384, 0.384], // Warning Red
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                },
                // FOB Assets Constructed
                {
                    type: "Text",
                    name: `Row_PlayerFob_${entry.playerId}`,
                    textLabel: { text: "{}", arg: [entry.fobAssetsBuilt] },
                    position: [210, 0, 1],
                    size: [80, 30, 0],
                    textSize: 14,
                    textColor: [0.9, 0.9, 0.6], // Support yellow
                    textAnchor: mod.UIAnchor.CenterLeft,
                    anchor: mod.UIAnchor.CenterLeft
                }
            ]
        };
    }

    /**
     * Safely toggles the visibility of the blur overlay.
     */
    public toggle(visible: boolean): void {
        if (this.rootWidget) {
            mod.SetUIWidgetVisible(this.rootWidget, visible);
        }
    }
}

/**
 * Scoreboard Manager orchestrating global transactional state updates.
 * Directly listens to PMC lifecycle hooks to update statistics dynamically.
 */
export class ScoreboardManager {
    private playerUIs: Map<number, WARDOGSScoreboardUI> = new Map();

    constructor() {
        this.registerSystemEvents();
    }

    /**
     * Binds native game triggers to synchronous SolidUI state updates.
     */
    private registerSystemEvents(): void {
        // Operative Joins Game -> Instantiate their scorecard and register state
        Events.OnPlayerJoinGame.subscribe((player) => {
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

            const playerId = mod.GetObjId(player);
            const playerTeam = mod.GetTeam(player);
            const factionId = mod.GetObjId(playerTeam);

            // Register default scoring parameters inside our SolidUI store
            setScoreboardState("players", playerId, {
                playerId,
                name: mod.GetPlayerName(player),
                factionId,
                cash: 10000, // Starts with standard PMC balance
                kills: 0,
                deaths: 0,
                fobAssetsBuilt: 0
            });

            // Construct overlay
            const ui = new WARDOGSScoreboardUI(player);
            this.playerUIs.set(playerId, ui);
        });

        // Operative Leaves Game -> Cleanup state to protect server memory
        Events.OnPlayerLeaveGame.subscribe((player) => {
            const playerId = mod.GetObjId(player);
            
            // Delete player rows dynamically from our store
            const currentPlayers = { ...scoreboardState.players };
            delete currentPlayers[playerId];
            setScoreboardState("players", currentPlayers);

            // Dereference widgets
            this.playerUIs.delete(playerId);
        });

        // Terminal Elimination -> Increment stats and update cash wallets
        Events.OnPlayerDied.subscribe((victim, killer) => {
            if (!mod.IsPlayerValid(victim)) return;

            const victimId = mod.GetObjId(victim);
            const victimEntry = scoreboardState.players[victimId];

            if (victimEntry) {
                // Wipe primary weapon and apply stats increment
                setScoreboardState("players", victimId, "deaths", victimEntry.deaths + 1);
            }

            // Clean check for killers
            if (killer && mod.IsPlayerValid(killer) && !mod.GetSoldierState(killer, mod.SoldierStateBool.IsAISoldier)) {
                const killerId = mod.GetObjId(killer);
                const killerEntry = scoreboardState.players[killerId];

                if (killerEntry) {
                    const profile = mercenaryRegistry.get(killerId);
                    const currentCash = profile ? profile.getCash() : killerEntry.cash;

                    setScoreboardState("players", killerId, {
                        ...killerEntry,
                        kills: killerEntry.kills + 1,
                        cash: currentCash
                    });
                }
            }
        });
    }

    /**
     * Refreshes overall faction scores across all human client screens.
     */
    public updateFactionScore(factionId: number, score: number): void {
        if (factionId >= 1 && factionId <= 3) {
            setScoreboardState("factionScores", factionId, score);
        }
    }

    /**
     * Increments the FOB construct hits count for an operative row.
     */
    public recordFobConstruction(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const entry = scoreboardState.players[playerId];

        if (entry) {
            const profile = mercenaryRegistry.get(playerId);
            const currentCash = profile ? profile.getCash() : entry.cash;

            setScoreboardState("players", playerId, {
                ...entry,
                fobAssetsBuilt: entry.fobAssetsBuilt + 1,
                cash: currentCash
            });
        }
    }

    /**
     * Programmatic trigger allowing players to toggle the scoreboard view.
     */
    public togglePlayerScoreboard(player: mod.Player, visible: boolean): void {
        const playerId = mod.GetObjId(player);
        const ui = this.playerUIs.get(playerId);
        if (ui) {
            ui.toggle(visible);
        }
    }
}

// Export single shared instance for modular feature-slice referencing
export const scoreboardManager = new ScoreboardManager();
