// src/features/shop/weapon-packages.ts

import { mercenaryRegistry } from "../progression/profile";

/**
 * WARDOGS ADVANCED GUNSMITH & WEAPON PACKAGES SYSTEM
 * 
 * This module manages the dynamic customization of weaponry using programmatic 
 * weapon packages. Players can customize their firearms by buying and equipping
 * specific attachments at Buy Stations, which are then compiled on demand at spawn or purchase.
 */

// Strongly typed attachment slot keys
export type AttachmentSlot = "optic" | "magazine" | "muzzle" | "underbarrel" | "barrel" | "ammunition";

// Attachment definition metadata
export interface AttachmentMetadata {
    id: string;
    name: string;
    cost: number;
    requiredTrack: "Assault" | "Medic" | "Recon" | "Support" | "Driver" | "Pilot";
    requiredTier: number;
    slot: AttachmentSlot;
    sdkEnum: any; // Raw mod.WeaponAttachments enum value
}

// Player weapon attachment configurations
export interface PlayerWeaponCustomization {
    optic: string;       // ID of equipped optic
    magazine: string;    // ID of equipped magazine
    muzzle: string;      // ID of equipped muzzle device
    underbarrel: string; // ID of equipped underbarrel grip/rail
    barrel: string;      // ID of equipped barrel type
    ammunition: string;  // ID of equipped ammo type
}

// Core weapons available to contractors
export interface WeaponSpec {
    assetId: any; // Raw mod.Weapons enum value
    name: string;
    allowedSlots: AttachmentSlot[];
    defaultCustomization: PlayerWeaponCustomization;
}

