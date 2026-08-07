# AI Handoff

## Objective

Build a browser-based photography practice game for beginners with realistic camera controls and visible consequences for exposure, shutter speed, aperture, ISO, focus, and focal length.

## Current State

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

## Product Scope

- Scenarios: landscape, birds, sports, portrait, group photo, daylight, and night.
- Camera modes: Auto, Program AE, Shutter Priority, Aperture Priority, and Manual.
- Simulate exposure, motion blur, depth of field, noise, focal length, focus distance, and contextual coaching.
- Keep live view clean and render photographic effects only in captured-photo review.
- Support click-to-shoot, wheel zoom, lens selection with lens-specific focal ranges, keyboard, touch, and responsive layouts.
- Render near, subject, and far planes separately in captured review; autofocus locks the subject plane while manual focus uses the distance control.

## Next Steps

1. Commit the exact validated source.
2. Push, package, save, and privately deploy that exact version through Sites.
3. Record and open the deployed URL.
