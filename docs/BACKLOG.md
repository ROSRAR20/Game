# Backlog — Swarm Gate

Tracked technical debt, deferred features, and optimization opportunities.

## Milestone Backlog

### Milestone M1 (Core Loop & Gate)
- [x] Connect draggable cannon auto-firing blue mobs to fixed-timestep simulation.
- [x] Implement SoA mob pool with zero-allocation recycling.
- [x] Perform M1 go/no-go gate testing on vivo V21e via local Wi-Fi (PASSED: 60 fps at 2000 mobs, dpr=1).

### Milestone M1.5 (Android Shell)
- [x] Initialize Capacitor Android project shell (`npx cap add android`) with `appId: com.rosra.swarmgate`.
- [x] Setup app lifecycle handling (`@capacitor/app`) to pause sim on background and resume on return.
- [x] Implement Android back-button handler.
- [x] Configure status bar overlay and splash screen (`@capacitor/status-bar`, `@capacitor/splash-screen`).
- [x] Lock portrait orientation (`android:screenOrientation="portrait"`).
- [ ] Build and verify on device / APK assembly.

### Milestone M2 (Gates & Clone Logic)
- [ ] Implement flat banner gate meshes with cached 2D canvas numeral textures.
- [ ] Implement clone inheritance (`lastGateId = gate.id`) and post-plane placement ($z_{\text{gate}} + 0.1$).
- [ ] Implement cap overflow handling via unit `weight`.

### Milestone M3 (Red Horde & Combat)
- [ ] Implement uniform 2D spatial hash grid for blue vs red proximity collisions.
- [ ] Implement wave spawning logic from $Z = 90$.
- [ ] Base breach vignette and lose condition.

### Milestone M4 (Towers & Bosses)
- [ ] Stationary guardian towers with numeric HP counter meshes.
- [ ] Boss HP bar widgets and destruction reward mob bursts.
- [ ] Level win condition.

### Milestone M5 (Visual Juice, Audio & Haptics)
- [ ] Install `@capacitor/haptics` and wire tactile feedback on gate pass and boss hits.
- [ ] Cannon tier upgrade (`LV+1`) with altered visuals and fire rate.
- [ ] Low-poly character models and muzzle/spark particle systems.
- [ ] WebAudio sound effects (shot, gate chime, impact, explosion).

### Milestone M6 (Levels, Persistence & Release)
- [ ] Install `@capacitor/preferences` and build durable save system.
- [ ] 5 JSON levels with schema validation.
- [ ] Start menu, victory screen, game over screen.
- [ ] Generate signed release AAB.
