/**
 * OBJECT_ID — single source of truth for every ObjId referenced from code.
 *
 * Rule (AGENTS.md §7): no numeric ObjId literal appears anywhere else in `src/`.
 * Reconciled directly against the real level's spatial scene data
 * (`mp_granite_military_storage_portal_spatial.json`, `Portal_Dynamic` block) — every ObjId
 * below is copied verbatim from a `Portal_Dynamic` entry's own `"ObjId"` field, not
 * reconstructed or guessed. Re-run this reconciliation any time the scene is edited.
 *
 * CORRECTIONS MADE IN THIS PASS (see WARDOGS_COMPLETION_REPORT.md addendum): the previous
 * version of this file had `CP_TOWER_A: 1001` / `CP_TOWER_B: 2001` — those are actually the
 * ObjIds of `CapturePoint_FOB_A_1` / `CapturePoint_FOB_B_1` (a pair of pre-placed "FOB
 * Alpha"/"FOB Bravo" capture points that are NOT the same thing as `game/mode/fob.ts`'s
 * freely-player-placed FOBs). The scene has exactly ONE placed tower
 * (`CapturePoint_Tower_A`, ObjId 76) — there is no Tower B. `game/mode/towers.ts` has been
 * redesigned around a single tower accordingly. `game/mode/fob.ts` keeps its existing
 * free-placement design unchanged and does not reference any OBJECT_ID entry — the pre-placed
 * FOB Alpha/Bravo capture points (`SECTOR_FOB_A`/`SECTOR_FOB_B` etc. below) are unused scene
 * dressing as far as `src/` is concerned; kept here only so a future pass can reconcile them
 * deliberately if desired.
 *
 * KNOWN SCENE BUG — flagged, not fixed here (this file can't change the scene): `Sector_HotZone`
 * (ObjId 333) collides with `IP_BUY_MENU_VALKYRA`'s `InteractPoint _BS_310` (also ObjId 333).
 * Two different Portal_Dynamic objects sharing one ObjId means only one is addressable by
 * `mod.GetSector(333)` / `mod.GetInteractPoint(333)` — this needs a unique ObjId assigned to
 * one of them in the Godot/spatial-JSON scene before Valkyra's buy menu and the HotZone sector
 * can both be reliably referenced by ID. `game/mode/hotzone.ts` currently only reads
 * `AT_HOTZONE`/`CP_HOTZONE`/`ICON_HOTZONE` (900/9001/902 respectively — none of which collide),
 * so this mod doesn't currently reference the colliding `Sector_HotZone` ObjId anywhere, but the
 * collision remains a scene defect to fix before anything needs `mod.GetSector` for the HotZone.
 *
 * KNOWN ISSUE (unchanged from previous pass): the scene has FIVE VehicleSpawner objects sharing
 * ObjId 104 (VehicleSpawner_Bike_104, _0_2, _0_3, _0_4, _0_5). Only one is addressable by
 * `mod.GetVehicleSpawner(104)` — fix in Godot (assign unique ObjIds) before any code depends on
 * the others individually.
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
	// NOTE: also collides with Sector_HotZone's ObjId — see KNOWN SCENE BUG above.
	IP_BUY_MENU_VALKYRA: 333,

	// ── HQ vehicle spawners (per-faction, MatchingTeam-restricted) ──
	VEHICLE_SPAWNER_HQ_LONESTAR: 110,
	VEHICLE_SPAWNER_HQ_MANTICORE: 220,
	VEHICLE_SPAWNER_HQ_VALKYRA: 330,

	// ── ControlZone (majority-hold, standard ticket bleed) ──
	SECTOR_CONTROLZONE: 555,
	AT_CONTROLZONE: 900,
	CP_CONTROLZONE: 9000,
	ICON_CONTROLZONE: 903,

	// ── HotZone (drifting, 2x scoring) ──
	// Sector_HotZone's own ObjId (333) is NOT listed here — see KNOWN SCENE BUG above; this file
	// only references the AreaTrigger/CapturePoint/WorldIcon ObjIds, none of which collide.
	AT_HOTZONE: 901,
	CP_HOTZONE: 9001,
	ICON_HOTZONE: 902,

	// ── Control Tower (single — see CORRECTIONS above; there is only one placed tower) ──
	SECTOR_TOWER_A: 3001,
	CP_TOWER_A: 76,
	ICON_TOWER_A: 3000,

	// ── Pre-placed "FOB Alpha"/"FOB Bravo" capture points — currently unreferenced by src/;
	//    kept for a future deliberate reconciliation pass. NOT the same system as
	//    game/mode/fob.ts's freely-player-placed FOBs. ──
	SECTOR_FOB_A: 999,
	CP_FOB_A: 1001,
	ICON_FOB_A: 1000,
	SECTOR_FOB_B: 2222,
	CP_FOB_B: 2001,
	ICON_FOB_B: 2000,

	// ── Neutral/open-map vehicle spawners ──
	VEHICLE_SPAWNER_AH64: 101,
	VEHICLE_SPAWNER_UH60: 102,
	VEHICLE_SPAWNER_ATV: 103,
	VEHICLE_SPAWNER_DIRTBIKE_PRIMARY: 104, // see KNOWN ISSUE above — duplicate ObjId in scene

	// ── AI (Chaos Squads faction) ──
	AI_SPAWNER_CHAOS: 401,
} as const;

export type ObjectIdKey = keyof typeof OBJECT_ID;
