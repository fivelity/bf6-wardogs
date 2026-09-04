### Game Mode Brief: WARDOGS
**Quick Summary:** Gritty, high-stakes three-faction PMC King-of-the-Hill experience featuring a mathematically drifting "HotZone" multiplier, persistent server-side wallets, modular weapon assembly, and cooperative sandbag-excavation base building.

---

#### 📋 Basic Information
**Game Mode Name:** WARDOGS  
**Version:** 1.0.0  
**Author:** WARDOGS Development Team (fivelity, SECRET, MadSquirts, SackHurts)  
**Last Updated:** September 4, 2026  
**Development Status:**
* [ ] Planning
* [/] In Development (Phase 1 Base Engine & Core Economy Completed; Phase 2 Dynamic Drift & AI Commenced)
* [x] Testing (Logical units validated inside compiler)
* [ ] Complete

---

#### 🎮 Game Description
##### Overview
WARDOGS is a hardcore, asymmetrical tactical skirmish taking place on a 2x2km sector of **MP_Granite_MilitaryStorage**. The game mode challenges three distinct human Private Military Corporations (PMCs) to secure a central tactical sector. To prevent passive defensive stagnation and camping, a double-scoring **"HotZone"** continuously drifts along randomized vectors inside the primary polygon boundaries, forcing teams to constantly relocate, defend, and adjust their defensive positioning.

The core gameplay centers around a strict, punishing **Match Economy**. Players must manage their cash reserves carefully; deploying with high-tier custom firearms carries massive meta-risk, as expensive primary weapons are permanently lost upon a full undeploy. To succeed, squads must cooperate to construct physical barricades, deploy tactical respawn nodes, ferry logistics supply crates, and pool cash to unlock stationary heavy weapon platforms at their Forward Operating Bases (F.O.Bs).

##### Core Gameplay Loop
1. **Staging & Buy Phase**: Players spawn inside their highly protected Faction HQs, locked for 60 seconds at match start. Operatives interact with the MCOM Buy Station terminals to manage their wallets, purchase progression-locked armor, or custom-assemble firearms at the gunsmith.
2. **Incursion & Recon**: Squads deploy into the battlefield using logistics trucks, light ATVs, or air insertions. Reaching the active Control Zone begins points ticking.
3. **HotZone Contestation**: Contractors fight to hold the shifting 60-meter circular HotZone. Operatives inside the HotZone count as double presence for capture weight, ticking match points and cash flow at twice the standard speed.
4. **F.O.B Construction & Defense**: Support players utilize Sledgehammers or Build Tools to physically hit buried Godot construction sockets, spending local materials to slide Sandbags, HESCO barriers, or Stationary AA platforms up through the dirt.
5. **Combat Elimination & Salvage**: Eliminated contractors drop their purchased primaries. Returning to the deploy screen drops a physical "Salvage Pack" containing their ammunition and loose cash, which can be secured by running operatives.
6. **Ticket Bleed & Extraction**: Falling without a Medic revive triggers a ticket bleed, bringing their team closer to defeat. The first faction to accumulate 100 victory tickets secures the contract and wins.

##### Game Mode Type
* [x] Team-based (3 Human Factions)
* [ ] Free-for-all
* [x] Cooperative (FOB pooled funding & building)
* [x] Competitive (High-stakes tactical economy)
* [x] Objective-based (Drifting HotZone control)
* [ ] Elimination
* [ ] Race/Time Trial
* [ ] Other: 

---

#### 👥 Players & Teams
##### Player Count
* **Minimum Players:** 6 (2 per human team)
* **Maximum Players:** 36 Human Players (12 per team) + 12 Programmatic Bots (4 squads of 3)
* **Recommended:** 36 Human Players

