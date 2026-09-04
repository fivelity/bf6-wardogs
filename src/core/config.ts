// Core Configuration Constants
// All magic numbers, IDs, timings, and colors defined here

// Game Version
const VERSION: [number, number, number] = [1, 0, 0];

// Team IDs (Human teams)
const TEAM_LONESTAR_ID: number = 1; // Blue
const TEAM_MANTICORE_ID: number = 2; // Green
const TEAM_VALKYRA_ID: number = 3;  // Red
const TEAM_AI_ID: number = 4;       // Black (Rogue AI)

// Team Colors (RGB 0-1)
const TEAM_LONESTAR_COLOR: number[] = [0, 0.3, 1];
const TEAM_MANTICORE_COLOR: number[] = [0, 1, 0.2];
const TEAM_VALKYRA_COLOR: number[] = [1, 0.1, 0.1];
const TEAM_AI_COLOR: number[] = [0.15, 0.15, 0.15];

// Game Object IDs (must match Godot scene placements)
const TEAM1_HQ_ID: number = 100;
const TEAM2_HQ_ID: number = 101;
const TEAM3_HQ_ID: number = 102;

const TEAM1_BUY_STATION_ID: number = 111;
const TEAM2_BUY_STATION_ID: number = 112;
const TEAM3_BUY_STATION_ID: number = 113;

const TEAM1_VEHICLE_SPAWNER_ID: number = 110;
const TEAM2_VEHICLE_SPAWNER_ID: number = 120;
const TEAM3_VEHICLE_SPAWNER_ID: number = 130;

// Control Zone
const CONTROL_ZONE_AREA_ID: number = 900;
const CONTROL_ZONE_CAPTUREPOINT_ID: number = 9000;

// HotZone
const HOTZONE_AREA_ID: number = 901;
const HOTZONE_CAPTUREPOINT_ID: number = 9001;

// AI Spawner
const AI_SPAWNER_ID: number = 401;

// Team Switching Mannequins
const MANNEQUIN_TEAM_SWITCH_ID: number = 998;
const MANNEQUIN_TEAM_SWITCH_2_ID: number = 999;

// Game Timing Constants
const MATCH_DURATION_SECONDS: number = 15 * 60; // 15 minutes
const COUNTDOWN_SECONDS: number = 60; // 1 minute pre-game
const HOTZONE_TICK_INTERVAL: number = 1; // Points awarded per second
const HOTZONE_DRIFT_INTERVAL: number = 1; // HotZone position updated every second
const HOTZONE_DRIFT_SPEED: number = 20; // Units per second (tweakable)

// Scoring Constants
const TARGET_SCORE: number = 100;
const HOTZONE_SCORE_MULTIPLIER: number = 2;
const TICK_SCORE_PER_PLAYER: number = 1;

// Cash Constants
const STARTING_CASH: number = 10000;
const KILL_REWARD: number = 500;
const REVIVE_REWARD: number = 300;
const CONSTRUCTION_REWARD: number = 100;
const SPOT_REWARD: number = 50;
const LOGISTICS_REWARD: number = 800;
const TICK_CASH_REWARD: number = 100;
const HOTZONE_TICK_CASH_REWARD: number = 200;

// XP Constants
const ASSAULT_KILL_XP: number = 150;
const MEDIC_REVIVE_XP: number = 200;
const RECON_SPOT_XP: number = 100;
const SUPPORT_CONSTRUCTION_XP: number = 120;
const DRIVER_TRANSPORT_XP: number = 250;
const PILOT_TRANSPORT_XP: number = 300;

// Scavenger Pack Constants
const SALVAGE_BACKPACK_DURATION: number = 60; // Seconds before garbage collected
const SALVAGE_CASH_RANGE_MIN: number = 150;
const SALVAGE_CASH_RANGE_MAX: number = 350;
const SALVAGE_XP_REWARD: number = 100;
const SALVAGE_AMMO_RESTOCK: boolean = true;

// UI Timing Constants
const MESSAGE_DISPLAY_SECONDS: number = 6;
const HOTZONE_VISUAL_UPDATE_RATE: number = 0.1; // Seconds
const UI_REFRESH_RATE: number = 0.5; // Seconds

