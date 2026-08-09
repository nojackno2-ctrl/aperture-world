# Aperture World

A browser-based, full-screen photography practice game built with React, Vinext, and Three.js. It provides eleven procedural 3D scenes, Sony-style exposure controls, autofocus and metering, moving subjects, burst shooting, image capture, and a local photo library.

## Requirements

- Node.js 22.13 or newer
- A WebGL2-capable browser; hardware acceleration is strongly recommended

## Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vinext.

## Validation

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
```

`npm test` creates the production Vinext build and runs the product-level rendered HTML, optics, exposure, motion, and performance tests.

## Architecture

- `app/page.tsx` owns the camera controls, exposure state, shooting workflow, and UI.
- `app/viewport.tsx` owns the Three.js renderer, render scheduling, metering, autofocus, capture, and GPU resource lifecycle.
- `app/scene3d.mjs` builds and batches the eleven procedural 3D worlds.
- `app/motion.mjs` defines deterministic moving-subject routes and exposure samples.
- `app/world.mjs`, `app/optics.mjs`, and `app/performance.mjs` contain physical camera, scene, and adaptive-rendering calculations.
- `.openai/hosting.json`, `worker/`, and `build/` contain the private Sites deployment surface.

## Performance contract

- Scene contents, placement, routes, lighting, metering, and camera behavior are product behavior and must remain unchanged during optimization.
- The live renderer follows the measured display refresh rate up to 120 FPS and adapts pixel ratio within a bounded GPU budget.
- Frozen views stop scheduling frames and resume only when the view or visibility changes.
- Static geometry and rigid moving-subject parts are batched without replacing 3D objects with bitmap shortcuts.

Do not describe a 75 Hz measurement as proof of 120/144 Hz performance. Do not publish or deploy local changes without explicit authorization.
