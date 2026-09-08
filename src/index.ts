// src/index.ts
import { Events } from "./shared/portal-utils/events";
import { mercenaryRegistry, initializePlayerProfile, removePlayerProfile } from "./features/progression/profile";
import { WardogsBuyMenu } from "./features/shop/buy-menu";
import { RogueAIManager } from "./features/ai/chaos-ai";
import { excavationManager } from "./features/construction/excavation";
import { pdaScanner } from "./features/construction/pda-scanner";
import { FobLogisticsManager } from "./features/construction/fob-stockpile";
import { 
    carbinePackage_Tier1, 
    SidearmPackage_Standard_P18 
} from "./features/shop/weapon-packages";

const rogueAIManager = new RogueAIManager();
const fobLogisticsManager = new FobLogisticsManager();
import { TowerRedirectionSystem } from "./features/hotzone/redirection";
import { PdaTowerInteractionSystem } from "./features/hotzone/pda-system";
import { HotZoneManager } from "./features/hotzone/zone-state";
import { scoreboardManager } from "./features/interface/scoreboard";
import { WARDOGSActiveHUD } from "./features/interface/reactive-hud";
import { HotZoneAntiCampingSystem } from "./features/hotzone/mortar-strike";
import { VehicleWreckSalvageSystem } from "./features/construction/salvage";
import { HQLogisticsTerminalSystem } from "./features/construction/hq-terminal";
import { TeamSwitcherSystem } from "./features/progression/team-switcher";
import { ScavengerDropSystem } from "./features/scavenger/scavenger-drop";

const towerRedirectionSystem = new TowerRedirectionSystem();
const hotZoneManager = new HotZoneManager(towerRedirectionSystem);
const pdaInteractionSystem = new PdaTowerInteractionSystem(towerRedirectionSystem);
const antiCampingSystem = new HotZoneAntiCampingSystem(
    () => hotZoneManager.getHotZonePresence(),
    () => hotZoneManager.getActiveHotZonePoint(),
);
const salvageSystem = new VehicleWreckSalvageSystem((sectorId, amount) => {
    fobLogisticsManager.addMaterials(sectorId, amount);
});
const hqLogisticsSystem = new HQLogisticsTerminalSystem();
const teamSwitcherSystem = new TeamSwitcherSystem();
const scavengerDropSystem = new ScavengerDropSystem();
const activeHuds = new Map<number, WARDOGSActiveHUD>();
const buyMenus = new Map<number, WardogsBuyMenu>();

// Global placeholder for the active HotZone coordinates (defaulted to ControlZone center)
// Define our role-defining gadgets that must survive death
const ROLE_DEFINING_GADGETS = [
    mod.Gadgets.Misc_Defibrillator,          // Medic Defibrillator
    mod.Gadgets.Class_Supply_Bag,         // Medic Healing Crate
    mod.Gadgets.Deployable_Deploy_Beacon,               // Recon Spawn Beacon
    mod.Gadgets.CallIn_UAV_Overwatch,                      // Recon Active Radar
    mod.Gadgets.Deployable_Cover,           // Support Barricade/Hammer
    mod.Gadgets.Misc_PortalGadget            // Driver/Pilot Teleporter
];

/**
 * Main game initialization lifecycle hook.
 * Sets up server-side mutators, map parameters, and starts standard game scoring loops.
 */
function onGameModeStarted(): void {
    console.log("WARDOGS: Global Game Mode Initiated.");
    
    // Configure Spawn Mode to Manual to give teams staging periods
    mod.SetSpawnMode(mod.SpawnModes.Deploy);
    
    // Set target score to 1 to bypass the native end-game block bug
    mod.SetGameModeTargetScore(1);

    // Spawn 12 Rogue AI bots on unlisted Team 4 organized into 4 squads of 3
    rogueAIManager.SpawnChaosFactions();

    // Bind excavation to the live FOB stockpile and activate the support build tools.
    excavationManager.setMaterialStockpile(fobLogisticsManager);
}

/**
 * Connection event handler.
 * Instantiates the player profile ONCE per match session. 
 * This gives them their baseline $10,000 cash reserves exactly once.
 */
function onPlayerJoinGame(player: mod.Player): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    // Call profile initializer to construct the persistent profile in mercenaryRegistry
    initializePlayerProfile(player);
    buyMenus.set(mod.GetObjId(player), new WardogsBuyMenu(player));
    activeHuds.set(mod.GetObjId(player), new WARDOGSActiveHUD(player));
    console.log(`[WARDOGS CONNECT] Contractor ${mod.GetObjId(player)} joined. Starting Balance: $10,000 Issued.`);
}