// Player State Thresholds
const MINIMUM_INITIAL_PLAYERS: number = 6;
const MAX_HUMAN_PLAYERS_PER_TEAM: number = 12;
const AI_BOTS_PER_SQUAD: number = 3;
const AI_SQUADS_COUNT: number = 4;
const AI_TOTAL_BOTS: number = 12;
const AI_SPAWN_HEALTH_MULTIPLIER: number = 2.5;

// Debug Flags (set to false before sharing/building)
const DEBUG_JSPPLAYER: boolean = false;
const DEBUG_TEAM: boolean = false;
const DEBUG_SCORE: boolean = false;
const DEBUG_CASH: boolean = false;
const DEBUG_HOTZONE: boolean = false;
const DEBUG_AI: boolean = false;
const DEBUG_UIS: boolean = false;
const DEBUG_CONSTRUCTION: boolean = false;
const DEBUG_SCAVENGE: boolean = false;
const DEBUG_SPAWNING: boolean = false;
const DEBUG_NETWORK: boolean = false;

export {
    VERSION,
    TEAM_LONESTAR_ID, TEAM_MANTICORE_ID, TEAM_VALKYRA_ID, TEAM_AI_ID,
    TEAM_LONESTAR_COLOR, TEAM_MANTICORE_COLOR, TEAM_VALKYRA_COLOR, TEAM_AI_COLOR,
    TEAM1_HQ_ID, TEAM2_HQ_ID, TEAM3_HQ_ID,
    TEAM1_BUY_STATION_ID, TEAM2_BUY_STATION_ID, TEAM3_BUY_STATION_ID,
    TEAM1_VEHICLE_SPAWNER_ID, TEAM2_VEHICLE_SPAWNER_ID, TEAM3_VEHICLE_SPAWNER_ID,
    CONTROL_ZONE_AREA_ID, CONTROL_ZONE_CAPTUREPOINT_ID,
    HOTZONE_AREA_ID, HOTZONE_CAPTUREPOINT_ID,
    AI_SPAWNER_ID,
    MANNEQUIN_TEAM_SWITCH_ID, MANNEQUIN_TEAM_SWITCH_2_ID,
    MATCH_DURATION_SECONDS, COUNTDOWN_SECONDS,
    HOTZONE_TICK_INTERVAL, HOTZONE_DRIFT_INTERVAL, HOTZONE_DRIFT_SPEED,
    TARGET_SCORE, HOTZONE_SCORE_MULTIPLIER, TICK_SCORE_PER_PLAYER,
    STARTING_CASH, KILL_REWARD, REVIVE_REWARD,
    CONSTRUCTION_REWARD, SPOT_REWARD, LOGISTICS_REWARD,
    TICK_CASH_REWARD, HOTZONE_TICK_CASH_REWARD,
    ASSAULT_KILL_XP, MEDIC_REVIVE_XP, RECON_SPOT_XP,
    SUPPORT_CONSTRUCTION_XP, DRIVER_TRANSPORT_XP, PILOT_TRANSPORT_XP,
    SALVAGE_BACKPACK_DURATION, SALVAGE_CASH_RANGE_MIN, SALVAGE_CASH_RANGE_MAX,
    SALVAGE_XP_REWARD, SALVAGE_AMMO_RESTOCK,
    MESSAGE_DISPLAY_SECONDS, HOTZONE_VISUAL_UPDATE_RATE, UI_REFRESH_RATE,
    MINIMUM_INITIAL_PLAYERS, MAX_HUMAN_PLAYERS_PER_TEAM,
    AI_BOTS_PER_SQUAD, AI_SQUADS_COUNT, AI_TOTAL_BOTS, AI_SPAWN_HEALTH_MULTIPLIER,
    DEBUG_JSPPLAYER, DEBUG_TEAM, DEBUG_SCORE, DEBUG_CASH,
    DEBUG_HOTZONE, DEBUG_AI, DEBUG_UIS, DEBUG_CONSTRUCTION,
    DEBUG_SCAVENGE, DEBUG_SPAWNING, DEBUG_NETWORK,
};
