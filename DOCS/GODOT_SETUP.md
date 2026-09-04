# BF6 Portal SDK — Godot Setup & Editing Guide

---

## Getting Started

1. **Open the Portal SDK executable**
2. A "Project Selection" window will open
3. **Drag** the `GodotProject` folder into the window to import the Portal project automatically (or press "Import")
4. **Open** the Battlefield 6 Portal Project and wait for it to start up (can take a few minutes)
5. **Setup:** Click the **"Portal Setup"** button in the **BFPortal** tab (right side of Godot UI) and wait for setup to finish (several minutes)
6. **Edit:** Open the **Scene** dropdown and select **"Open Scene"**, navigate to the **levels** directory, and select a level

> **Note:** Level geometry is often above the default camera position — look up if you can't find it.

---

## Spatial Editor Controls

### Camera Navigation (hold Right Mouse Button)
| Action | Effect |
|--------|--------|
| Move mouse | Tilt and pan camera |
| W, A, S, D | Move camera position |
| Scroll wheel | Change camera movement speed |
| Scroll wheel | Zoom in and out |

### Object Selection
| Key | Effect |
|-----|--------|
| Click in Scene Outliner | Select object |
| **Q** + click in 3D view | Select object |
| **F** | Frame selected object into view |

### Object Manipulation
| Key | Effect |
|-----|--------|
| **W** | Move mode |
| **E** | Rotate mode |
| **R** | Scale mode |

> **Note:** Always use uniform scaling — non-uniform scaling is not supported.

### Object Library
- Drag objects from the Object Library into the 3D Scene or Scene Outliner
- Only use objects from the **same level tab** — cross-level objects aren't supported
- Check the level tab at the bottom center of Godot to see available assets

### Exporting Map Edits
- Press the **"Export Current Level"** button in the BFPortal tab
- Produces a `.spatial.json` file attachable via the Portal Web Builder

### Static Layers
Each map has a "Static" layer containing Terrain and baked Assets. **These are not editable.**

---

## Important Gameplay Objects

| Object Type | Purpose |
|-------------|---------|
| **Combat Area** | Defines playable boundaries. Requires `Combat Volume` property set with a `PolygonVolume`. Works: left-click to move points, `Ctrl`+left-click to create new points, `Ctrl`+right-click to remove. Pre-placed on all maps. |
| **HQ_PlayerSpawner** | Standard Battlefield HQ. Players manually spawn using their team's HQ. Assigned to a specific team via the Inspector Panel. |
| **PlayerSpawner** | No HQ required. Scriptable deployment for any player. Not team-assigned. |
| **SpawnPoint** | Determines where players spawn when linked to HQ or Player Spawners. |
| **AreaTrigger** | Paired with a `PolygonVolume` to trigger `OnPlayerEnterAreaTrigger` / `OnPlayerExitAreaTrigger` in script. |
| **DeployCam** | Camera used in the Deploy Screen. |
| **VehicleSpawner** | Triggers vehicles to spawn into the map via script. |
| **WorldIcon** | In-world icons with text. Placed in the level. |
| **InteractPoint** | Triggers `OnPlayerInteract` event in script. |
| **AI_Spawner** | Spawns Custom AI Bots controllable via script. |

---

## Available Maps

| Level Name | Map Code |
|------------|----------|
| Siege Of Cairo | `MP_Abbasid` |
| Empire State | `MP_Aftermath` |
| Bellum1988's Operation Metro | `MP_Aftermath_Portal` |
| Blackwell Fields | `MP_Badlands` |
| Iberian Offensive | `MP_Battery` |
| Liberation Peak | `MP_Capstone` |
| Contaminated | `MP_Contaminated` |
| Manhattan Bridge | `MP_Dumbo` |
| Eastwood | `MP_Eastwood` |
| Operation Firestorm | `MP_FireStorm` |
| Railway to Golmud | `MP_GolmudRailway` |
| Golf Course | `MP_Granite_ClubHouse_Portal` |
| Downtown | `MP_Granite_MainStreet_Portal` |
| Marina | `MP_Granite_Marina_Portal` |
| Area 22B | `MP_Granite_MilitaryRnD_Portal` |
| Redline Storage | `MP_Granite_MilitaryStorage_Portal` |
| Defense Nexus | `MP_Granite_TechCampus_Portal` |
| Complex 3 | `MP_Granite_Underground_Portal` |
| Tsuru Reef | `MP_Isolated` |
| Saints Quarter | `MP_Limestone` |
| New Sobek City | `MP_Outskirts` |
| Cairo Bazaar | `MP_Plaza` |
| Portal Sandbox | `MP_Portal_Sand` |
| Hagental Base | `MP_Subsurface` |
| Mirak Valley | `MP_Tungsten` |

