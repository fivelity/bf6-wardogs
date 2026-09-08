# WARDOGS Implementation Audit

## Active tasks
- [x] Audit the construction runtime against the design brief and the SDK contract.
- [x] Correct the excavation flow so build steps spend FOB materials instead of player cash.
- [x] Wire the live construction managers into the startup lifecycle.
- [x] Replace raw lifecycle exports with typed `bf6-portal-utils/events` subscriptions.
- [x] Wire hotzone, anti-camping, salvage, logistics, team-switching, scavenger, shop, HUD, and scoreboard systems.
- [x] Validate strict TypeScript and Portal experience configuration.
- [x] Generate and bundle Portal localization output at `dist/strings.json`.
- [ ] Validate runtime behavior against the Portal session once BF_PORTAL_SESSION_ID is active.

## Notes
- The brief requires construction to consume local FOB stockpiles while still granting builder cash rewards for successful hits.
- The earlier implementation treated the personal wallet as the material source, which violates the design contract.
- The construction and PDA systems are now bound to the actual FOB logistics manager and initialized during game start.
- The installed `ts-portal-bundle` CLI rejects the mandated bare `bf6-portal-utils/*` imports; TypeScript and config validation pass, but packaging requires a bundler version/config that supports package resolution.
- The strings compiler requires flat string maps, so `src/strings.json` uses flat keys and now contains all 231 detected Portal message entries. `pnpm bundle` generates `dist/strings.json` automatically.
