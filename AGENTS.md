# AGENTS.md — Swarm Gate (working title)

Portrait 3D "mob shooter" arcade game shipped as a **native mobile app** (Android first; iOS only if a Mac is available).
Built with web tech (TypeScript + Three.js) inside a Capacitor shell. The browser is a dev convenience, not the target.
**Gameplay source of truth: `docs/GAME_BRIEF.md`.** Read it before planning.

## Workflow (follow strictly)
1. **Plan first.** Produce an Implementation Plan and Task List. Do not edit files until I approve the plan.
2. **One milestone at a time** (M0 → M6 in the brief). Stop after each one with a Walkthrough and wait for my go-ahead.
3. Do not start milestone N+1 until milestone N's acceptance criteria pass.
4. **M1 is a go/no-go gate.** The reference phone is a vivo V21e. If the on-device target fails after a reasonable optimisation pass, stop and propose an engine change. Do not push on.
5. **No phone until the end of M1.** Build and verify M0 and M1 in the desktop browser (portrait 390×844, Chrome CPU throttling at 4×). At the end of M1, test once on the phone over local Wi-Fi: `npm run build && npm run preview -- --host`, then open the printed LAN address in Chrome on the phone. Android Studio and Capacitor wrapping start at M1.5, after the gate passes.
6. If a rule or mechanic is ambiguous, ask. Do not invent mechanics; list assumptions in the plan.
7. Small, reviewable commits with conventional messages (`feat:`, `fix:`, `test:`, `chore:`).
8. Adding a dependency requires a one-line justification in the plan. No game engines, no physics engines.
9. IP: original name, original art, CC0 or self-made assets only. Never copy third-party names, logos, characters or art.

## Stack
TypeScript (strict) · Vite · Three.js · **Capacitor (Android; iOS later)** · Vitest · Playwright · ESLint + Prettier · zod
Capacitor plugins as needed: `@capacitor/app` (pause/resume), `@capacitor/haptics`, `@capacitor/preferences` (saves), `@capacitor/status-bar`, `@capacitor/splash-screen`.
HUD is plain DOM/CSS over the canvas. Audio via WebAudio (Howler allowed).

## Commands
`npm run dev` (browser, fast iteration) · `npm run build` · `npm run test` · `npm run lint` · `npm run typecheck`
`npm run check` (lint + typecheck + test) must pass before any milestone is called done.
`npm run android` (added in M1.5) = build + `cap sync` + run on the connected device. Add `npm run android:release` in M6.

## Architecture rules
- `src/sim/` is pure TypeScript: no `three`, no DOM, no Capacitor, no `Math.random` (use the seeded RNG). Fixed timestep (60 Hz). Deterministic.
- `src/render/` reads sim state and draws it. It never mutates sim state.
- `src/platform/` is the only place that imports Capacitor (haptics, storage, lifecycle). Everything else uses its interfaces, so the game still runs in a plain browser.
- `src/ui/` is the DOM HUD. `src/data/` holds level JSON. `src/config/` holds all tunable constants (no magic numbers).
- Units are structure-of-arrays typed arrays with a free-list pool. No per-unit objects, and no allocations inside the frame loop.
- One `InstancedMesh` per unit type and team. Collisions use a uniform spatial hash grid, not a physics engine.
- Only simulate what is near the player. Far-field crowds are visual only.

## Mobile rules
- **A real phone is the source of truth for performance.** Emulators and desktop browsers do not count as evidence. Desktop CPU throttling catches CPU problems only, not GPU fill-rate problems.
- Lock to portrait. Use `viewport-fit=cover` and `env(safe-area-inset-*)`. Touch targets at least 48 dp. No hover, right-click or keyboard-only features.
- Pause the sim and audio on app background, resume cleanly on return (`@capacitor/app`).
- Unlock WebAudio on the first touch. Persist saves through `@capacitor/preferences`, not raw `localStorage`.
- Adaptive quality: measure frame time and lower pixel ratio or unit cap automatically when the device struggles or heats up.
- Cap `devicePixelRatio` at 1.5 on low-tier devices (fill rate is the bottleneck on this GPU class), 2 otherwise. No real-time shadows, no post-processing in v0. Keep install size small (compressed textures, meshopt GLB).
- Must work fully offline. No network calls in v0.

## Quality bar
- No `any`. No unused code. Pure functions for game rules (gate math, damage, spawning) so they are unit-testable.
- Every bug fix ships with a regression test.
- Performance budget on the reference phone (vivo V21e): 55+ fps with 500 mobs (M1 gate), 45+ fps with 2,000 active units from M3 on, under 100 draw calls. Include a `?debug` overlay showing fps, unit counts and `renderer.info`.
- Evidence in each Walkthrough: a 390×844 browser screenshot showing the debug overlay. From the M1 gate onward, also a screenshot from the phone with the overlay visible.

## Do not
- Do not rewrite working modules when a small change would do.
- Do not leave TODOs without an entry in `docs/BACKLOG.md`.
- Do not commit generated assets, `node_modules`, `android/build` outputs or signing keys.