##### Team Configuration
* **Number of Teams:** 4 (3 Human competing PMC teams + 1 unlisted, programmatically spawned AI Faction)
* **Team 1: Lonestar (Cyan)** - Gritty, survival-focused American private contractors. Operates out of the North-West HQ. 
* **Team 2: Manticore (Orange)** - Highly disciplined, state-sponsored Persian "shadow army" specialists. Operates out of the South-East HQ.
* **Team 3: Valkyra (Silver/White)** - Strategic, heavy-armor-focused Eastern restorationist forces. Operates out of the South-West HQ.
* **Team 4: Chaos Squads (Unlisted, Red/Black)** - Unjoinable, unlisted environmental AI forces. Spawns programmatically as 12 bots (4 squads of 3) to patrol, harass, and apply continuous pressure on any team camping the central objective. They do not earn points or participate in the match economy.

##### Team Balance
* [ ] Auto-balance enabled
* [x] Fixed team sizes (Strictly capped at 12 players per team)
* [ ] Dynamic team assignment
* [x] Player choice (Interactive mannequin terminals at HQ allow limited team-swaps with balance safety margins)
* [ ] Other: 

---

#### 🎯 Objectives & Rules
##### Primary Objective
Secure the central objective sector and accumulate **100 Victory Tickets** before opposing PMCs. Tickets are ticked through majority presence within the Control Zone, heavily accelerated by holding the drifting HotZone.

##### Secondary Objectives
1. **Secure Concentric Towers**: Capture outlying tactical radio towers to upload localized "decryption segments." Once fully decoded, Support players can lock the HotZone's drift vector directly onto their pre-fortified tower position.
2. **HQ Logistics Delivery**: Secure transport trucks or cargo helicopters from spawning pads, load heavy Supply Crates at HQ terminals, and deliver them to active FOB stockpiles to earn massive cash payoffs and construct fortified defenses.
3. **Terminate Rogue AI Elements**: Neutralize incoming Chaos Squad bots inside the HotZone to protect active capture units and secure contested ground.

##### Core Rules
1. **Strict Match Wallets**: Every human player is issued exactly **$10,000 Starting Cash** once upon initially connecting to the server. Cash does not reset, multiply, or wipe upon redeployments.
2. **Death Kit Penalty**: When an operative dies or manually redeploys, their custom-purchased Slot 1 primary weapon package is wiped. 
3. **Role Specialty Preservation**: Specialized class-defining equipment (Medic Defibrillator, Medic Healing Crate, Spawn Beacon, TUGS, Sledgehammers, and Portal Gadget PDAs) **safely bypasses the death kit wipe**. Players respawn with their specialty class intact, but carrying baseline armaments (AK-205 Primary, P18 Sidearm, Mini Frag Grenade).
4. **Pro-Rated Shop Surcharges**: Items purchased from other progression tracks incur a dynamic penalty of up to **2.0 (200% markup)** if the player's track level is deficient, scaling down to baseline pricing once mastery Tiers are unlocked.
5. **No Native Revive Loop exploits**: Due to equipment array limits, native Portal revives are blocked. Teamplay is preserved via Medic defibrillator actions granting instant cash, while eliminated soldiers drop tactical **Salvage Packs** on absolute undeployment.

##### Gameplay Phases
###### Phase 1: Preparation & Base Selection (Staging)
* **Duration:** 60 Seconds (At Match Start)
* **Description:** Spawn points are locked inside HQs. Factions organize their starting squads and access Buy Stations to purchase initial kits, specialized role gadgets, and custom gunsmith weapon attachments.
* **Player Actions:** Open Shop UI, purchase class equipment, custom-configure primary weapon attachments, and spawn starting logistics vehicles.

###### Phase 2: Tactical Incursion & FOB Setup
* **Duration:** Dynamic (Until first team reaches 100 points)
* **Description:** Staging barriers drop. Teams advance on the central objective and capture concentric outposts, setting up primary FOB logistics lines and depositing materials to build initial sandbag defenses.
* **Player Actions:** Drive logistics vehicles, capture outlying Towers, transport heavy Supply Crates, deploy Spawn Beacons, and construct basic fortifications.