// ==========================================
// 1. GLOBAL ATTACHMENT REGISTRY
// ==========================================
export const ATTACHMENT_REGISTRY: Record<string, AttachmentMetadata> = {
    // --- OPTICS (SCOPES) ---
    "iron_sights": {
        id: "iron_sights",
        name: "Iron Sights",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "optic",
        sdkEnum: mod.WeaponAttachments.Scope_Iron_Sights
    },
    "optic_1p87": {
        id: "optic_1p87",
        name: "1P87 1.5x Reflex",
        cost: 350,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "optic",
        sdkEnum: mod.WeaponAttachments.Scope_1p87_150x
    },
    "optic_r4t": {
        id: "optic_r4t",
        name: "R4T 2.0x Reflex Scope",
        cost: 500,
        requiredTrack: "Assault",
        requiredTier: 2,
        slot: "optic",
        sdkEnum: mod.WeaponAttachments.Scope_R4T_200x
    },
    "optic_bravo": {
        id: "optic_bravo",
        name: "Bravo4 4.0x Magnifier",
        cost: 800,
        requiredTrack: "Recon",
        requiredTier: 3,
        slot: "optic",
        sdkEnum: mod.WeaponAttachments.Scope_PVQ_31_400x
    },
    "optic_m11": {
        id: "optic_m11",
        name: "M11 8.0x High Power Sniper Optics",
        cost: 1200,
        requiredTrack: "Recon",
        requiredTier: 4,
        slot: "optic",
        sdkEnum: mod.WeaponAttachments.Scope_LERT_800x
    },

    // --- MAGAZINES ---
    "mag_20rnd": {
        id: "mag_20rnd",
        name: "20-Round Tactical Compact Mag",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "magazine",
        sdkEnum: mod.WeaponAttachments.Magazine_20rnd_Magazine
    },
    "mag_30rnd": {
        id: "mag_30rnd",
        name: "30-Round Standard Issue Mag",
        cost: 200,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "magazine",
        sdkEnum: mod.WeaponAttachments.Magazine_30rnd_Magazine
    },
    "mag_30rnd_fast": {
        id: "mag_30rnd_fast",
        name: "30-Round Fast Pull Mag",
        cost: 450,
        requiredTrack: "Assault",
        requiredTier: 2,
        slot: "magazine",
        sdkEnum: mod.WeaponAttachments.Magazine_30rnd_Fast_Mag
    },
    "mag_40rnd_fast": {
        id: "mag_40rnd_fast",
        name: "40-Round High-Cap Fast Pull",
        cost: 800,
        requiredTrack: "Assault",
        requiredTier: 4,
        slot: "magazine",
        sdkEnum: mod.WeaponAttachments.Magazine_40rnd_Fast_Mag
    },
    "mag_17rnd": {
        id: "mag_17rnd",
        name: "17-Round Pistol Mag",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "magazine",
        sdkEnum: mod.WeaponAttachments.Magazine_17rnd_Magazine
    },

    // --- MUZZLES ---
    "muzzle_compensator": {
        id: "muzzle_compensator",
        name: "Compensated Muzzle Brake",
        cost: 400,
        requiredTrack: "Assault",
        requiredTier: 2,
        slot: "muzzle",
        sdkEnum: mod.WeaponAttachments.Muzzle_Compensated_Brake
    },
    "muzzle_flash_hider": {
        id: "muzzle_flash_hider",
        name: "Tactical Flash Hider",
        cost: 300,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "muzzle",
        sdkEnum: mod.WeaponAttachments.Muzzle_Flash_Hider
    },
    "muzzle_suppressor_std": {
        id: "muzzle_suppressor_std",
        name: "Standard Sound Suppressor",
        cost: 700,
        requiredTrack: "Assault",
        requiredTier: 3,
        slot: "muzzle",
        sdkEnum: mod.WeaponAttachments.Muzzle_Standard_Suppressor
    },
    "muzzle_suppressor_titanium": {
        id: "muzzle_suppressor_titanium",
        name: "Titanium Sub-Acoustic Suppressor",
        cost: 1000,
        requiredTrack: "Assault",
        requiredTier: 4,
        slot: "muzzle",
        sdkEnum: mod.WeaponAttachments.Muzzle_Lightened_Suppressor
    },

    // --- UNDERBARRELS (GRIPS) ---
    "grip_pod": {
        id: "grip_pod",
        name: "Classic Dual-Purpose Grip Pod",
        cost: 300,
        requiredTrack: "Support",
        requiredTier: 1,
        slot: "underbarrel",
        sdkEnum: mod.WeaponAttachments.Bottom_Classic_Grip_Pod
    },
    "grip_angled": {
        id: "grip_angled",
        name: "Full-Comfort Angled Foregrip",
        cost: 500,
        requiredTrack: "Assault",
        requiredTier: 2,
        slot: "underbarrel",
        sdkEnum: mod.WeaponAttachments.Bottom_Full_Angled
    },
    "grip_vertical": {
        id: "grip_vertical",
        name: "Ribbed Heavy Vertical Foregrip",
        cost: 600,
        requiredTrack: "Assault",
        requiredTier: 3,
        slot: "underbarrel",
        sdkEnum: mod.WeaponAttachments.Bottom_Ribbed_Vertical
    },

    // --- BARRELS ---
    "barrel_430mm": {
        id: "barrel_430mm",
        name: "430mm Factory Precision Barrel",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "barrel",
        sdkEnum: mod.WeaponAttachments.Barrel_430mm_Factory
    },
    "barrel_145mm": {
        id: "barrel_145mm",
        name: "145mm Compact Carbine Barrel",
        cost: 400,
        requiredTrack: "Assault",
        requiredTier: 2,
        slot: "barrel",
        sdkEnum: mod.WeaponAttachments.Barrel_145_Carbine
    },
    "barrel_115mm": {
        id: "barrel_115mm",
        name: "115mm CQB Commando Barrel",
        cost: 600,
        requiredTrack: "Assault",
        requiredTier: 3,
        slot: "barrel",
        sdkEnum: mod.WeaponAttachments.Barrel_115_Commando
    },
    "barrel_39": {
        id: "barrel_39",
        name: "39-Factory Sidearm Barrel",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "barrel",
        sdkEnum: mod.WeaponAttachments.Barrel_39_Factory
    },

    // --- AMMUNITION TYPES ---
    "ammo_fmj": {
        id: "ammo_fmj",
        name: "Full Metal Jacket Ball Ammo",
        cost: 0,
        requiredTrack: "Assault",
        requiredTier: 1,
        slot: "ammunition",
        sdkEnum: mod.WeaponAttachments.Ammo_FMJ
    },
    "ammo_subsonic": {
        id: "ammo_subsonic",
        name: "Subsonic Low-Tracer Stealth Ammo",
        cost: 500,
        requiredTrack: "Recon",
        requiredTier: 3,
        slot: "ammunition",
        sdkEnum: mod.WeaponAttachments.Ammo_Subsonic
    },
    "ammo_tungsten": {
        id: "ammo_tungsten",
        name: "Tungsten-Core Armor Piercing",
        cost: 800,
        requiredTrack: "Assault",
        requiredTier: 5,
        slot: "ammunition",
        sdkEnum: mod.WeaponAttachments.Ammo_Tungsten_Core
    }
};

