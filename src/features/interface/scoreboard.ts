// src/features/interface/scoreboard.ts
import { Events } from "bf6-portal-utils/events";
import { mercenaryRegistry } from "../progression/profile";

export interface PlayerScoreEntry {
    playerId: number;
    name: string;
    factionId: number;
    cash: number;
    kills: number;
    deaths: number;
    fobAssetsBuilt: number;
}

export const scoreboardState: {
    factionScores: Record<number, number>;
    players: Record<number, PlayerScoreEntry>;
} = {
    factionScores: { 1: 0, 2: 0, 3: 0 },
    players: {}
};

export function setScoreboardState(updater: Partial<typeof scoreboardState>): void {
    if (updater.factionScores) {
        scoreboardState.factionScores = { ...scoreboardState.factionScores, ...updater.factionScores };
    }
    if (updater.players) {
        scoreboardState.players = { ...scoreboardState.players, ...updater.players };
    }
}

export class WARDOGSScoreboardUI {
    private rootWidget: mod.UIWidget | null = null;
    private readonly player: mod.Player;
    private readonly playerId: number;
    private readonly colors: Record<number, number[]> = {
        1: [0.380, 0.878, 1.000],
        2: [1.000, 0.561, 0.384],
        3: [0.816, 0.859, 0.847]
    };
    constructor(player: mod.Player) {
        this.player = player;
        this.playerId = mod.GetObjId(player);
        this.rootWidget = this.render();
    }
    private render(): mod.UIWidget {
        return mod.ParseUI({
            type: "Container", name: `WardogsSB_Root_${this.playerId}`,
            position: mod.CreateVector(0, 0, 0), size: mod.CreateVector(1100, 650, 0),
            anchor: mod.UIAnchor.Center, bgColor: mod.CreateVector(0.03, 0.03, 0.03),
            bgAlpha: 0.90, bgFill: mod.UIBgFill.Blur, visible: false,
            children: [this.createFactionHeader(), this.createPlayerListGrid()]
        });
    }
    private createFactionHeader(): any {
        return {
            type: "Container", name: `SB_Header_${this.playerId}`,
            position: mod.CreateVector(0, -280, 0), size: mod.CreateVector(1000, 80, 0),
            anchor: mod.UIAnchor.TopCenter, bgFill: mod.UIBgFill.None,
            children: [
                { type: "Text", name: `SB_Header_LSTR_${this.playerId}`, textLabel: "LSTR: {}", textSize: 18, textColor: [0.38, 0.878, 1.0], anchor: mod.UIAnchor.Center },
                { type: "Text", name: `SB_Header_MANT_${this.playerId}`, textLabel: "MANT: {}", textSize: 18, textColor: [1.0, 0.561, 0.384], anchor: mod.UIAnchor.Center },
                { type: "Text", name: `SB_Header_VALK_${this.playerId}`, textLabel: "VALK: {}", textSize: 18, textColor: [0.816, 0.859, 0.847], anchor: mod.UIAnchor.Center }
            ]
        };
    }
    private createPlayerListGrid(): any {
        return {
            type: "Container", name: `SB_PlayerList_${this.playerId}`,
            position: mod.CreateVector(0, -180, 0), size: mod.CreateVector(960, 400, 0),
            anchor: mod.UIAnchor.Center, children: []
        };
    }
    public toggle(visible: boolean): void {
        if (this.rootWidget) { mod.SetUIWidgetVisible(this.rootWidget, visible); }
    }
    private renderPlayerRow(entry: PlayerScoreEntry): any {
        const factionNames: Record<number, string> = { 1: "LONESTAR", 2: "MANTICORE", 3: "VALKYRA" };
        const factionColor = this.colors[entry.factionId] || [1, 1, 1];
        return {
            type: "Container", name: `Row_Player_${entry.playerId}`,
            size: mod.CreateVector(960, 35, 0), bgFill: mod.UIBgFill.Solid,
            bgColor: mod.CreateVector(0.1, 0.1, 0.1), bgAlpha: 0.4,
            children: [
                { type: "Text", name: `Row_PlayerName_${entry.playerId}`, textLabel: entry.name, position: mod.CreateVector(-480, 0, 1), size: mod.CreateVector(250, 30, 0), textSize: 15, textColor: factionColor, textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `Row_PlayerFaction_${entry.playerId}`, textLabel: factionNames[entry.factionId] || "PMC", position: mod.CreateVector(-230, 0, 1), size: mod.CreateVector(120, 30, 0), textSize: 14, textColor: factionColor, textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `Row_PlayerCash_${entry.playerId}`, textLabel: `$${entry.cash}`, position: mod.CreateVector(-110, 0, 1), size: mod.CreateVector(100, 30, 0), textSize: 14, textColor: [0.4, 0.9, 0.4], textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `Row_PlayerKills_${entry.playerId}`, textLabel: `${entry.kills}`, position: mod.CreateVector(10, 0, 1), size: mod.CreateVector(60, 30, 0), textSize: 14, textColor: [1, 1, 1], textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `Row_PlayerDeaths_${entry.playerId}`, textLabel: `${entry.deaths}`, position: mod.CreateVector(110, 0, 1), size: mod.CreateVector(60, 30, 0), textSize: 14, textColor: [1.000, 0.384, 0.384], textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft },
                { type: "Text", name: `Row_PlayerFob_${entry.playerId}`, textLabel: `${entry.fobAssetsBuilt}`, position: mod.CreateVector(210, 0, 1), size: mod.CreateVector(80, 30, 0), textSize: 14, textColor: [0.9, 0.9, 0.6], textAnchor: mod.UIAnchor.CenterLeft, anchor: mod.UIAnchor.CenterLeft }
            ]
        };
    }
}