###### Phase 3: Shifting Contestation (Endgame)
* **Duration:** Dynamic (Triggered when any team crosses 75 victory tickets)
* **Description:** HotZone movement speed increases by 50%, and Chaos AI squads spawn rate accelerates. The battle condenses into intense close-quarters holds around the drifting objective flagpole.
* **Player Actions:** Defend fortified sectors, execute tactical HotZone redirection commands, hold out against swarming AI, and deplete remaining enemy tickets.

---

#### 🏆 Win Conditions
##### Victory Conditions
* [x] **Score-based:** First team to accumulate **100 Victory Tickets** wins the match.
* [ ] **Time-based:** Highest score when time expires.
* [ ] **Objective-based:** Complete all objectives first.
* [ ] **Elimination:** Last team standing wins.
* [ ] **Other:** (Portal Workaround: Server configuration forces a target score of `1`. The moment a team reaches 100 tickets, `mod.EndGameMode` is programmatically triggered to bypass end-game lobby block bugs).

##### Point System
| Action | Points / Tickets Awarded |
| ------ | ------ |
| **Control Zone Majority Hold** | +1 Point to Team per 4.0-second tick |
| **HotZone Multiplier Hold** | Counts as 2x player presence weight towards majority hold |
| **Contractor Eliminates (Kills)** | +$500 Cash, +150 Active Track XP |
| **Tactical Field Revive** | +$300 Cash to Medic, +200 Medic Track XP |
| **Logistics Cargo Delivery** | +$800 Cash to Transporter, +300 Driver/Pilot XP, +500 FOB Materials |
| **Shovel/Sledgehammer Build Hit** | +$100 Cash to Builder, +120 Support Track XP, +5% Construction Progress |
| **Undeployment (Bleed Penalty)** | -1 Ticket from the dead player's Faction |

##### Match Duration
* **Time Limit:** 30 Minutes
* **Round Duration:** Single Round
* **Number of Rounds:** 1

##### Tiebreaker Rules
If two teams hit the victory limit simultaneously, the faction with the highest cumulative cash wallet across all active squad profiles is declared the winning PMC contractor.

---

#### 💀 Death & Respawning
##### Death Conditions
* [x] Combat death (Primary source of loot drops and ticket bleed)
* [x] Environmental hazards
* [x] Out of bounds (Triggers instant undeploy with zero Salvage Pack generation)
* [ ] Time limit
* [ ] Other: 

##### Respawn System
* **Respawn Mode:** Manual spawn (Allows players to wait for a Medic defibrillator revive or manually choose to deploy from an active spawn beacon).
* **Respawn Delay:** 10 Seconds standard delay before deployment becomes available on the tactical map screen.
* **Respawn Location:** HQ Spawner nodes (`ObjIds 100, 2, 3`), captured outposts, or active squad-placed Spawn Beacons.
* **Respawn Restrictions:** Spawning on squad members is disabled; tactical progress relies entirely on logistics vehicles, transport helicopters, or securing forward Spawn Beacons.

##### Death Penalties
* [x] Ticket loss: -1 Team Ticket subtracted upon absolute undeployment (bypassing revive state).
* [x] Equipment loss: Permanent loss of custom-assembled high-tier primary weapons (Slot 1).
* [ ] Respawn delay
* [ ] Team penalty
* [ ] None

---

#### 🔫 Combat & Equipment
##### Weapon Restrictions
* [ ] All weapons allowed
* [x] Limited weapon types: Handguns, Carbines, and Assault Rifles are accessible. Heavy Sniper Rifles and specialized Rocket Launchers are strictly progression-locked behind high mastery tiers.
* [x] Custom loadout system: Gunsmith Subdomain allows compiling dynamic attachments onto native weapon enums.
* [x] Weapon unlocks/progression: Progressing through mastery XP tracks unlocks baseline weapons and elite accessories.

