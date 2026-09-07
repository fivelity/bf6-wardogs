# WARDOGS Implementation Audit

## Active tasks
- [x] Audit the construction runtime against the design brief and the SDK contract.
- [x] Correct the excavation flow so build steps spend FOB materials instead of player cash.
- [x] Wire the live construction managers into the startup lifecycle.
- [ ] Validate runtime behavior against the Portal session once BF_PORTAL_SESSION_ID is active.

## Notes
- The brief requires construction to consume local FOB stockpiles while still granting builder cash rewards for successful hits.
- The earlier implementation treated the personal wallet as the material source, which violates the design contract.
- The construction and PDA systems are now bound to the actual FOB logistics manager and initialized during game start.
