# LLM Workflow — WARDOGS

This document describes how LLM agents should operate within this repository.
For SDK-specific rules, see `DOCS/BF6_SDK.md`.
For the complete rule set, see `AGENTS.md`.

---

## Session startup checklist

Every new agent session must do these in order before writing code:

1. **Read `AGENTS.md`** — the single source of truth for all project rules.
2. **Read `.llm/brief.md`** — the WARDOGS game design contract.
   - If it is empty or contains only placeholder text, **stop** and request the user fill it
     in. Do not generate game logic without a design contract.
3. **Read `.llm/todo.md`** — understand what is complete and what is pending.
4. **Read `.llm/memory.md`** — review durable facts from prior sessions.
5. **Verify SDK types** — for any new API usage, check
   `node_modules/bf6-portal-mod-types/index.d.ts` before writing.

---

## `.llm/` directory — agent-facing files

| File                  | Purpose                                                     | Rule                        |
|-----------------------|-------------------------------------------------------------|-----------------------------|
| `brief.md`            | WARDOGS game rules, mechanics, win conditions               | Fill before coding; authoritative |
| `todo.md`             | Task list, open issues, pending fixes                       | Update after every session  |
| `memory.md`           | Persistent facts across sessions                            | Append only, never overwrite|
| `skeleton.ts`         | Template for new module files                               | Reference when creating files|
| `modlib.ts`           | Patterns for `modlib/` wrapper functions                    | Reference for undocumented APIs|
| `dev_guidelines.md`   | Extended coding standards beyond AGENTS.md                  | Read before non-trivial work|
| `prompts.md`          | Reusable prompt fragments for common tasks                  | Use for consistency         |
| `index.ts.txt`        | Latest copy of `src/index.ts` for context                   | Keep in sync                |
| `index.d.ts.txt`      | Snapshot of `bf6-portal-mod-types/index.d.ts`              | Reference for type verification|
| `template.ts`         | Boilerplate for new mod features                            | Reference when scaffolding  |

---

## `DOCS/` directory — human-facing reference

| File                  | Purpose                                         |
|-----------------------|-------------------------------------------------|
| `BF6_SDK.md`          | SDK patterns, import rules, API corrections     |
| `LLM_WORKFLOW.md`     | This file                                       |
| `LLM_TEMPLATE.md`     | Template for new DOCS pages                     |
| `PROJECT_CHECKLIST.md`| High-level project milestone tracker            |
| `README.md`           | Project overview for humans                     |
| `example.index.ts`    | Full working example of `src/index.ts`          |

**Do not** consolidate `.llm/` into `DOCS/` or vice versa. They serve different audiences.

---

## After each coding session

1. **Update `.llm/todo.md`:**
   - Mark completed items.
   - Add newly discovered issues or next steps.

2. **Update `.llm/memory.md`** with any durable facts:
   - API corrections discovered
   - Architectural decisions made
   - Files created or significantly changed

3. **Do not** update `AGENTS.md` or `.claude/agents/*.agent.md` unless explicitly asked —
   those are versioned configuration files.

---

## Code output format

When producing code edits:

- **New file:** Show the complete file.
- **Existing file edit:** Show only the changed region with ≥5 lines of surrounding context.
- **Always** state the full file path at the top of each code block.
- **Never** output code with known TypeScript type errors.
- If a type error is discovered mid-edit, fix it before outputting.

---

## TypeScript error workflow

When fixing type errors:

1. Read the error message precisely — do not guess.
2. Check `node_modules/bf6-portal-mod-types/index.d.ts` for the correct API.
3. If the function is undocumented, add a declaration to `src/types/mod-extended.d.ts`.
4. Fix the error at its root cause — do not cast to `any` or use `// @ts-ignore`.
5. Run `pnpm validate` mentally (or literally if the environment allows) to confirm.

---

## Prohibited patterns (will cause build failure or runtime errors)

```ts
// ❌ Never import the mod types package
import mod from "bf6-portal-mod-types";
import { Player } from "bf6-portal-mod-types";

// ❌ Never import from bf6-portal-utils root
import { Events } from "bf6-portal-utils";

// ❌ Never implement raw Portal hooks
export function OnPlayerDeployed(player: mod.Player) { ... }

// ❌ Never use SolidUI APIs
SolidUI.render(...)
SolidUI.For(...)
SolidUI.Index(...)

// ❌ Never access mod.Vector properties directly
vec.x; vec.y; vec.z;

// ❌ Never use wrong function names
mod.EnableSFX()
mod.GetPlayerState()
mod.SetPlayerSpeedMultiplier()
Vectors.toModVector()
```

---

*Last updated: 2026-09-06*
