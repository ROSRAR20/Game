# Game Brief — Swarm Gate (working title)

> **Target: native mobile app, portrait, Android first** (iOS only if a Mac is available). Built with web tech inside a Capacitor shell.
> **Reference test phone: vivo V21e** (section 5). Phone testing is deferred to the end of M1; M0 and M1 are built and verified in the desktop browser.
> Derived from a 59-second portrait gameplay/ad video (720×1280). I sampled one frame every 2 seconds and could not analyse the audio, so exact numbers and rules marked **(inferred)** must be confirmed in planning. Where this brief and your assumptions disagree, ask.

## 1. What the video shows

| Time | Content | Use it for |
|---|---|---|
| 0:00–0:12 | Ad-hook footage: a small runner/cannon with a blue trail fights a giant skeleton boss (HP counter 1000 → 620), then a green dinosaur cameo and a huge red carpet of enemies. | Boss visual inspiration only. **Not the core loop.** |
| 0:16–0:54 | Actual gameplay: fixed high-angle camera down a straight road. The player's cannon sits at the bottom and fires small blue units forward. Gates multiply or add to them. A giant red horde fills the far end. | **The game to build.** |
| 0:56–0:58 | End card with logo and store search bar. | Ignore. |

### Mechanics observed in 0:16–0:54
- **Camera / layout:** static perspective camera, portrait, road narrowing toward a far-field red horde. Fences on both sides.
- **Player:** one cannon at the bottom, moves left/right only (drag). Auto-fires at a steady rate **(inferred)**. In later frames it becomes a cluster of armoured units firing flame bolts, shown with a "LV+1" burst, so units have **upgrade tiers**.
- **Gates:** purple multiplier gates (×3, ×4), a wide orange ×100 gate at the far end, and a column of blue "+1" panels along the left edge. A unit passing through a multiplier gate becomes N units. Red units also stream through gates toward the player **(inferred)**, so gates act on whichever team passes.
- **Guardian tower:** a statue (golden, later blue) on a pedestal with a number (590 → 540 → 314 → 264 → 90 → 3). The number is HP and drops as it is shot. A "+99" reward tile sits beside it **(inferred: destroying it pays out)**.
- **Bosses:** yellow caped creatures with red HP bars (500, 3000), shown dropping 3000 → 2774 → 2021 → 1755 → 1313 → 729 → 642 → 500.
- **Feedback:** a red edge-of-screen vignette flashes when enemies get through or the base is hit **(inferred)**. Dust and sparks on impact. Large white outlined numerals for every count.
- **HUD:** very minimal. Numbers live in the world (on gates, towers, bosses), not in panels.

## 2. Game design spec (v0 target)

**Core loop:** drag the cannon → it fires blue mobs up the road → route them through multiplier gates → they fight the red horde and break the guardian tower and bosses → clear the level before red mobs break through the base line.

**Entities**
- `Mob` (team blue or red): position, velocity, hp, damage, tier.
- `Cannon`: x position, fire rate, current unit tier.
- `Gate`: kind `mul` or `add`, value, x-span, z position, owner = neutral.
- `Tower`: hp number, position, reward.
- `Boss`: hp, hp bar, position, behaviour.
- `Base line`: the bottom of the road. Red mobs reaching it cause damage.

**Rules (all values in `src/config`, tune later)**
- A unit crossing a gate's z-plane inside its x-span triggers it once (track `lastGateId` per unit).
- `mul N`: spawn N−1 extra units at the same spot with small jitter. `add N`: spawn N extra units.
- Blue vs red contact: both lose hp equal to the other's damage. Mobs have 1 hp at tier 0.
- Hard cap on active units (start at 3,000 total). When the cap is hit, extra spawns are merged into a "weight" on existing units rather than dropped silently.
- Lose: base hp reaches 0. Win: all towers and bosses destroyed.
- Pickup "LV+1" upgrades the cannon's unit tier: more hp and damage, different mesh colour or scale.

**Controls (touch-first):** Pointer Events with `touch-action: none`. Relative one-finger drag mapped to cannon x, clamped to the road, with the thumb never needing to cover the cannon. Keyboard A/D and arrows exist only for desktop testing.