// ==========================================
// 2. WEAPON SPECIFICATIONS
// ==========================================
export const WEAPON_REGISTRY: Record<number, WeaponSpec> = {
    // AK-205 Combat Carbine
    [mod.Weapons.Carbine_AK_205]: {
        assetId: mod.Weapons.Carbine_AK_205,
        name: "AK-205 Combat Carbine",
        allowedSlots: ["optic", "magazine", "muzzle", "underbarrel", "barrel", "ammunition"],
        defaultCustomization: {
            optic: "iron_sights",
            magazine: "mag_20rnd",
            muzzle: "muzzle_flash_hider",
            underbarrel: "grip_pod",
            barrel: "barrel_430mm",
            ammunition: "ammo_fmj"
        }
    },
    // M4A1 Tactical Carbine
    [mod.Weapons.Carbine_M4A1]: {
        assetId: mod.Weapons.Carbine_M4A1,
        name: "M4A1 Tactical Carbine",
        allowedSlots: ["optic", "magazine", "muzzle", "underbarrel", "barrel", "ammunition"],
        defaultCustomization: {
            optic: "iron_sights",
            magazine: "mag_30rnd",
            muzzle: "muzzle_flash_hider",
            underbarrel: "grip_angled",
            barrel: "barrel_145mm",
            ammunition: "ammo_fmj"
        }
    },
    // PP-19 Vityaz SMG
    [mod.Weapons.PP19_Vityaz]: {
        assetId: mod.Weapons.PP19_Vityaz,
        name: "PP-19 Vityaz SMG",
        allowedSlots: ["optic", "magazine", "muzzle", "barrel", "ammunition"],
        defaultCustomization: {
            optic: "iron_sights",
            magazine: "mag_30rnd",
            muzzle: "muzzle_flash_hider",
            underbarrel: "", // Underbarrels not supported on PP-19 for balance
            barrel: "barrel_430mm",
            ammunition: "ammo_fmj"
        }
    },
    // SV-98 Marksman Sniper
    [mod.Weapons.Sniper_SV_98]: {
        assetId: mod.Weapons.Sniper_SV_98,
        name: "SV-98 Tactical Bolt Action",
        allowedSlots: ["optic", "muzzle", "barrel", "ammunition"],
        defaultCustomization: {
            optic: "optic_bravo",
            magazine: "mag_20rnd", // Fixed magazine
            muzzle: "muzzle_flash_hider",
            underbarrel: "",
            barrel: "barrel_430mm",
            ammunition: "ammo_fmj"
        }
    },
    // P18 Automatic Sidearm
    [mod.Weapons.Sidearm_P18]: {
        assetId: mod.Weapons.Sidearm_P18,
        name: "P18 Automatic Pistol",
        allowedSlots: ["magazine", "barrel", "ammunition"],
        defaultCustomization: {
            optic: "iron_sights",
            magazine: "mag_17rnd",
            muzzle: "",
            underbarrel: "",
            barrel: "barrel_39",
            ammunition: "ammo_fmj"
        }
    }
};

// ==========================================
// 3. STATE CONTAINER & STORAGE
// ==========================================

// Maps player ID to their custom configurations across different weapons
// Map<PlayerID, Map<BaseWeaponEnum, PlayerWeaponCustomization>>
export const playerWeaponCustomizations = new Map<number, Map<number, PlayerWeaponCustomization>>();

/**
 * Initializes starting base configurations for a connecting human player profile.
 */
export function initializePlayerGunsmith(playerId: number): void {
    const customizations = new Map<number, PlayerWeaponCustomization>();
    
    // Seed initial defaults for all weapons
    for (const [weaponEnum, spec] of Object.entries(WEAPON_REGISTRY)) {
        customizations.set(Number(weaponEnum), { ...spec.defaultCustomization });
    }
    
    playerWeaponCustomizations.set(playerId, customizations);
}

/**
 * Deletes custom config sets on player disconnected to prevent memory bloating.
 */
export function clearPlayerGunsmith(playerId: number): void {
    playerWeaponCustomizations.delete(playerId);
}

// ==========================================
// 4. PROGRAMMATIC COMPILER
// ==========================================

/**
 * Compiles a type-safe, custom, ready-to-issue mod.WeaponPackage dynamically.
 * Combines player's purchased attachments and falls back to default weapon specs.
 * 
 * @param playerId The unique server ID of the player requesting the weapon.
 * @param weaponEnum The mod.Weapons enum value representing the base firearm.
 */
