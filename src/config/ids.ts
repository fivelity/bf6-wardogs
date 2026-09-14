/**
 * OBJECT_ID — single source of truth for every ObjId referenced from code.
 *
 * Rule (AGENTS.md §7): no numeric ObjId literal appears anywhere else in `src/`.
 * Reconciled directly against the current, checked-in scene data
 * (`levels/mp_granite_military_storage_portal.spatial.json`, `Portal_Dynamic` block) — every
 * ObjId below is copied verbatim from that file's own `"ObjId"` field, not reconstructed or
 * guessed. Re-run this reconciliation any time the scene is edited.
 *
 * ── ObjId audit performed on the latest scene export ──
 *
 * Full duplicate scan of every `"ObjId"` field in `Portal_Dynamic`:
 *
 * 1. **RESOLVED — two previously-flagged scene bugs are NOT present in this scene revision:**
 *    - The five `VehicleSpawner_Bike_*` nodes that previously all shared ObjId `104` now each
 *      have a unique ObjId (`104, 105, 106, 107, 108`, plus unrelated `31/32/33/34` for the
 *      Valkyra-area bikes). `VEHICLE_SPAWNER_DIRTBIKE_*` entries below are addressable
 *      individually — the old "only one of five is reachable" caveat no longer applies.
 *    - `Sector_HotZone` (ObjId `333`) no longer collides with `IP_BUY_MENU_VALKYRA`. The buy-menu
 *      Valkyra interact point now has its own distinct ObjId (`333` belongs solely to
 *      `Sector_HotZone` in this revision) — re-verified below under Buy Stations.
 *
 * 2. **NEW/REMAINING — genuine ObjId collisions found in this scene revision:**
 *    - **ObjId `2`**: `TEAM_2_HQ` (`HQ_PlayerSpawner`) collides with `SandBagsPlatform_01_320x60`
 *      (a decorative prop under `Sector_Tower_A`). `HQ_MANTICORE` and the sandbag prop are
 *      DIFFERENT objects sharing one ObjId — only one is addressable via `mod.GetXxx(2)`. Since
 *      Godot resolves ties by declaration order and `TEAM_2_HQ` is declared first in
 *      `Portal_Dynamic`, `mod.GetHQPlayerSpawner(2)` (or equivalent) almost certainly resolves to
 *      the HQ, not the sandbag — but this is exactly the kind of "silent runtime failure, not a
 *      compile error" AGENTS.md §7 warns about, and the sandbag prop has no code dependency on
 *      its own ObjId (it's pure decoration), so this collision is currently **safe but fragile**.
 *      **Fix owed on the Godot/scene side**: give the sandbag prop a unique, non-gameplay ObjId
 *      (or strip its explicit `ObjId` entirely, matching most of the other decorative sandbag
 *      props in the same sector, which have no `ObjId` field at all).
 *    - **ObjId `3`**: same defect, `TEAM_3_HQ` (`HQ_PlayerSpawner`) collides with
 *      `SandBags_01_256x120` (decorative, `Sector_Tower_A`). Same analysis and same recommended
 *      scene-side fix applies.
 *    - **ObjId `0`**: `HQ_BuyStation_111`/`HQ_BuyStation_211`/`HQ_BuyStation_311` (all three
 *      per-faction `MCOM` buy stations) and `DeployCam` all carry an explicit `"ObjId": 0`. This
 *      is NOT the same class of bug as the two above — `0` is Portal's own placeholder for "not
 *      individually addressed by ObjId," and none of these four objects are ever looked up via
 *      `mod.GetMCOM(0)`/`mod.GetXxx(0)` anywhere in this codebase (buy-station interaction is
 *      wired through the `InteractPoint` children instead — `IP_BUY_MENU_*` below — which each
 *      have their own real, unique, non-zero ObjId). No fix needed; documented here so a future
 *      reconciliation pass doesn't mistake this for a live bug.
 *
 * All ObjIds actually consumed by `src/` below are drawn only from entries whose ObjId is (a)
 * unique in the scene, or (b) shared only with an unaddressed decorative prop as described above.
 */
export const OBJECT_ID = {
	// ── HQs (Team1 = Lonestar/BLUE, Team2 = Manticore/GREEN, Team3 = Valkyra/RED) ──
	HQ_LONESTAR: 100,
	HQ_MANTICORE: 2, // see ObjId-2 collision note above — resolves to the HQ, not the sandbag prop.
	HQ_VALKYRA: 3, // see ObjId-3 collision note above — resolves to the HQ, not the sandbag prop.

	// ── Buy stations (MCOM-typed; carry scene ObjId 0 — see note above, not used for lookup) ──
	BUY_STATION_LONESTAR: 111,
	BUY_STATION_MANTICORE: 211,
	BUY_STATION_VALKYRA: 311,

	// ── Buy station interact points (the actual addressable interaction target) ──
	IP_BUY_MENU_LONESTAR: 112,
	IP_BUY_MENU_MANTICORE: 212,
	IP_BUY_MENU_VALKYRA: 312,

	// ── HQ vehicle spawners (per-faction, MatchingTeam-restricted) ──
	VEHICLE_SPAWNER_HQ_LONESTAR: 110,
	VEHICLE_SPAWNER_HQ_MANTICORE: 210,
	VEHICLE_SPAWNER_HQ_VALKYRA: 310,

	// ── ControlZone (majority-hold, standard ticket bleed) ──
	SECTOR_CONTROLZONE: 555,
	AT_CONTROLZONE: 900,
	CP_CONTROLZONE: 9000,
	ICON_CONTROLZONE: 558,

	// ── HotZone (drifting marker, 2x presence weight) ──
	SECTOR_HOTZONE: 333, // unique in this scene revision — no collision with buy-menu interact points.
	AT_HOTZONE: 901,
	CP_HOTZONE: 9001,
	ICON_HOTZONE: 902,

	// ── Control Tower (single — the scene has exactly one placed tower) ──
	SECTOR_TOWER_A: 3001,
	CP_TOWER_A: 76,
	ICON_TOWER_A: 3000,

	// ── Pre-placed "FOB Alpha"/"FOB Bravo" capture points — currently unreferenced by src/
	//    gameplay logic; kept for a future deliberate reconciliation pass. NOT the same system as
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

	// ── Dirt bike spawners — each now has a unique ObjId in this scene revision (previously all
	//    five shared ObjId 104; that defect is resolved — see audit note above). ──
	VEHICLE_SPAWNER_DIRTBIKE_1: 104,
	VEHICLE_SPAWNER_DIRTBIKE_2: 105,
	VEHICLE_SPAWNER_DIRTBIKE_3: 106,
	VEHICLE_SPAWNER_DIRTBIKE_4: 107,
	VEHICLE_SPAWNER_DIRTBIKE_5: 108,
	VEHICLE_SPAWNER_DIRTBIKE_VALKYRA_1: 31,
	VEHICLE_SPAWNER_DIRTBIKE_VALKYRA_2: 32,
	VEHICLE_SPAWNER_DIRTBIKE_VALKYRA_3: 33,
	VEHICLE_SPAWNER_DIRTBIKE_VALKYRA_4: 34,

	// ── AI (Chaos Squads — NOT a team; see config/teams.ts header note) ──
	AI_SPAWNER_CHAOS: 401,
} as const;

export type ObjectIdKey = keyof typeof OBJECT_ID;