## 3. Tech stack and why

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Your JavaScript background transfers directly. Types catch agent mistakes early. |
| Build / dev | Vite | Fast HMR, zero config. Browser is the fast inner loop; the phone is the real test. |
| Rendering | Three.js with `InstancedMesh` | Thousands of units in one draw call. Largest ecosystem, so agents write it reliably. |
| Physics | None. Custom spatial hash and steering | A physics engine cannot handle thousands of units on a phone. |
| HUD | DOM + CSS overlay | Crisp text, safe-area aware layout, no in-canvas text cost. |
| **Mobile shell** | **Capacitor (Android first)** | Produces a real installable app from the same code. Native plugins for haptics, app lifecycle and durable saves. |
| Audio | WebAudio (Howler optional) | Simple SFX and music. Must be unlocked on first touch. |
| Tests | Vitest (sim logic), Playwright (smoke + screenshots) | Keeps the agent honest. The sim is pure TS, so it runs headless. |
| Quality | ESLint, Prettier, `tsc --noEmit` | One `npm run check` gate. |
| Data | JSON levels + zod validation | New levels without code changes. |
| Assets | Primitives first, then CC0 packs (Kenney, Quaternius) as GLB with meshopt | Avoids art blocking the mechanic. |

### The honest trade-off
This is a real mobile app, but the game runs inside the phone's WebView. That is fine for hundreds to low thousands of instanced units, and it has a lower performance ceiling than Unity or Godot. The original game type is typically built in Unity. I chose this stack because you already know JavaScript, an agent writes and verifies it most reliably, and it avoids learning C#.

**Mitigation: the M1 go/no-go gate.** Test on your vivo V21e at the end of M1. If 500 mobs cannot hold about 55+ fps after an optimisation pass, stop and switch to **Godot 4** (GDScript is Python-like, exports natively to Android and iOS, and `MultiMesh` handles thousands of units). Unity is the strongest engine but needs C# and is the hardest for an agent to verify, so it is a last resort.

### Prerequisites you need on your machine
- For M0–M1: Node.js LTS and Chrome only.
- From M1.5: Android Studio (SDK and platform tools) and a JDK.
- **Your vivo V21e**, needed once at the end of M1 (over Wi-Fi, no cable) and again at later checkpoints. Emulators do not tell you real GPU performance.
- iOS builds require macOS and Xcode. Without a Mac, plan Android first and treat iOS as later.
- Store accounts (Google Play, Apple Developer) are only needed at M6.

## 4. Repo layout
```
/AGENTS.md
/docs/GAME_BRIEF.md   /docs/BACKLOG.md
/capacitor.config.ts  /android/        (generated by Capacitor)
/src/sim       (pure TS: units, gates, combat, spawner, rng, fixed-step loop)
/src/render    (three scene, instanced meshes, camera, vfx)
/src/platform  (only place that imports Capacitor: haptics, storage, lifecycle)
/src/ui        (DOM HUD, menus)
/src/input     (pointer + keyboard)
/src/data      (levels/*.json + zod schemas)
/src/config    (constants)
/tests (unit)  /e2e (playwright)
```

## 5. Performance and mobile plan (the main technical risk)
- Simulation separate from rendering. Fixed 60 Hz step, render with interpolation. Phones at 90 or 120 Hz must not change game speed.
- Structure-of-arrays typed arrays (`x, z, vx, vz, hp, team, tier`) and a free-list pool. Zero per-frame allocations (GC pauses show up as stutter on phones).
- One `InstancedMesh` per unit type per team. Write matrices from the arrays each frame, set `DynamicDrawUsage`, draw only `count` instances.
- Uniform spatial hash grid for collisions and separation, cell size about 2× unit radius.
- The giant red mass at the far end is **visual**: render it as a cheap far-field (textured plane or static instances) and simulate only the active wave near the gates.
- Cap `devicePixelRatio` at 1.5 on this device class (2 on faster phones). No real-time shadows (blob decals), no post-processing in v0, under 500 triangles per unit, texture atlas, meshopt-compressed GLB.
- **Adaptive quality:** track average frame time. If it exceeds budget, lower pixel ratio first, then the unit cap, then particle count. Phones throttle when hot, so this matters after minute two, not minute zero.
- **Lifecycle:** pause sim and audio when the app is backgrounded or a call comes in; resume without a time jump.
- **Layout:** portrait lock, `viewport-fit=cover`, safe-area insets for notches and gesture bars, and a back-button handler on Android.
- **Profiling:** `?debug` overlay (fps, active units, draw calls, triangles) plus Chrome `chrome://inspect` remote debugging against the phone's WebView.

