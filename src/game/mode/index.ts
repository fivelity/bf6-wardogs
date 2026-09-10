/**
 * game/mode/index.ts — barrel import for every WARDOGS-specific mode-rule module.
 * Same pattern as `src/index.ts` one level up (BUILD_GUIDE.md §4): add one `import "./x.ts";`
 * line per new mode file so its top-level `Events.*.subscribe()` calls register at load time.
 *
 * `win-condition.ts` is intentionally NOT imported here — it exports only a pure function
 * (`evaluateWinCondition`) with zero `Events.*.subscribe()` calls of its own; `controlzone.ts`
 * already imports and calls it directly, which is sufficient to load the module.
 */
import "./fob.ts";
import "./controlzone.ts";
import "./hotzone.ts";
import "./towers.ts";
import "./salvage.ts";
import "./chaos-ai.ts";
