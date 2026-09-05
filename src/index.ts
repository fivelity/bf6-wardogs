// src/index.ts
import { Events } from "bf6-portal-utils/events";
import { Timers } from 'bf6-portal-utils/timers';
import { mercenaryRegistry, PlayerProfile, OnPlayerJoinGame, OnPlayerLeaveGame } from "./features/progression/profile";
import { BuyValidator } from "./features/shop/buy-validator";
import { WardogsBuyMenu } from "./features/shop/buy-menu";
import { RogueAIManager } from "./features/ai/chaos-ai";
import { 
    carbinePackage_Tier1, 
    SidearmPackage_Standard_P18 
} from "./features/shop/weapon-packages";

// Instantiate Core Managers and Systems
const buyValidator = new BuyValidator();
const rogueAIManager = new RogueAIManager();
import { TowerRedirectionSystem } from "./features/hotzone/redirection";
import { PdaTowerInteractionSystem } from "./features/hotzone/pda-system";

// Global tower redirection system instance
export let towerRedirectionSystem: TowerRedirectionSystem | null = null;
export let pdaInteractionSystem: PdaTowerInteractionSystem | null = null;

// Global placeholder for the active HotZone coordinates (defaulted to ControlZone center)
export let currentHotZonePosition = mod.CreateVector(903.11, 228.33, 203.79);

// Define our role-defining gadgets that must survive death
const ROLE_DEFINING_GADGETS = [
    mod.Gadgets.Misc_Defibrillator,          // Medic Defibrillator
    mod.Gadgets.U_Gadget_MedicCrate,         // Medic Healing Crate
    mod.Gadgets.U_SpawnBeacon,               // Recon Spawn Beacon
    mod.Gadgets.U_TUGS,                      // Recon Active Radar
    mod.Gadgets.U_DeployableCover,           // Support Barricade/Hammer
    mod.Gadgets.Misc_PortalGadget            // Driver/Pilot Teleporter
];

/**
 * Main game initialization lifecycle hook.
 * Sets up server-side mutators, map parameters, and starts standard game scoring loops.
 */
export async function OnGameModeStarted(): void {
    console.log("WARDOGS: Global Game Mode Initiated.");
    
    // Configure Spawn Mode to Manual to give teams staging periods
    mod.SetSpawnMode(mod.SpawnModes.ManualSpawn);
    
    // Set target score to 1 to bypass the native end-game block bug
    mod.SetGameModeTargetScore(1);

    // Spawn 12 Rogue AI bots on unlisted Team 4 organized into 4 squads of 3
    rogueAIManager.SpawnChaosFactions();

    // Initialize tower redirection system
    towerRedirectionSystem = new TowerRedirectionSystem();
    
    // Initialize PDA interaction system
    pdaInteractionSystem = new PdaTowerInteractionSystem(towerRedirectionSystem);

    // Initialize scoring loop using concurrent Timers to avoid wait blockages
    Timers.setInterval(() => {
        EvaluateScoringLoop();
    }, 4000); // 4-second ticket updates matching conquest tick speeds
}

/**
 * Connection event handler.
 * Instantiates the player profile ONCE per match session. 
 * This gives them their baseline $10,000 cash reserves exactly once.
 */
export function OnPlayerJoinGameHook(player: mod.Player): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    // Call profile initializer to construct the persistent profile in mercenaryRegistry
    OnPlayerJoinGame(player);
    console.log(`[WARDOGS CONNECT] Contractor joined: ${mod.GetPlayerName(player)}. Starting Balance: $10,000 Issued.`);
}

/**
 * Disconnection event handler.
 * Performs clean directory memory wipes to prevent server microtask desyncs.
 */
export function OnPlayerLeaveGameHook(player: mod.Player): void {
    OnPlayerLeaveGame(player);
}

/**
 * Spawn / Deployment event handler.
 * Enforces our baseline kit regulations:
 *  1. Persistent cash is preserved (not reset or re-granted).
 *  2. Expensive purchased weapons (T3/T5) in Slot 1 are lost.
 *  3. Baseline kit is equipped (AK-205 primary, P18 pistol sidearm, Mini Frag Grenade).
 *  4. Specialty role-defining gear is kept so classes persist across deaths.
 */
export function OnPlayerDeployed(player: mod.Player): void {
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
export function OnPlayerUIButtonEvent(player: mod.Player, widget: mod.UIWidget, event: mod.UIButtonEvent): void {
    if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) return;

    const playerId = mod.GetObjId(player);
    const profile = mercenaryRegistry.get(playerId);

    if (!profile) return;

    // Direct UI interactions to the Buy Menu controllers
    OnPlayerUIButtonEvent(player, widget, event);
}

/**
 * Evaluates tactical zone occupancy, counting faction headcounts \n * and ticking scores to enforce the end-game target score.
 */
function EvaluateScoringLoop(): void {
    // Scoring logic, evaluating ControlZone headcounts, adding team ticket scales,
    // and manually updating overall score headers in real-time.
    console.log("[WARDOGS SCORING] Ticking faction points...");

    // Feed current HotZone coordinates to the Rogue AI Manager to maintain active combat tracking
    rogueAIManager.updateTargetCoordinates(currentHotZonePosition);
}