### Reference device: vivo V21e
A lower mid-range phone from 2021, so it is a pessimistic test: if the game runs well here, most newer phones will be fine. The 5G model sold in India has a MediaTek Dimensity 700, Mali-G57 MC2 GPU, 8 GB RAM and a 1080×2400 AMOLED at 60 Hz. A 4G variant with a Snapdragon 720G exists in some regions, so confirm yours under Settings → About phone. The weak point is GPU fill rate at full resolution, not unit count, which is why the pixel-ratio cap and no real-time shadows matter.

## 6. Milestones and acceptance criteria
Plan M0–M2 in detail first. Keep M3+ at outline level until M2 is accepted.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold: Vite + TS strict, lint, tests, Playwright, road plane, fixed camera, portrait canvas, debug overlay. **Browser only, no phone.** | `npm run check` passes. Road renders at 60 fps in a 390×844 viewport. Browser screenshot attached. |
| M1 | Core loop: draggable cannon auto-fires pooled, instanced blue mobs up the road. **Go/no-go gate on the phone** | Browser: 500 mobs at 60 fps with 4× CPU throttling. **vivo V21e over Wi-Fi: 500 mobs at 55+ fps** and the drag feels responsive. Decision recorded: continue or switch engine. |
| M1.5 | Capacitor Android wrap, only after the gate passes: `android/` project, portrait lock, safe-area insets, pause/resume, `src/platform` | `npm run android` installs and launches in portrait on the phone. Back button and app-switch behave. Device screenshot attached. |
| M2 | Gates: `mul` and `add` gates with world-space numbers, trigger-once logic | Unit tests for gate math. A ×3 then ×4 chain turns 1 unit into 12. |
| M3 | Red horde, waves, blue vs red combat, base hp, lose state with red vignette | 2,000 combined units at 45+ fps on the phone. Seeded headless sim run is deterministic. |
| M4 | Guardian towers (HP number, reward) and bosses with HP bars, win state | A full level is winnable and losable. Rewards apply correctly. |
| M5 | Tiers and "LV+1" pickup, hit sparks, muzzle flash, screen shake, SFX, native haptics | Upgrades change stats and visuals. No frame-time regression versus M4 on device. |
| M6 | Level JSON (5 levels), menu, win/lose screens, durable saves, app icon and splash, signed release build | Signed Android App Bundle installs from a Play internal testing track. Privacy policy drafted. Stable on a mid-range phone for a 10-minute session. iOS only if a Mac is available. |

## 7. Verification strategy
- Headless sim tests: run 60 s of game time at maximum speed and assert no NaN, no negative hp, and that unit counts are conserved through gates.
- Playwright smoke test in a 390×844 viewport: load, drag the cannon, screenshot, assert an fps floor.
- M0 and M1 Walkthroughs include browser screenshots with the debug-overlay numbers. From the M1 gate onward, each Walkthrough also includes a screenshot from the phone with the overlay visible.

## 8. Out of scope for v0
Online features, ads, in-app purchases, accounts, leaderboards, meta-progression shop, localisation, skeletal character animation, iOS release.

## 9. Open questions (agent must ask before assuming)
1. Is your vivo V21e the 5G (Dimensity 700) or the 4G (Snapdragon 720G) model? (Settings → About phone.)
2. Do you have a Mac for iOS later, or Android only?
3. Primitives for models until M5, or import a CC0 pack in M1?
4. Final game name and art direction (must be original).

## 10. IP note
The mechanic (shoot units through multiplier gates against a horde) is a genre pattern. The name, logo, characters and art in the video belong to the original publisher. Use an original name and original or CC0 assets.
