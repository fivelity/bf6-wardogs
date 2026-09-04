// ============================================
// Scoreboard Module: 3-Faction Scoreboard Columns
// ============================================

import mod from "mod";
import * as config from "../core/config";
import * as vec from "../shared/utils";

// ============================================================
// Scoreboard UI Components
// ============================================================

/**
 * Create and show the scoreboard UI.
 */
export function ShowScoreboard(player: mod.Player) {
    const teamId = mod.GetObjId(mod.GetTeam(player));

    // Create scoreboard container
    const scoreboard = mod.CreateContainer();
    mod.SetWidgetPosition(scoreboard, 10, 10);
    mod.SetWidgetSize(scoreboard, 700, 200);
    mod.SetWidgetAnchor(scoreboard, mod.UIAnchor.TopLeft);

    // Add team score rows
    const teams = [
        { id: config.TEAM_LONESTAR_ID, name: "Lonestar", color: config.TEAM_LONESTAR_COLOR },
        { id: config.TEAM_MANTICORE_ID, name: "Manticore", color: config.TEAM_MANTICORE_COLOR },
        { id: config.TEAM_VALKYRA_ID, name: "Valkyra", color: config.TEAM_VALKYRA_COLOR },
    ];

    teams.forEach(team => {
        const score = team.id === teamId ? getTeamScore(team.id) : getEnemyScore(team.id);
        const row = CreateScoreRow(score, team.name, team.color, team.id === teamId);
        mod.AddContainerChild(scoreboard, row);
    });

    // Show the scoreboard
    mod.SetUIWidgetVisible(scoreboard, true);
}

/**
 * Create a single score row.
 */
export function CreateScoreRow(
    score: number,
    teamName: string,
    color: number[],
    isLocalTeam: boolean
): mod.UIWidget {
    const row = mod.CreateContainer();
    mod.SetWidgetPosition(row, 0, 0);
    mod.SetWidgetSize(row, 700, 40);

    const bg = isLocalTeam ? [0.1, 0.15, 0.2] : [0.1, 0.1, 0.1];
    mod.SetWidgetBG(row, mod.UIBgFill.Solid, bg, 0.3);

    // Team name
    const nameText = mod.CreateText();
    mod.SetWidgetText(nameText, teamName);
    mod.SetWidgetTextColor(nameText, color);
    mod.SetWidgetTextSize(nameText, 18);
    mod.SetWidgetPosition(nameText, 10, 5);
    mod.SetWidgetAnchor(nameText, mod.UIAnchor.Left);
    mod.AddContainerChild(row, nameText);

    // Score
    const scoreText = mod.CreateText();
    mod.SetWidgetText(scoreText, `${score}`);
    mod.SetWidgetTextColor(scoreText, [1, 1, 1]);
    mod.SetWidgetTextSize(scoreText, 18);
    mod.SetWidgetPosition(scoreText, 60, 5);
    mod.SetWidgetAnchor(scoreText, mod.UIAnchor.Left);
    mod.AddContainerChild(row, scoreText);

    return row;
}

// ============================================================
// Score Management
// ============================================================

/**
 * Get the score for a specific team.
 */
export function getTeamScore(teamId: number): number {
    // Would query events module for team scores
    // Placeholder - returns 0
    return 0;
}

/**
 * Get the score for enemy teams.
 */
export function getEnemyScore(teamId: number): number {
    return getTeamScore(teamId);
}

// ============================================================
// Scoreboard Tick Updates
// ============================================================

/**
 * Update scoreboard text each tick.
 */
export function TickScoreboard() {
    // Update team scores based on current game state
    // Refresh UI if visible
}

/**
 * Show victory scoreboard.
 */
export function ShowVictoryScreen(winnerId: number) {
    // Create victory UI with winner announcement
    // Show individual statistics
    // Show team statistics
    // Show MVP/highlights
}
