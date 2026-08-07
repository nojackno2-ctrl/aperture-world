# AI Handoff

## Objective

Build a browser-based photography practice game for beginners with realistic camera controls and visible consequences for exposure, shutter speed, aperture, ISO, focus, and focal length.

## Current State

- Sony α1 exposure implementation passed a fresh production build and 2/2 product tests on 2026-08-07. The stale rendered-heading assertion was corrected, exposure compensation now retains exact 1/3 EV internal steps, and `git diff --check` passed.

- New Sites project initialized on 2026-08-07. Dependencies installed successfully.
- The starter has been replaced with a seven-scenario playable camera simulator.
- The user clarified that live view must remain visually normal; photographic effects appear only after shutter release.
- The user requested left-click shutter release, mouse-wheel zoom, interchangeable lenses, and a Sony-style information layout.
- The user additionally required AF-S/AF-C autofocus plus manual focus, and clearly separated foreground, subject, and background planes so aperture-driven depth of field is visually obvious.
- The virtual scene must extend beyond the viewfinder at every focal length; 24 mm wide angle must never reveal a scene boundary.
- Add an in-camera photo library that preserves and replays earlier shots with their original scene, settings, score, and rendered effects.
- Support click-and-drag camera panning independently from mouse-wheel focal-length zoom; a stationary click releases the shutter.
- Animate birds, athletes, and people continuously in live view so shutter-speed choices have an observable subject-motion consequence; freeze the captured playback frame and apply calculated motion blur.
- A bespoke social preview image was generated, visually checked, saved as `public/og.png`, and wired into request-host-derived Open Graph/X metadata.
- The starter preview files and `react-loading-skeleton` dependency have been removed.
- First production build attempt failed before compilation because the generated npm scripts used Unix-style inline environment-variable syntax under Windows. The scripts need a cross-platform correction before retrying.
- Moving subject positions were initially CSS-animation-only, so captured playback could instantiate the bird off-frame. Subject position must be part of the immutable photo snapshot.
- Build scripts were corrected to run cross-platform. A full production build then completed successfully on 2026-08-07.
- The generated starter tests were replaced with product-specific server-render and source-contract tests; these still need to be run.
- Product-specific tests passed 2/2 after a fresh production build on 2026-08-07.
- A private Sites project was created and its opaque project ID was persisted in `.openai/hosting.json`.
- Completion audit found the 24 mm canvas could still expose an edge at maximum drag. The scene was expanded to a large panorama and panning was constrained to a safe range; this change still needs a fresh test run.
- The wide-angle panorama safety fix, dynamic subject snapshot, photo library, camera modes, autofocus modes, lens switching, drag pan, wheel zoom, and product metadata all passed a fresh production build and 2/2 tests. `git diff --check` also passed.
- The user explicitly authorized creating the release commit and publishing the site on 2026-08-07.
- The first commit attempt was stopped by `git diff --cached --check` because `AGENTS.md` had an extra blank line at EOF. The whitespace issue was corrected before retrying; no commit was created by that attempt.
- Release commit `54f4612` was created and pushed successfully to the private Sites source repository.
- The first packaging attempt failed because Git Bash `tar` interpreted a `C:/...` archive path as a remote archive target. Retry with `/c/...` paths; the validated source and build were not changed.
- The path issue was corrected with `/c/...` Git Bash paths. Version 1 was saved from commit `8f37f2e`, privately deployed successfully, and opened at `https://aperture-world.gjhcy4gc52.chatgpt.site` on 2026-08-07.
- New objective on 2026-08-07: calibrate adjustable exposure controls to the original Sony α1 (ILCE-1), using Sony's official specification/help guide as the authority.
- Confirmed α1 still-photo reference limits: AUTO/P/A/S/M exposure modes; ISO 100–32000 with expanded ISO 50–102400 and AUTO ISO 100–12800; mechanical shutter 1/8000–30 s plus Bulb; electronic/Auto shutter up to 1/32000; exposure compensation ±5 EV (body dial ±3 EV); and Multi, Center-weighted, Spot, Entire Screen Average, and Highlight metering.
- Implemented α1-calibrated 1/3-step shutter speeds through 1/32000–30 s, ISO 50–102400, AUTO ISO limits, ±5 EV compensation, shutter-type limits, five metering modes, and lens-specific aperture ranges.
- Overhauled all 7 scenario visual art assets into high-resolution Q-version (chibi/kawaii anime illustration) artwork (`public/scenes/*.jpg`).
- Refactored `SceneArtwork` in `app/page.tsx` and updated `app/globals.css` to render multi-layer Q-version background & subject graphics with dynamic depth-of-field blur, motion blur, zooming, and camera panning.
- Fresh production build (`cmd /c npm run build`) and 2/2 test suites (`cmd /c npm test`) passed cleanly on 2026-08-07.
- Visual review of the redesigned Q-version artwork in the live local app found integration blockers: the 1024px subject JPGs retain opaque white/card backgrounds, sports and portrait therefore render as floating white panels, the bird subject is outside the visible default crop, and the oversized `.scene-art` canvas magnifies/crops the 16:9 backgrounds enough to lose composition and apparent sharpness. The source art itself is visually strong; asset transparency, subject placement, and background canvas scaling need correction before release.
- Artwork integration fix in progress: generated and alpha-validated transparent PNG subjects for bird, sports, portrait, street, and night scenes; created clean subject-free backgrounds for portrait, street, and night; removed real Olympic/Tokyo branding from the sports background; changed focal-length rendering to a bounded logarithmic visual zoom; reduced wide-angle pan limits; and added independent street/night subject animation. Live and captured visual verification still pending.
- First post-artwork production build succeeded. The first product-test run passed server rendering but failed the new asset-existence assertion because its test URL incorrectly traversed one directory above the project (`../public` relative to an already-rooted base). The test path was corrected to `public/scenes`; product behavior was not implicated. Fresh validation pending.
- Artwork integration completed and verified on 2026-08-07. Fresh production build and 2/2 product tests passed; `git diff --check` passed; all five subject assets were verified as RGBA with alpha extrema 0–255; live visual review confirmed no white cards or visible green fringe; sports captured playback froze the subject and applied the calculated background blur; and geometric browser checks confirmed bird, sports, portrait, street, and night subject bounds all remained inside the viewfinder at the tested state.
- The user authorized the online update. Release commit `6e4cac1` was pushed, Sites version 2 was saved from that exact commit, and the private production deployment succeeded at `https://aperture-world.gjhcy4gc52.chatgpt.site` on 2026-08-07.

## Product Scope

- Scenarios: landscape, birds, sports, portrait, group photo, daylight, and night (all recreated in cute Q-version illustration style).
- Camera modes: Auto, Program AE, Shutter Priority, Aperture Priority, and Manual.
- Simulate exposure, motion blur, depth of field, noise, focal length, focus distance, and contextual coaching.
- Keep live view clean and render photographic effects only in captured-photo review.
- Support click-to-shoot, wheel zoom, lens selection with lens-specific focal ranges, keyboard, touch, and responsive layouts.
- Render near, subject, and far planes separately in captured review; autofocus locks the subject plane while manual focus uses the distance control.

## Next Steps

1. Collect user feedback on the deployed corrected layered artwork.
2. Keep future visual changes within the layered-artwork and verified camera-behavior constraints above.
