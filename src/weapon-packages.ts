// src/features/shop/weapon-packages.ts

/**
 * Standard attachments and weapons configurations for the WARDOGS economy.
 * Uses programmatic weapon assembly to create type-safe equipment packages.
 */

// Tier 1 Carbine - AK-205 (Baseline Carbine)
export const carbinePackage_Tier1 = mod.CreateNewWeaponPackage();
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Magazine_20rnd_Magazine, carbinePackage_Tier1);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Scope_Iron_Sights, carbinePackage_Tier1);

// Tier 3 Carbine - M4A1 (Standard Tactical Carbine)
export const carbinePackage_Tier3 = mod.CreateNewWeaponPackage();
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Magazine_30rnd_Fast_Mag, carbinePackage_Tier3);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Scope_1p87_150x, carbinePackage_Tier3);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Bottom_Classic_Grip_Pod, carbinePackage_Tier3);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Muzzle_Compensated_Brake, carbinePackage_Tier3);

// Tier 5 Carbine - M4A1 (Elite Tungsten Special Carbine)
export const carbinePackage_Tier5 = mod.CreateNewWeaponPackage();
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Magazine_40rnd_Fast_Mag, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Scope_R4T_200x, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Bottom_Ribbed_Vertical, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Ammo_Tungsten_Core, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Muzzle_Lightened_Suppressor, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Barrel_115_Commando, carbinePackage_Tier5);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Ergonomic_Improved_Mag_Catch, carbinePackage_Tier5);

// Baseline Sidearm - P18 Select Fire
export const SidearmPackage_Standard_P18 = mod.CreateNewWeaponPackage();
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Ammo_FMJ, SidearmPackage_Standard_P18);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Magazine_17rnd_Magazine, SidearmPackage_Standard_P18);
mod.AddAttachmentToWeaponPackage(mod.WeaponAttachments.Barrel_39_Factory, SidearmPackage_Standard_P18);