export function compileCustomWeaponPackage(playerId: number, weaponEnum: number): mod.WeaponPackage {
    const weaponSpec = WEAPON_REGISTRY[weaponEnum];
    
    // Create baseline package
    const customPackage = mod.CreateNewWeaponPackage();
    
    // Fallback default setup
    let customSetup: PlayerWeaponCustomization = weaponSpec 
        ? { ...weaponSpec.defaultCustomization }
        : { optic: "iron_sights", magazine: "mag_20rnd", muzzle: "muzzle_flash_hider", underbarrel: "", barrel: "barrel_430mm", ammunition: "ammo_fmj" };

    // Attempt to retrieve player-specific choices
    const playerConfigs = playerWeaponCustomizations.get(playerId);
    if (playerConfigs) {
        const specializedConfig = playerConfigs.get(weaponEnum);
        if (specializedConfig) {
            customSetup = specializedConfig;
        }
    }

    // Assemble and pack attachments programmatically
    const slots: AttachmentSlot[] = ["optic", "magazine", "muzzle", "underbarrel", "barrel", "ammunition"];
    
    for (const slot of slots) {
        const attachmentId = customSetup[slot];
        if (attachmentId && attachmentId !== "") {
            const attachmentMeta = ATTACHMENT_REGISTRY[attachmentId];
            if (attachmentMeta) {
                // Check if this slot is supported by the physical weapon specification
                if (weaponSpec && weaponSpec.allowedSlots.includes(slot)) {
                    mod.AddAttachmentToWeaponPackage(attachmentMeta.sdkEnum, customPackage);
                }
            }
        }
    }

    return customPackage;
}

// ==========================================
// 5. TRANSACTIONAL SERVICES
// ==========================================

/**
 * Validates, sells, and equips a specific attachment to a player's customized firearm.
 * Checks for wallet balance, track levels, and slot eligibility.
 */
export function purchaseAndEquipAttachment(
    player: mod.Player,
    weaponEnum: number,
    attachmentId: string
): boolean {
    const playerId = mod.GetObjId(player);
    const profile = mercenaryRegistry.get(playerId);
    const attachmentMeta = ATTACHMENT_REGISTRY[attachmentId];
    const weaponSpec = WEAPON_REGISTRY[weaponEnum];

    if (!profile || !attachmentMeta || !weaponSpec) {
        return false;
    }

    // Verify slot eligibility
    if (!weaponSpec.allowedSlots.includes(attachmentMeta.slot)) {
        mod.DisplayNotificationMessage(
            mod.Message("ERROR: Weapon does not support this slot configuration!"),
            player
        );
        return false;
    }

    // Check progression mastery levels
    const currentTier = profile.tracks[attachmentMeta.requiredTrack].level;
    if (currentTier < attachmentMeta.requiredTier) {
        mod.DisplayNotificationMessage(
            mod.Message("LOCKED: Higher Mastery Tier required in track: " + attachmentMeta.requiredTrack),
            player
        );
        return false;
    }

    // Calculate transaction cash delta
    const cost = attachmentMeta.cost;
    if (profile.getCash() < cost) {
        mod.DisplayNotificationMessage(
            mod.Message("TRANSACTION REJECTED: Insufficient cash funds in wallet!"),
            player
        );
        return false;
    }

    // Process secure financial deduction
    profile.removeCash(cost, `Gunsmith Customization: ${attachmentMeta.name}`);

    // Update in-memory customizations
    let playerConfigs = playerWeaponCustomizations.get(playerId);
    if (!playerConfigs) {
        initializePlayerGunsmith(playerId);
        playerConfigs = playerWeaponCustomizations.get(playerId)!;
    }

    const specializedConfig = playerConfigs.get(weaponEnum);
    if (specializedConfig) {
        specializedConfig[attachmentMeta.slot] = attachmentId;
    }

    mod.DisplayNotificationMessage(
        mod.Message(`SUCCESS: Equipped ${attachmentMeta.name} to ${weaponSpec.name}.`),
        player
    );

    return true;
}

// Fallback legacy exports to preserve compilation with existing index files
export const carbinePackage_Tier1 = compileCustomWeaponPackage(0, mod.Weapons.Carbine_AK_205);
export const carbinePackage_Tier3 = compileCustomWeaponPackage(0, mod.Weapons.Carbine_M4A1);
export const carbinePackage_Tier5 = compileCustomWeaponPackage(0, mod.Weapons.Carbine_M4A1);
export const SidearmPackage_Standard_P18 = compileCustomWeaponPackage(0, mod.Weapons.Sidearm_P18);
