Use direct edits when modifying existing code.
Breakup large refactors into chunks or properly rewrite the entire code file.
Check the BF6 Portal SDK to ensure proper types, enums.
The `mod` namespace is provided via `bf6-portal-mod-types` package.
The `tsconfig.json` includes `"types": ["bf6-portal-mod-types"]` - no `mod` imports necessary!

Avoid using hack tactics to implement code (creating scripts, duplicate files, cli hacks, python). Failures are usually caused from incorrect tool usage.
If one tool call fails, understand the issue, and retry directly.