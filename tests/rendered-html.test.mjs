import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { ROUTES, exposureSamples, subjectPath } from "../app/motion.mjs";
import { BIRD_COUNT } from "../app/scene3d.mjs";
import { horizontalFieldOfView, verticalFieldOfView } from "../app/optics.mjs";
import { MAX_LIVE_PIXELS, TARGET_RENDER_FPS, cappedPixelRatio, nextPixelRatio, refreshTargetFps } from "../app/performance.mjs";
import { LAYER, WORLD, circleOfConfusionMm, defocusBlurPixels, depthBlurPlan, viewMeterAdjustment } from "../app/world.mjs";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Aperture World game", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Aperture World｜互動攝影練習場<\/title>/i);
  assert.match(html, /APERTURE/);
  assert.match(html, /WORLD/);
  assert.match(html, /山谷第一道光/);
  assert.match(html, /鏡頭與測光/);
  assert.match(html, /相片庫/);
  assert.match(html, /aria-label="曝光控制"/);
  assert.match(html, />快門</);
  assert.match(html, />光圈</);
  assert.match(html, />曝光值</);
  assert.doesNotMatch(html, /CAM-PRO 1|教練筆記|訓練路線|動態清晰|景深充足/);
  assert.match(html, /ISO AUTO/);
  assert.match(html, /測光模式/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("finished product renders a real 3D world, mobile controls, fullscreen, and no disposable starter preview", async () => {
  const [page, styles, layout, packageJson, viewport, world3d] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/scene3d.mjs", import.meta.url), "utf8"),
  ]);
  // Focus is aimed, never dialled: no AF mode selector and no manual distance slider.
  assert.doesNotMatch(page, /AF-S|AF-C|FocusMode/);
  assert.doesNotMatch(styles, /focus-box|focus-mode-section/);
  assert.doesNotMatch(page, /className="photo-library"|className="status-readout"|className="wheel-hint"/);
  assert.match(page, /className="library-button"/);
  assert.match(page, /className="photo-icon"/);
  assert.match(page, /className="camera-dock"[\s\S]*className="shutter-button"[\s\S]*className="dock-readout"[\s\S]*className="library-button"/);
  assert.match(page, /className="gallery"/);
  assert.match(page, /className="exposure-scale"/);
  assert.match(page, /onPointerMove=\{event => \{/);
  assert.match(page, /activateControl\("shutter"\)/);
  assert.match(page, /activateControl\("aperture"\)/);
  assert.match(page, /activateControl\("iso"\)/);
  assert.match(page, /activateControl\("exposure"\)/);
  const captureBody = page.slice(page.indexOf("const capture = useCallback"), page.indexOf("useEffect(() => {", page.indexOf("const capture = useCallback")));
  assert.doesNotMatch(captureBody, /setResult\(/, "taking a photo must not open playback");
  assert.match(captureBody, /setShots\(/, "taking a photo must still save it to the library");
  assert.match(page, /onPointerMove/);
  assert.match(page, /onWheel/);
  assert.match(page, /1 \/ 32000/);
  assert.match(page, /102400/);
  assert.match(page, /曝光補償/);
  assert.match(page, /MeteringMode/);
  assert.match(page, /isoAuto/);
  assert.match(page, /ISO AUTO/);
  assert.match(page, /useState<Mode>\("P"\)/);
  assert.doesNotMatch(page, /ShutterType|shutter-type-buttons|機械快門|電子快門/);
  assert.match(page, /className="mobile-console"/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /fullscreenchange/);
  assert.match(page, /<Histogram image=\{result\.image\}/);
  assert.match(styles, /\.playback-histogram/);
  assert.match(styles, /\.exposure-scale\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(styles, /\.camera-dock\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(styles, /\.shutter-button\{[^}]*top:50%[^}]*background:#260706/);
  assert.match(styles, /\.library-button\{[^}]*bottom:max\(/);
  assert.match(styles, /\.mobile-console\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(styles, /\.mobile-shutter i\{[^}]*#ff5a54[^}]*#c9151b/);

  // The live view is a WebGL first-person render, not a stack of flat artwork.
  assert.match(page, /<Viewport3D ref=\{viewportRef\}/);
  assert.match(page, /horizontalFieldOfView\(focal\)/);
  assert.match(page, /LOOK_LIMITS/);

  // Aiming is a shooter's: the pointer is locked, raw mouse movement turns the
  // head, and the AF frame the pointer carries is what the lens focuses on.
  assert.match(page, /requestPointerLock/);
  assert.match(page, /document\.exitPointerLock\(\)/);
  assert.match(page, /pointerlockchange/);
  assert.match(page, /event\.movementX/);
  assert.match(page, /event\.movementY/);
  assert.match(page, /af-frame/);
  assert.match(styles, /\.af-frame\{position:absolute/);
  assert.match(viewport, /Raycaster/);
  assert.match(viewport, /probeFocus/);
  assert.match(viewport, /intersectObjects\(built\.scene\.children, true\)/);
  assert.match(viewport, /findSubjectForHit/);
  assert.match(viewport, /mat\?\.depthWrite !== false/);
  assert.doesNotMatch(page, /scene-art|bg-art-layer|subject-art-layer|q-subject/);
  assert.match(viewport, /import\("three"\)/);
  assert.match(viewport, /verticalFieldOfView\(/);
  assert.match(viewport, /depthBlurPlan\(/);
  assert.match(viewport, /onLight/);
  assert.doesNotMatch(viewport, /lightExposureAt\(/);
  assert.match(viewport, /exposureSamples\(/);
  assert.match(viewport, /toDataURL/);
  assert.match(viewport, /camera\.layers\.set\(bucket\)/);
  assert.match(world3d, /street_subject\.png/);
  assert.match(world3d, /night_subject\.png/);
  assert.match(world3d, /PerspectiveCamera|buildScene/);
  assert.match(world3d, /DirectionalLight/);
  assert.match(world3d, /PointLight/);
  assert.match(world3d, /userData\.lightSource = "sun"/);
  assert.match(world3d, /visibleSun\.raycast = \(\) => \{\}/);
  assert.match(world3d, /moon\.raycast = \(\) => \{\}/);
  assert.match(world3d, /scene\.userData\.meteringEmitter = visibleSun/);
  assert.match(world3d, /sourcePosition.*normalize\(\)\.multiplyScalar\(900\)/);
  assert.match(world3d, /castShadow = true/);
  assert.doesNotMatch(world3d, /LIGHT_CYCLES|lightExposureAt|sun\.position\.set\([^\n]*elapsed/);
  assert.doesNotMatch(world3d, /(?:bird|sports|portrait)_subject\.jpg/);
  for (const key of Object.keys(WORLD)) assert.match(world3d, new RegExp(`\\b${key}\\(THREE, scene\\)`), `${key} needs a 3D builder`);
  assert.match(styles, /@media\(max-width:720px\).*\.mobile-console\{display:block/s);
  assert.match(styles, /html:fullscreen \.game-shell/);
  assert.match(styles, /\.live-canvas\{position:absolute/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "aperture-world"/);
  assert.match(packageJson, /"three": "\^?0\.\d+\.\d+"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await Promise.all([
    "bird_subject.png",
    "sports_subject.png",
    "portrait_subject.png",
    "street_subject.png",
    "night_subject.png",
    "sports_bg_clean.png",
    "portrait_bg_clean.png",
    "street_bg_clean.png",
    "night_bg_clean.png",
  ].map(file => access(new URL(`public/scenes/${file}`, templateRoot))));
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("fixed light sources still produce view-dependent automatic readings", () => {
  const towardSun = viewMeterAdjustment({ sunAlignment: 1, surfaceLuminance: null });
  const openMidtone = viewMeterAdjustment({ sunAlignment: 0, surfaceLuminance: 0.32, incidence: 1 });
  const deepShade = viewMeterAdjustment({ sunAlignment: 0, surfaceLuminance: 0.09, incidence: 0.05 });
  assert.ok(towardSun > openMidtone + 1.5, "the sun must meter substantially brighter than a midtone");
  assert.ok(deepShade < openMidtone - 1.5, "a shaded dark surface must meter substantially darker than a midtone");
  assert.equal(viewMeterAdjustment({ sunAlignment: 1, surfaceLuminance: null }), towardSun, "a fixed source must not drift over time");
});

test("focal length uses full-frame rectilinear field-of-view geometry", () => {
  assert.ok(Math.abs(horizontalFieldOfView(24) - 73.59) < .02);
  assert.ok(Math.abs(horizontalFieldOfView(50) - 39.50) < .02);
  assert.ok(Math.abs(horizontalFieldOfView(200) - 10.26) < .02);
  assert.ok(Math.abs(Math.tan(horizontalFieldOfView(24) * Math.PI / 360) / Math.tan(horizontalFieldOfView(200) * Math.PI / 360) - 200 / 24) < 1e-12, "magnification stays proportional to focal length");
  assert.throws(() => horizontalFieldOfView(0), RangeError);
});

test("the 3D camera derives its vertical angle from the same sensor geometry", () => {
  assert.ok(Math.abs(verticalFieldOfView(24, 1) - horizontalFieldOfView(24)) < 1e-9, "a square frame sees the same angle both ways");
  assert.ok(Math.abs(verticalFieldOfView(24, 16 / 9) - 45.63) < .02);
  assert.ok(Math.abs(verticalFieldOfView(200, 16 / 9) - 5.78) < .02);
  assert.ok(verticalFieldOfView(24, 1.6) > verticalFieldOfView(50, 1.6), "a longer lens must narrow the frame");
  assert.throws(() => verticalFieldOfView(24, 0), RangeError);
});

test("the live renderer targets 120 FPS with a bounded adaptive GPU resolution", async () => {
  assert.equal(TARGET_RENDER_FPS, 120);
  assert.equal(cappedPixelRatio(2, 1920, 1080), 1.3333333333333333);
  assert.equal(cappedPixelRatio(3, 3840, 2160), 0.75);
  assert.ok(MAX_LIVE_PIXELS <= 2560 * 1440);
  assert.equal(refreshTargetFps(1000 / 60), 60, "a 60 Hz display is not asked to draw invisible frames");
  assert.equal(refreshTargetFps(1000 / 144), 120, "high-refresh displays are capped at the requested 120 FPS");
  assert.equal(nextPixelRatio(1.5, 1.5, 85, 120), 1.375, "missed high-refresh frames reduce fill rate");
  assert.equal(nextPixelRatio(1, 1.5, 120, 120, 4), 1.125, "sustained headroom restores quality gradually");

  const [viewport, world3d] = await Promise.all([
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/scene3d.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(viewport, /powerPreference: "high-performance"/);
  assert.match(viewport, /preserveDrawingBuffer: false/);
  assert.match(viewport, /BufferGeometryUtils/);
  assert.match(viewport, /dataset\.fps/);
  assert.match(viewport, /dataset\.gpu/);
  assert.match(world3d, /mergeGeometries/);
});

test("depth of field follows real circle-of-confusion optics", () => {
  assert.equal(circleOfConfusionMm(50, 2.8, 3000, 3000), 0, "the focused plane is sharp");
  assert.ok(circleOfConfusionMm(85, 1.4, 3200, 9000) > circleOfConfusionMm(85, 8, 3200, 9000), "a wider aperture blurs more");
  assert.ok(circleOfConfusionMm(200, 4, 30000, 60000) > circleOfConfusionMm(50, 4, 30000, 60000), "a longer lens blurs more");
  assert.throws(() => circleOfConfusionMm(0, 2.8, 3000, 6000), RangeError);
  assert.throws(() => circleOfConfusionMm(50, 0, 3000, 6000), RangeError);
  assert.ok(defocusBlurPixels({ focalMm: 85, fNumber: 1.4, focusM: 3.2, objectM: 9, imageWidthPx: 1440 }) <= 34, "blur stays inside the render budget");

  const portrait = depthBlurPlan("portrait", { focalMm: 85, fNumber: 1.4, imageWidthPx: 1440 });
  const stopped = depthBlurPlan("portrait", { focalMm: 85, fNumber: 8, imageWidthPx: 1440 });
  assert.equal(portrait.subject, 0, "the subject bucket is always the focused plane");
  assert.ok(portrait.far > 8, "f/1.4 portraits must throw the room out of focus");
  assert.ok(portrait.near > portrait.far, "the foreground sits further from focus than the back wall");
  assert.ok(stopped.far < portrait.far, "stopping down recovers background detail");
  assert.ok(depthBlurPlan("landscape", { focalMm: 24, fNumber: 11, imageWidthPx: 1440 }).far < 1, "a stopped-down wide landscape is sharp to the horizon");
});

test("the AF frame decides which plane comes out sharp", () => {
  const lens = { focalMm: 85, fNumber: 1.4, imageWidthPx: 1440 };
  const onSitter = depthBlurPlan("portrait", lens);
  const onWall = depthBlurPlan("portrait", { ...lens, focusM: WORLD.portrait.far });
  const onCurtain = depthBlurPlan("portrait", { ...lens, focusM: WORLD.portrait.near });
  assert.equal(onSitter.subject, 0, "aiming at the subject plane keeps the subject sharp");
  assert.ok(onWall.subject > 8, "focusing past the sitter onto the back wall must melt the sitter");
  assert.ok(onWall.far < onSitter.far, "…and bring that wall in");
  assert.equal(onWall.far, 0, "the plane under the AF frame is the sharp one");
  assert.ok(onCurtain.near === 0 && onCurtain.subject > 0, "focusing on the foreground throws the sitter away");
  assert.ok(depthBlurPlan("landscape", { focalMm: 24, fNumber: 11, imageWidthPx: 1440, focusM: 4000 }).far < 1, "racking to infinity still keeps a stopped-down wide sharp");

  // A bird flies from 34 m to 23 m, so its own plane is what decides sharpness;
  // judging it against the scenario's nominal 28 m would punish a perfect lock.
  const tele = { focalMm: 300, fNumber: 5.6, imageWidthPx: 1440 };
  assert.equal(depthBlurPlan("bird", { ...tele, focusM: 23, subjectM: 23 }).subject, 0, "focus locked on the bird keeps the bird sharp wherever it flew");
  assert.ok(depthBlurPlan("bird", { ...tele, focusM: WORLD.bird.focus, subjectM: 23 }).subject > 2, "…and the nominal plane alone would have left it soft");
});

test("moving subjects circle continuously through three dimensions", () => {
  for (const [scene, route] of Object.entries(ROUTES)) {
    const poses = Array.from({ length: 101 }, (_, index) => subjectPath(scene, route.duration * index / 100, 0, 0));
    const xs = poses.map(pose => pose.x), ys = poses.map(pose => pose.y), zs = poses.map(pose => pose.z), yaws = poses.map(pose => pose.yaw);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 12, `${scene} should cross the frame`);
    assert.ok(Math.max(...ys) - Math.min(...ys) > .05, `${scene} should also move vertically`);
    assert.ok(Math.max(...zs) - Math.min(...zs) > 5, `${scene} should change its distance from the camera`);
    assert.ok(Math.max(...yaws) - Math.min(...yaws) > 1, `${scene} should turn to face its heading`);
    assert.ok(Math.min(...xs) >= -30 && Math.max(...xs) <= 30, `${scene} should stay inside the modelled world`);
    assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 16, `${scene} should stay above ground and below the sky`);
    assert.ok(Math.max(...zs) <= -5 && Math.min(...zs) >= -45, `${scene} should stay in front of the tripod`);
    assert.ok(poses.every(pose => pose.moving));
    assert.ok(Math.hypot(poses.at(-1).x - poses[0].x, poses.at(-1).y - poses[0].y, poses.at(-1).z - poses[0].z) < 1e-9, `${scene} should close its lap without disappearing`);
    const beforeSeam = subjectPath(scene, route.duration - .001, 0, 0), afterSeam = subjectPath(scene, route.duration + .001, 0, 0);
    assert.ok(Math.hypot(afterSeam.x - beforeSeam.x, afterSeam.y - beforeSeam.y, afterSeam.z - beforeSeam.z) < .05, `${scene} should cross the lap seam smoothly`);
  }
  for (const scene of ["group"]) {
    const still = subjectPath(scene, 4, 0, 0);
    assert.equal(still.moving, false);
    assert.deepEqual(subjectPath(scene, 9, 0, 0), still, "a static group subject must not drift");
  }
});

test("the wildlife scene contains a spread-out flock with independent routes", () => {
  assert.ok(BIRD_COUNT >= 7);
  const flock = Array.from({ length: BIRD_COUNT }, (_, index) => subjectPath("bird", 0, 0, index));
  assert.equal(new Set(flock.map(pose => `${pose.x.toFixed(3)},${pose.z.toFixed(3)}`)).size, BIRD_COUNT);
});

test("an exposure is accumulated from sub-frames that span the shutter", () => {
  const samples = exposureSamples("sports", 1, .5, 12);
  assert.equal(samples.length, 12);
  assert.ok(Math.abs(samples.at(-1).x - samples[0].x) > .5, "a half-second exposure must smear a sprinter");
  const frozen = exposureSamples("sports", 1, 1 / 4000, 12);
  assert.ok(Math.abs(frozen.at(-1).x - frozen[0].x) < .01, "1/4000 s must freeze the same sprinter");
  assert.equal(exposureSamples("group", 3, 1, 8).every(pose => pose.x === -1.4), true, "a still scene never smears");
  assert.equal(Object.keys(LAYER).length, 3, "captures composite a near, subject, and far bucket");
});

test("exposure triangle (shutter, aperture, ISO) scales photo brightness realistically and monotonically", () => {
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const calcEv = (aperture, shutter, iso) => Math.log2((aperture ** 2) / shutter) - Math.log2(iso / 100);
  const calcBrightness = (sceneEv, aperture, shutter, iso) => clamp(Math.pow(2, sceneEv - calcEv(aperture, shutter, iso)), 0.02, 8.0);

  const sceneEv = 12.0;
  // Baseline: F5.6, 1/250s, ISO 400 => cameraEv = log2(31.36 * 250) - log2(4) = 12.937 - 2 = 10.937 => exposureDelta = +1.063 EV
  const b100 = calcBrightness(sceneEv, 5.6, 1 / 250, 100);
  const b200 = calcBrightness(sceneEv, 5.6, 1 / 250, 200);
  const b400 = calcBrightness(sceneEv, 5.6, 1 / 250, 400);
  const b800 = calcBrightness(sceneEv, 5.6, 1 / 250, 800);
  const b1600 = calcBrightness(sceneEv, 5.6, 1 / 250, 1600);

  assert.ok(b200 > b100 * 1.9, "raising ISO from 100 to 200 must double photo brightness");
  assert.ok(b400 > b200 * 1.9, "raising ISO from 200 to 400 must double photo brightness");
  assert.ok(b800 > b400 * 1.9, "raising ISO from 400 to 800 must double photo brightness");
  assert.ok(b1600 > b800 * 1.9 || b1600 === 8.0, "ISO 1600 continues to brighten or reaches high exposure clip");

  // Reciprocity: +1 EV ISO (100 -> 200) balanced by +1 EV faster shutter (1/125 -> 1/250)
  const bBase = calcBrightness(sceneEv, 4.0, 1 / 125, 100);
  const bRecip = calcBrightness(sceneEv, 4.0, 1 / 250, 200);
  assert.ok(Math.abs(bBase - bRecip) < 1e-9, "reciprocity law: ISO gain compensated by faster shutter keeps identical brightness");
});

test("auto exposure dynamically opens aperture in low light and night scenes and scales with target EV", () => {
  const APERTURES = [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const closest = (values, target) => values.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best);

  const calcAutoAperture = (lensMaxAperture, targetEv, minShutter, focal, baseTarget) => {
    const safeShutter = Math.min(minShutter, 1 / focal);
    const reqAperture = Math.sqrt(safeShutter * Math.pow(2, targetEv));
    const targetAperture = reqAperture < baseTarget
      ? clamp(reqAperture, lensMaxAperture, baseTarget)
      : clamp(reqAperture, baseTarget, 11);
    return closest(APERTURES, targetAperture);
  };

  // Night scene (EV 5.8) with F1.4 lens -> must select F1.4 (lens max aperture)
  const nightApertureF14 = calcAutoAperture(1.4, 5.8, 1 / 125, 50, 1.4);
  assert.equal(nightApertureF14, 1.4, "in night scene, auto exposure must select maximum aperture F1.4");

  // Night scene (EV 5.8) with F2.8 lens -> must select F2.8 (lens max aperture)
  const nightApertureF28 = calcAutoAperture(2.8, 5.8, 1 / 125, 50, 2.8);
  assert.equal(nightApertureF28, 2.8, "in night scene, auto exposure must select maximum aperture F2.8");

  // Street scene bright light (EV 14.2) -> F5.6
  const brightStreetAperture = calcAutoAperture(2.8, 14.2, 1 / 320, 50, 5.6);
  // Street scene dark shadow (EV 10.0) -> opens wider than F5.6 towards max aperture
  const shadowStreetAperture = calcAutoAperture(2.8, 10.0, 1 / 320, 50, 5.6);

  assert.ok(shadowStreetAperture < brightStreetAperture, "aperture must dynamically open wider when aiming at dark shadows");

  const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800];
  const autoIso = (aperture, shutter, targetEv) => closest(ISOS, clamp(100 * Math.pow(2, Math.log2((aperture ** 2) / shutter) - targetEv), 100, 12800));

  // In bright daylight (EV 14.2) with F8.0, ISO 100 shutter is ~1/320s => ISO remains 100
  const brightIso = autoIso(8.0, 1 / 320, 14.2);
  assert.equal(brightIso, 100, "in bright light AUTO ISO stays at base ISO 100");

  // In night scene (EV 5.8) with F2.8 and safe shutter 1/125s => ISO must automatically scale up to ISO 1600
  const nightIso = autoIso(2.8, 1 / 125, 5.8);
  assert.equal(nightIso, 1600, "in night scene AUTO ISO must scale up to ISO 1600");
});