##### Default Spawn Loadout
* **Primary Weapon:** Carbine_AK-205 (Baseline Tier 1 Package: Iron Sights, 20rnd Mag)
* **Secondary Weapon:** Sidearm_P18 Select Fire (Baseline Standard Package)
* **Gadget 1:** Determined by Active Specialty Role (Medic Defibrillator, Medic Crate, Spawn Beacon, TUGS, Shovel/Build Tool, Sledgehammer, or Portal Gadget PDA)
* **Gadget 2:** Slot empty (Must be purchased at Buy Stations)
* **Throwable:** Mini Frag Grenade (If no specialty gadget is equipped)

##### Equipment System
* [ ] Fixed loadouts
* [ ] Loadout selection
* [ ] In-game pickups
* [x] Purchase system: Advanced weapons, attachments, armor, and pooled defenses must be bought at Buy Stations.
* [x] Other: **Salvage Pack Drops** allow looting cash and restocking rifle ammo directly from fallen soldiers.

---

#### 🗺️ Map & Environment
##### Supported Maps
1. **MP_Granite_MilitaryStorage** (2x2km core tactical zone)

##### Key Locations
* **North-West HQ (Lonestar Faction Hub):** Coordinate Center `x: 414.67, y: 151.46, z: 81.49`. Houses Faction 1 player spawner and MCOM buy station `ObjId 111`.
* **South-East HQ (Manticore Faction Hub):** Coordinate Center `x: 822.82, y: 143.76, z: 714.70`. Houses Faction 2 player spawner and MCOM buy station `ObjId 221`.
* **South-West HQ (Valkyra Faction Hub):** Coordinate Center `x: 285.91, y: 128.14, z: 513.31`. Houses Faction 3 player spawner and MCOM buy station `ObjId 221`.
* **Central Control Zone (Encounter Core):** Centered within the polygon trigger volume `AreaTrigger_ControlZone_1_1` at `x: 903.11, y: 228.33, z: 203.79` (`ObjId 900`).

##### Environmental Hazards
* **Chaos Faction Air Patrols:** Armed AI attack helicopters patrol outer map boundaries, targeting players who stray out-of-bounds.
* **Mortar Barrages:** Contesting the HotZone for extended durations triggers periodic tactical artillery shells to deter static defensive camping.

##### Interactive Objects
* **Capture Point Towers (ObjId 1001):** outlying interactive capture poles that grant team cash and decryption codes on hold.
* **FOB Buy Station Consoles (ObjIds 111, 221, 331):** MCOM terminal nodes situated inside captured outposts that allow players to purchase weapons and deposit pooled cash for heavy defenses.
* **Logistics Cargo Terminals:** Spawn terminals at HQ that allow loading physical Cargo Boxes onto logistics trucks.

---

#### 📊 Player Variables & Stats
##### Tracked Statistics
* [x] **Score:** Tracked as Faction Tickets (0 - 100) managed programmatically to bypass native score bugs.
* [x] **Kills (Terminates):** Increments on enemy player defeats. Adds +$500 Cash.
* [x] **Deaths (Casualties):** Tracks player deaths. Wipes primary weapons and deducts team tickets.
* [x] **Assists:** Spots, radar designations, and tactical target designations.
* [x] **Objectives (FOB Build Hits):** Tracks the number of shovel/sledgehammer hits recorded on unbuilt or damaged construction sockets.

##### Player State Variables
| Variable | Type | Purpose |
| ------ | ------ | ------ |
| `currentCash` | number | Tracks player's persistent matching transactional wallet balance. |
| `tracks` | record | Stores XP and Level (1-5) across the six progression tracks (Assault, Medic, etc.) |
| `insideControl` | boolean | Tracks if the player's collision shape is inside the outer ControlZone polygon. |
| `insideHot` | boolean | Tracks if the player is occupying the 60-meter circular drifting HotZone. |

##### Persistent Data
* [ ] Cross-match statistics
* [x] Unlocks/progression: Active level progress across the six mastery tracks persists throughout the match.
* [ ] Achievements
* [ ] None

---