export class ScoreboardManager {
    private playerUIs: Map<number, WARDOGSScoreboardUI> = new Map();
    constructor() { this.registerSystemEvents(); }
    private registerSystemEvents(): void {
        Events.OnPlayerJoinGame.subscribe((player) => {
            if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;
            const playerId = mod.GetObjId(player);
            const playerTeam = mod.GetTeam(player);
            const factionId = mod.GetObjId(playerTeam);
            scoreboardState.players[playerId] = {
                playerId, name: mod.GetPlayerName(player), factionId,
                cash: 10000, kills: 0, deaths: 0, fobAssetsBuilt: 0
            };
            this.playerUIs.set(playerId, new WARDOGSScoreboardUI(player));
        });
        Events.OnPlayerLeaveGame.subscribe((playerId) => {
            delete scoreboardState.players[playerId];
            this.playerUIs.delete(playerId);
        });
        Events.OnPlayerDied.subscribe((victim, killer) => {
            if (!mod.IsPlayerValid(victim)) return;
            const victimId = mod.GetObjId(victim);
            const victimEntry = scoreboardState.players[victimId];
            if (victimEntry) { scoreboardState.players[victimId].deaths = victimEntry.deaths + 1; }
            if (killer && mod.IsPlayerValid(killer) && !mod.GetSoldierState(killer, mod.SoldierStateBool.IsAISoldier)) {
                const killerId = mod.GetObjId(killer);
                const killerEntry = scoreboardState.players[killerId];
                if (killerEntry) {
                    const profile = mercenaryRegistry.get(killerId);
                    const currentCash = profile ? profile.getCash() : killerEntry.cash;
                    scoreboardState.players[killerId] = { ...killerEntry, kills: killerEntry.kills + 1, cash: currentCash };
                }
            }
        });
    }
    public updateFactionScore(factionId: number, score: number): void {
        if (factionId >= 1 && factionId <= 3) { scoreboardState.factionScores[factionId] = score; }
    }
    public recordFobConstruction(player: mod.Player): void {
        const playerId = mod.GetObjId(player);
        const entry = scoreboardState.players[playerId];
        if (entry) {
            const profile = mercenaryRegistry.get(playerId);
            const currentCash = profile ? profile.getCash() : entry.cash;
            scoreboardState.players[playerId] = { ...entry, fobAssetsBuilt: entry.fobAssetsBuilt + 1, cash: currentCash };
        }
    }
    public togglePlayerScoreboard(player: mod.Player, visible: boolean): void {
        const playerId = mod.GetObjId(player);
        const ui = this.playerUIs.get(playerId);
        if (ui) { ui.toggle(visible); }
    }
}

export const scoreboardManager = new ScoreboardManager();