/**
 * Disconnection event handler.
 * Performs clean directory memory wipes to prevent server microtask desyncs.
 */
function onPlayerLeaveGame(playerId: number): void {
    const hud = activeHuds.get(playerId);
    if (hud) hud.destroy();
    activeHuds.delete(playerId);
    buyMenus.delete(playerId);
    removePlayerProfile(playerId);
}

/**
 * Spawn / Deployment event handler.
 * Enforces our baseline kit regulations:
 *  1. Persistent cash is preserved (not reset or re-granted).
 *  2. Expensive purchased weapons (T3/T5) in Slot 1 are lost.
 *  3. Baseline kit is equipped (AK-205 primary, P18 pistol sidearm, Mini Frag Grenade).
 *  4. Specialty role-defining gear is kept so classes persist across deaths.
 */
function onPlayerDeployed(player: mod.Player): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    const playerId = mod.GetObjId(player);
    const profile = mercenaryRegistry.get(playerId);

    if (!profile) {
        console.log(`[WARDOGS SPAWN] Critical: Profile missing for Player: ${playerId}`);
        return;
    }

    console.log(`[WARDOGS SPAWN] Respawning Contractor: ${profile.name}. Cash Reserves: $${profile.getCash()}`);

    // --- ENFORCE DEATH KIT PENALTY (Baseline Gear Swap) ---
    
    // 1. Strip and replace Primary Weapon Slot (Expensive weapons are lost!)
    mod.RemoveEquipment(player, mod.InventorySlots.PrimaryWeapon);
    mod.AddEquipment(player, mod.Weapons.Carbine_AK_205, carbinePackage_Tier1);

    // 2. Reset Sidearm Slot to baseline P18 Select Fire
    mod.RemoveEquipment(player, mod.InventorySlots.SecondaryWeapon);
    mod.AddEquipment(player, mod.Weapons.Sidearm_P18, SidearmPackage_Standard_P18);

    // 3. Evaluate and preserve Role-Defining Specialty Gadgets
    let hasRoleGadget = false;
    for (const gadget of ROLE_DEFINING_GADGETS) {
        if (mod.HasEquipment(player, gadget)) {
            hasRoleGadget = true;
            break; // Keep their specialty!
        }
    }

    if (!hasRoleGadget) {
        // If they possess no specialty gear, give them a baseline Mini Frag Grenade
        mod.RemoveEquipment(player, mod.InventorySlots.GadgetOne);
        mod.AddEquipment(player, mod.Gadgets.Throwable_Mini_Frag_Grenade);
        console.log(`[WARDOGS SPAWN] Standard Baseline Kit Issued to: ${profile.name}`);
    } else {
        console.log(`[WARDOGS SPAWN] Specialty Role-Defining Gadget preserved for: ${profile.name}`);
    }
}

/**
 * Screen interaction event handler.
 * Translates ParseUI clicks and focuses directly to active Buy Menu tab refreshes.
 */
function onPlayerUIButtonEvent(player: mod.Player, widget: mod.UIWidget, event: mod.UIButtonEvent): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    const playerId = mod.GetObjId(player);
    const profile = mercenaryRegistry.get(playerId);

    if (!profile) return;

    // Direct UI interactions to the Buy Menu controllers
    WardogsBuyMenu.OnPlayerUIButtonEvent(player, widget, event);
}

Events.OnGameModeStarted.subscribe(onGameModeStarted);
Events.OnPlayerJoinGame.subscribe(onPlayerJoinGame);
Events.OnPlayerLeaveGame.subscribe(onPlayerLeaveGame);
Events.OnPlayerDeployed.subscribe(onPlayerDeployed);
Events.OnPlayerUIButtonEvent.subscribe(onPlayerUIButtonEvent);
Events.OnGameModeEnding.subscribe(() => {
    hotZoneManager.shutdown();
    towerRedirectionSystem.shutdown();
    pdaInteractionSystem.shutdown();
    pdaScanner.shutdown();
    excavationManager.shutdown();
    salvageSystem.shutdown();
    antiCampingSystem.shutdown();
    scavengerDropSystem.shutdown();
    rogueAIManager.shutdown();
    void scoreboardManager;
    void hqLogisticsSystem;
    void teamSwitcherSystem;
});