---

## Gameplay Scripting

Portal supports **two** scripting methods:

1. **TypeScript** — Write `.ts` files externally or directly in the Portal Web Tool's script page. Full SDK access via `mod.*` namespace.
2. **Blockly** — Visual block-based scripting in the Portal Web Builder Tool (good for beginners).

### Script Debugging
When running locally, a **`PortalLog.txt`** file is generated:

```
C:\Users\<username>\AppData\Local\Temp\Battlefield™ 6\PortalLog.txt
```

> Note: The folder path may vary depending on your system or SDK install location.

### Custom UI
A fully customizable UI system is available, supporting both interactive and non-interactive elements (menus, stores, etc.). See `MOD_API_SUMMARY.md` for `AddUIContainer`, `AddUIText`, `AddUIButton` functions.

### AI Behavior
Custom AI Bots (beyond standard Backfill or Static bots) can be spawned via script using `AI_Spawner` objects. Unlike normal bots, Custom AI supports direct scripting of:
- Target
- Stance
- Speed
- Move to location

### Object Spawning
Environmental and gameplay objects can be spawned at runtime via `mod.SpawnObject()`. Spawnable objects are restricted to those already on the map or in the Global object list.

### VFX Spawning
Visual FX can be placed in the map via Spatial Editor or spawned at runtime via `mod.RuntimeSpawn_Common.*`. Triggered at runtime via `mod.EnableVFX()`.

### Audio
Sound FX can be placed in the map via Spatial Editor or spawned at runtime. Triggered at runtime via `mod.PlaySound()`. SFX can also be moved at runtime via `MoveObject()`, `MoveObjectOverTime()`, or `SetObjectTransform()`.

### Object Moving
Objects can be moved at runtime via:
- `mod.MoveObject(object, deltaPosition, deltaRotation)`
- `mod.SetObjectTransform()`

### Player Spawning
Players can be deployed directly into the level using a PlayerSpawner object and the `mod.SpawnPlayerFromSpawnPoint()` function.

### Referencing Objects in Script
Most objects in the Spatial Editor have an **ObjId** field set to a unique number. Objects are referenced in script via matching "Get" functions:
- `mod.GetSpatialObject()`
- `mod.GetSpawner()`
- `mod.GetInteractPoint()`
- `mod.GetHQ()`, `mod.GetCapturePoint()`, etc.

### String Files (`strings.json`)
String files can be manually crafted as JSON key/value pairs or auto-generated from the Portal Web Tool after importing the script.

**Example:**
```json
{
  "scoreboard": "Custom Scoreboard"
}
```

```typescript
// Script usage:
const msg1 = mod.Message(mod.stringkeys.scoreboard);
const msg2 = mod.Message("scoreboard");  // Also works
const msg3 = mod.Message("Custom Scoreboard");  // Requires generating strings.json from Web Editor
```

---

## Performance Tips

| Issue | Recommendation |
|-------|----------------|
| **Vehicle Count** | Server performance degrades with >40 active vehicles. Stay below 40. |
| **Player Iteration** | Store player state via events (e.g., `OnPlayerEnterCapturePoint`) instead of iterating all players every frame. Reduces need for frequent full-player scans. |
| **UI Widgets** | Maintain variables to track existing widgets instead of recreating them. Regular creation/deletion impacts performance. |

---

## Mod Components

When deploying a mod, you need three components:

| File | Purpose |
|------|---------|
| `modname.ts` | Gameplay script |
| `modname.tscn` | Godot level with spatial edits (must be exported from Godot) |
| `modname.strings.json` | Predefined localization strings used in the mod |

---

## External Resources

| Resource | Link |
|----------|------|
| Portal SDK | https://portal.battlefield.com/bf6/experiences |
| Portal 101 - Introduction | https://www.ea.com/games/battlefield/battlefield-6/news/portal-101-introduction-to-battlefield-portal |
| Portal 101 - Advanced Creations | https://www.ea.com/games/battlefield/battlefield-6/news/portal-101-advanced-creations |
| Battlefield Creator Program | https://www.ea.com/games/battlefield/battlefield-6/news/introducing-the-battlefield-creator-program |
| Portal Hub | https://www.ea.com/games/battlefield/battlefield-6/portal |
| Browse Community Experiences | https://www.ea.com/games/battlefield/battlefield-6/portal/browse |

---