#### 🖥️ UI Elements
##### Lobby/Pre-Game UI
* [x] Player count display (Monitors queue sizes across all three PMC factions)
* [x] Countdown timer (Ticks down the 60-second staging period)
* [x] Game rules/instructions (Displays "PMC CONTRACT ENGAGED: Capture Outposts, Secure Cash")
* [x] Team roster

##### In-Game HUD
* [x] **Reactive Score Display:** Renders Cyan vs. Orange vs. Silver tickets at the top-screen using performance-optimized SolidUI progress bars.
* [x] **Wallet Display:** Fades in a green `+$X` cash flash in the top-right corner on transaction events.
* [x] **Active Track Progress:** Displays progress bars indicating current Mastery Track Level and XP (e.g. `[Support Tier 3: 3,450 / 5,000 XP]`).
* [x] **Construction Sockets Overlays:** Displays unbuilt ghost markers and text indicators above buried assets: `"Watchtower Socket\nHold [E] to build: 0% / 100% [Materials Needed: 500]"`

##### Messages & Notifications
| Event | Message/Notification |
| ------ | ------ |
| **Match Staging Start** | `"PMC LOCKDOWN: Assemble Loadouts. Staging Drops in 60s."` |
| **Contractor Kill** | `"+$500 (Combat Termination)"` |
| **Defibrillator Revive** | `"+$300 (Teammate Restabilized)"` |
| **Materials Deposited** | `"+500 Materials (FOB Stockpile updated)"` |
| **HotZone Redirection** | `"TOWER LINK ESTABLISHED: HotZone drifting toward Fortified Outpost!"` |
| **Victory** | `"CONTRACT SECURED: Faction has captured the Military Storage sector!"` |

##### End Game UI
* [x] Final scores and ticket metrics.
* [x] Winner PMC announcement.
* [x] Individual statistics (Top PMC Contractor, Most FOB Constructions, Top Healer).

---

#### 🎨 Visual & Audio Design
##### Visual Effects
* **Holographic Scan Ring:** Spawns a spark-loop particle effect (`Modbuilder_FX_Gadget_Sabotage_02_SparkLoop`) on the ground when aiming with the Portal Gadget PDA to outline the target coordinates.
* **FOB Dust Explode:** Emits heavy construction smoke and sparks when a pre-placed buried asset slides upward to 100% surface alignment.
* **Rank Up Spark:** Triggers a defibrillator spark VFX directly in front of the player's eye coordinates upon level-ups.

##### Sound Effects
* **Metal Thud Construct Click:** Plays the heavy metallic hammer sound (`"SFX_Sledge_Weld_Hit"`) on successful Sledgehammer strikes.
* **Error Alarm Beep:** Plays a cockpit error alarm (`"SFX_Cockpit_Error_Alarm"`) when trying to purchase out-of-tier weapons without sufficient cash.
* **Rank Up Foley:** Plays a digital lock-on click (`"SFX_Search_Core_Kit"`) when a progression track advances.

##### World Icons
* **Salvage Pack (Cross Image):** Green medical/supplies cross hovering 0.8m above dropped packs labeled `"SALVAGE PACK"`.
* **HotZone Multiplier (Danger Ping):** Floating red danger ping above the mobile flag pole labeled `"HOTZONE [2X POINTS]"`.
* **Construction Socket (Wrench Image):** Yellow wrench icon hovering above unbuilt sockets showing required materials.

---

#### 🔧 Technical Requirements
##### Required Game Objects
| Object Type | Object ID | Purpose |
| ------ | ------ | ------ |
| **HQ_PlayerSpawner (Lonestar)** | 100 | NW Spawn point and base boundary volume |
| **HQ_PlayerSpawner (Manticore)** | 2 | SE Spawn point and base boundary volume |
| **HQ_PlayerSpawner (Valkyra)** | 3 | SW Spawn point and base boundary volume |
| **AreaTrigger_ControlZone** | 900 | Main polygonal outer capture boundary volume |
| **AreaTrigger_HotZone** | 901 | Circular mobile trigger container for double multipliers |
| **CapturePoint_ControlZone** | 9000 | Static conquest flag pole at the center |
| **CapturePoint_HotZone** | 9001 | Moving flag pole that shifts via `MoveObjectOverTime` |
| **AI_Spawner (Chaos Squads)** | 401 | Central spawner node that programmatically seeds Team 4 bots |
| **FOB Tower Sector** | 3001 | Sector node container mapping outpost fortifications |

