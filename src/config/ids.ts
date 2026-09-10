/**
 * OBJECT_ID — single source of truth for every ObjId referenced from code.
 *
 * Rule (AGENTS.md §7): no numeric ObjId literal appears anywhere else in `src/`.
 * Verified directly against:
 * `levels/MP_Granite_MilitaryStorage/MP_Granite_MilitaryStorage_Portal-ModBuilderCustom0.spatial.json`
 * in `fivelity/wardogs` (RedlineStorage map). Re-run this reconciliation any time
 * the Godot scene is edited — a value here with no matching placed object is a
 * silent runtime failure, not a compile error.
 *
 * KNOWN ISSUE: the scene currently has FIVE VehicleSpawner objects sharing
 * ObjId 104 (VehicleSpawner_Bike_104, _0_2, _0_3, _0_4, _0_5). Only one is
 * addressable by `mod.GetVehicleSpawner(104)` — fix in Godot (assign unique
 * ObjIds) before any code depends on the others individually.
 */
export const OBJECT_ID = {
	// ── HQs (Team1 = Lonestar, Team2 = Manticore, Team3 = Valkyra) ──
	HQ_LONESTAR: 100,
	HQ_MANTICORE: 2,
	HQ_VALKYRA: 3,

	// ── Buy stations (MCOM-typed) ──
	BUY_STATION_LONESTAR: 111,
	BUY_STATION_MANTICORE: 221,
	BUY_STATION_VALKYRA: 331,

	// ── Buy station interact points ──
	IP_BUY_MENU_LONESTAR: 112,
	IP_BUY_MENU_MANTICORE: 222,
	IP_BUY_MENU_VALKYRA: 333,

	// ── HQ vehicle spawners (per-faction, MatchingTeam-restricted) ──
	VEHICLE_SPAWNER_HQ_LONESTAR: 110,
	VEHICLE_SPAWNER_HQ_MANTICORE: 220,
	VEHICLE_SPAWNER_HQ_VALKYRA: 330,

	// ── ControlZone (majority-hold, standard ticket bleed) ──
	AT_CONTROLZONE: 900,
	CP_CONTROLZONE: 9000,
	ICON_CONTROLZONE: 903,

	// ── HotZone (drifting, 2x scoring) ──
	AT_HOTZONE: 901,
	CP_HOTZONE: 9001,
	ICON_HOTZONE: 902,

	// ── Central watchtower sector (contested high ground overlooking both zones) ──
	SECTOR_TOWER: 3001,

	// ── Control Towers (outlying, capturable by any team; each grants a decryption segment
	//    toward HotZone-drift locking, per Secondary Objective 1 in the design brief) ──
	CP_TOWER_A: 1001,
	CP_TOWER_B: 2001,

	// ── Neutral/open-map vehicle spawners ──
	VEHICLE_SPAWNER_AH64: 101,
	VEHICLE_SPAWNER_UH60: 102,
	VEHICLE_SPAWNER_ATV: 103,
	VEHICLE_SPAWNER_DIRTBIKE_PRIMARY: 104, // see KNOWN ISSUE above — duplicate ObjId in scene

	// ── AI (Chaos Squads faction) ──
	AI_SPAWNER_CHAOS: 401,
} as const;

export type ObjectIdKey = keyof typeof OBJECT_ID;
