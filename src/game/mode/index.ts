/**
 * game/mode/index.ts — barrel import for every WARDOGS-specific mode-rule module.
 * Same pattern as `src/index.ts` one level up (BUILD_GUIDE.md §4): add one `import "./x.ts";`
 * line per new mode file so its top-level `Events.*.subscribe()` calls register at load time.
 *
 * Import order matters: `hotzone.ts` and `chaos-ai.ts` both import `controlzone.ts`'s
 * `isPhase3()`, and `towers.ts` imports `hotzone.ts`'s `lockDriftTarget()` — declared in an order
 * that respects those dependencies.
 *
 * `win-condition.ts` is intentionally NOT imported here — it exports only pure functions
 * (`evaluateWinCondition`, `startMatchTimer`, `hasGameEnded`) with zero
 * `Events.*.subscribe()` calls of its own; `controlzone.ts` already imports and calls it
 * directly, which is sufficient to load the module.
 *
 * `combat-rewards.ts` is new in this pass — closes the previously-flagged gap where nothing
 * called `progression.ts`'s `addXp` for human-vs-human kills/revives.
 */
import "./fob.ts";
import "./controlzone.ts";
import "./hotzone.ts";
import "./towers.ts";
import "./salvage.ts";
import "./chaos-ai.ts";
import "./combat-rewards.ts";