##### Performance Considerations
* **Expected Player Count:** 36 human players + 12 programmatic bots.
* **Update Frequency Requirements:** 1-second (1Hz) throttled timer loops for HUD syncs and expiration checks; 100ms (10Hz) timers for physical sledgehammer hit evaluations; and a 200ms (5Hz) loop for Portal Gadget PDA raycast scanning to keep server performance high.
* **UI Complexity Level:** Heavy use of declarative hierarchical interfaces (`ParseUI`), completely optimized via SolidUI's fine-grained reactive signals to eliminate per-tick UI rendering lag.
* **Known Limitations:** The physics engine does not allow real-time mesh alpha modifications or dynamic collision toggles on spawned props; this is bypassed by burying pre-placed Godot nodes deep inside the terrain and programmatically sliding them up on construction success.

---

#### 🚧 Known Issues & Limitations
##### Current Limitations
1. **The Ragdoll Limbo Bug**: Dead players occasionally fail to trigger native undeploy callbacks if they are not revived. Bypassed by subscribing to `Events.OnPlayerUndeploy` to spawn Salvage Packs *only* when the soldier returns to the deploy screen.
2. **Stationary Emplacement movement**: Stationary weapons (AA/TOW) cannot slide through terrain because they are logical spawners. Resolved via a two-phase spawn: the player sledgehammers and raises the physical concrete weapons pit, which natively triggers the emplacement spawner once at 100% surface height.
3. **No native 3-faction scoreboard support**: Battlefield's native overlays only support 2 teams. Bypassed entirely by building a custom fullscreen overlay with SolidUI, parented to the client HUD.

##### Planned Features (Phase 3 Integration)
1. **Dynamic Vehicle Deconstruction**: Allowing Support players to salvage scrap metal directly from blown-up vehicle husks to replenish FOB material stockpiles.
2. **Tactical Air Drops**: Letting pilot roles call in heavy, physical logistics crates from transport helicopters directly onto smoke-designated target points.

---

#### 📝 Development Notes
##### Design Philosophy
WARDOGS strives to merge the high-stakes, tactical decision-making of hardcore military-simulation games (like *Squad* and *Project Reality*) with the accessible, fast-paced vehicle and infantry sandboxes of the Battlefield franchise. By separating transactional cash (match utility) from permanent XP progression (mastery limits), the mod creates a rewarding, strategic battle of attrition where team coordination and logistical supply lines are the primary vectors of victory.

##### Inspiration
* *Project Reality* (Cooperative logistics, base construction, and class structures)
* *Squad* (Melee shovel building, FOB fortification, and teamplay-centric spawning)
* *Escape from Tarkov* (Gunsmith customization, wallet progression, and high-risk equipment loss)

---

#### 📚 Additional Resources
##### Related Documentation
* **WARDOGS Master Blueprint Outline (v2):** `wardogs-master-outline-v2.md`
* **WARDOGS Core Mechanics Specification:** `wardogs-core-mechanics-spec.md`
* **WARDOGS Phase 1 Build Specification & Gunsmith:** `WARDOGS Mod Phase 1 Build Specification & Gunsmith Architecture`
* **BF6 Portal SDK Typed Definitions:** `index.d.ts.txt`
* **BF6 Portal Utilities Package:** `deluca-mike/bf6-portal-utils`

---

#### 📞 Contact & Support
**Developer Contact:** WARDOGS Dev Team (BF6 Modding Guild Discord)  
**Last Updated:** September 4, 2026  
**Version:** 1.0.0  

---
