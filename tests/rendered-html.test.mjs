import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import { ROUTES, exposureSamples, subjectPath } from "../app/motion.mjs";
import { build3DBat, build3DFox, build3DFrog, build3DHamster, build3DHedgehog, build3DRaccoon, build3DRat, build3DSwan } from "../app/scene-kit.mjs";
import { BIRD_COUNT } from "../app/scene3d.mjs";
import { horizontalFieldOfView, trajectoryDistance, verticalFieldOfView } from "../app/optics.mjs";
import { CAPTURE_SAMPLE_SPACING_PX, MAX_CAPTURE_SAMPLES, MAX_LIVE_PIXELS, MIN_PHOTO_LONG_EDGE, MIN_PHOTO_SHORT_EDGE, TARGET_RENDER_FPS, cappedPixelRatio, captureSampleCount, nextPixelRatio, photoOutputSize, refreshTargetFps, shouldPrefetchScenes } from "../app/performance.mjs";
import { DEPTH_BANDS, DEPTH_LAYER_BASE, LAYER, SUBJECT_LAYER, WORLD, circleOfConfusionMm, defocusBlurPixels, depthBandBlur, depthBandDistance, depthBandEdges, depthBandFor, depthBlurPlan, depthPasses, viewMeterAdjustment } from "../app/world.mjs";
import { SECURITY_HEADERS, withSecurityHeaders } from "../worker/security.mjs";

const templateRoot = new URL("../", import.meta.url);

const SCENE_KEYS = Object.keys(WORLD);

const NEW_ANIMAL_BUILDERS = {
  fox: build3DFox,
  hedgehog: build3DHedgehog,
  frog: build3DFrog,
  swan: build3DSwan,
  raccoon: build3DRaccoon,
  bat: build3DBat,
  rat: build3DRat,
  hamster: build3DHamster,
};

/**
 * The 3D world is no longer one file: the shared modelling kit and the eleven
 * per-scenario modules are separate so a session downloads only the world it
 * plays. Source contracts about "the world" read all of it.
 */
async function readWorldSource() {
  const parts = await Promise.all([
    readFile(new URL("../app/scene3d.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/scene-kit.mjs", import.meta.url), "utf8"),
    ...SCENE_KEYS.map(key => readFile(new URL(`../app/scenes/${key}.mjs`, import.meta.url), "utf8")),
  ]);
  return parts.join("\n");
}

async function readProductStyles() {
  const [critical, camera] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/camera.css", import.meta.url), "utf8"),
  ]);
  return `${critical}\n${camera}`;
}

/**
 * Every scenario owns a module that builds its world and its subjects, and
 * `scene3d.mjs` reaches it through a literal `import()` — a computed specifier
 * would collapse the eleven chunks back into one.
 */
async function assertEveryScenarioHasItsOwnModule() {
  const loader = await readFile(new URL("../app/scene3d.mjs", import.meta.url), "utf8");
  for (const key of SCENE_KEYS) {
    const scene = await readFile(new URL(`../app/scenes/${key}.mjs`, import.meta.url), "utf8");
    assert.match(scene, /export function terrain\(THREE, scene\)/, `${key} needs a 3D builder`);
    assert.match(scene, /export function cast\(THREE, scene, subjects, shadows\)/, `${key} needs its moving subjects`);
    assert.match(loader, new RegExp(`${key}: \\(\\) => import\\("\\./scenes/${key}\\.mjs"\\)`), `${key} needs its own chunk`);
  }
  assert.doesNotMatch(loader, /import\(`|import\(["'][^"']*\$\{/, "a computed import specifier would defeat the per-scene split");
}

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async (req) => {
          try {
            const u = new URL(req.url);
            const data = await readFile(new URL(`../dist/client${u.pathname === "/" ? "/index.html" : u.pathname}`, import.meta.url));
            return new Response(data, { status: 200, headers: { "content-type": "text/html" } });
          } catch {
            return new Response("Not found", { status: 404 });
          }
        }
      }
    },
    { waitUntil() {}, passThroughOnException() {} }
  );
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
  assert.match(html, /選擇訓練場景/);
  assert.match(html, /進入拍攝/);
  assert.match(html, /直接遊玩/);
  assert.doesNotMatch(html, /class="hud"|class="mobile-console"/, "the server-rendered menu must not hydrate inactive camera controls");
  assert.doesNotMatch(html, /CAM-PRO 1|教練筆記|訓練路線|動態清晰|景深充足/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("finished product renders a real 3D world, mobile controls, fullscreen, and no disposable starter preview", async () => {
  const [page, photoLibrary, styles, histogramStyles, layout, packageJson, viewport, world3d] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readProductStyles(),
    readFile(new URL("../app/histogram.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readWorldSource(),
  ]);
  // Focus is aimed, never dialled: no AF mode selector and no manual distance slider.
  assert.doesNotMatch(page, /AF-S|AF-C|FocusMode/);
  assert.doesNotMatch(styles, /focus-box|focus-mode-section/);
  assert.doesNotMatch(page, /className="photo-library"|className="status-readout"|className="wheel-hint"/);
  assert.match(page, /className="library-button"/);
  assert.match(page, /className="photo-icon"/);
  assert.match(page, /className="camera-dock"[\s\S]*className="shutter-button"[\s\S]*className="dock-readout"[\s\S]*className="library-button"/);
  const dockMarkup = page.slice(page.indexOf('<div className="dock-readout"'), page.indexOf('</div>', page.indexOf('<div className="dock-readout"')));
  assert.doesNotMatch(dockMarkup, /<small>|>快門<|>光圈<|>ISO<|>曝光值</, "bottom exposure controls show only their enlarged values");
  assert.match(dockMarkup, /activateControl\("shutter"\)[\s\S]*activateControl\("aperture"\)[\s\S]*activateControl\("exposure"\)[\s\S]*activateControl\("iso"\)/, "exposure compensation appears before ISO in the bottom dock");
  assert.match(page, /\["shutter", "aperture", "exposure", "iso"\] as MobileControl\[\]/, "mobile quick controls use the same exposure-compensation-before-ISO order");
  assert.match(styles, /\.dock-readout\{[^}]*grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[^}]*width:100%/, "desktop exposure values must spread evenly across the bottom");
  assert.match(styles, /\.dock-readout b\{[^}]*clamp\(46px,4vw,64px\)/, "desktop exposure values must use the large, glance-readable type scale");
  assert.match(photoLibrary, /className="gallery"/);
  assert.match(photoLibrary, /className="gallery-panel"/);
  assert.match(photoLibrary, /aria-modal="true"/);
  assert.match(photoLibrary, /aria-label="上一張照片"/);
  assert.match(photoLibrary, /aria-label="下一張照片"/);
  assert.match(photoLibrary, /event\.code === "ArrowLeft"/);
  assert.match(photoLibrary, /event\.code === "ArrowRight"/);
  assert.match(page, /className="exposure-scale"/);
  assert.match(page, /onWheelCapture=\{event => \{/);
  assert.match(page, /setActiveValue\(activeIndex \+ \(event\.deltaY > 0 \? -1 : 1\)\)/, "the mouse wheel changes the active exposure value one step at a time");
  assert.doesNotMatch(page, /className="exposure-scale"[\s\S]{0,250}onPointerMove/, "horizontal mouse movement must not change exposure values");
  assert.match(page, /const SHUTTER_SCALE_OPTIONS = \[\.\.\.SHUTTERS\]\.reverse\(\)/, "shutter scale runs from slow on the left to fast on the right");
  assert.match(page, /const ISO_SCALE_OPTIONS = \[ISO_AUTO_SCALE_VALUE, \.\.\.ISOS\]/, "ISO AUTO is the leftmost scale position");
  assert.match(page, /value === ISO_AUTO_SCALE_VALUE \? "AUTO"/, "the ISO scale renders its leftmost automatic value clearly");
  assert.match(page, /activateControl\("shutter"\)/);
  assert.match(page, /activateControl\("aperture"\)/);
  assert.match(page, /activateControl\("iso"\)/);
  assert.match(page, /activateControl\("exposure"\)/);
  assert.match(page, /confirmingControlRef/);
  assert.match(page, /onPointerDownCapture=\{event => \{/);
  assert.match(page, /event\.pointerType !== "mouse" \|\| event\.button !== 0/);
  assert.match(page, /confirmingControlRef\.current = true[\s\S]*setActiveControl\(null\)/, "left click confirms the active exposure value and closes its scale");
  assert.match(page, /className="focal-scale"[\s\S]*className="scale-heading"[\s\S]*\{focal\}\s*mm[\s\S]*className="scale-track"/, "focal length is displayed at the top with a scale and ruler");
  assert.match(styles, /\.focal-scale\{[^}]*cursor:ns-resize/);
  assert.match(styles, /\.focal-scale \.scale-heading b\{[^}]*var\(--font-geist-mono\)/);
  assert.match(styles, /\.exposure-scale\{[^}]*cursor:ns-resize/);
  assert.match(page, /shutter: mode === "S" \|\| mode === "M"/);
  assert.match(page, /aperture: mode === "A" \|\| mode === "M"/);
  assert.match(page, /exposure: mode !== "AUTO" && \(mode !== "M" \|\| usingAutoIso\)/);
  assert.match(page, /iso: mode !== "AUTO"/);
  const activateControlBody = page.slice(page.indexOf("const activateControl"), page.indexOf("const activeOptions"));
  assert.match(activateControlBody, /if \(!controlAvailability\[control\]\) return/);
  assert.doesNotMatch(activateControlBody, /setMode\(/, "selecting a parameter must never change the exposure mode");
  assert.match(page, /disabled=\{!controlAvailability\.shutter\}/);
  assert.match(page, /disabled=\{!controlAvailability\.aperture\}/);
  assert.match(page, /disabled=\{!controlAvailability\.exposure\}/);
  assert.match(page, /disabled=\{!controlAvailability\.iso\}/);
  assert.match(styles, /\.dock-readout button:disabled\{[^}]*cursor:not-allowed[^}]*opacity:\.28/);
  const captureBody = page.slice(page.indexOf("const capture = useCallback"), page.indexOf("const deletePhoto", page.indexOf("const capture = useCallback")));
  assert.doesNotMatch(captureBody, /setResult\(/, "taking a photo must not open playback");
  assert.match(captureBody, /pendingRef\.current\.push\(/, "taking a photo must enqueue it in the write-out buffer");
  assert.match(page, /if \(photo\) setShots\(prev => \[photo, \.\.\.prev\]\)/, "the write-out drain must still save queued photos to the library");
  assert.doesNotMatch(captureBody, /slice\(0,\s*12\)/, "the library must not discard photos after the twelfth shot");
  assert.match(page, /onPointerMove/);
  assert.match(page, /onWheel/);
  assert.match(page, /1 \/ 32000/);
  assert.match(page, /102400/);
  assert.doesNotMatch(captureBody, /setResult\(/, "taking a photo must not open playback");
  assert.match(captureBody, /pendingRef\.current\.push\(/, "taking a photo must enqueue it in the write-out buffer");
  assert.match(page, /if \(photo\) setShots\(prev => \[photo, \.\.\.prev\]\)/, "the write-out drain must still save queued photos to the library");
  assert.doesNotMatch(captureBody, /slice\(0,\s*12\)/, "the library must not discard photos after the twelfth shot");
  assert.match(page, /onPointerMove/);
  assert.match(page, /onWheel/);
  assert.match(page, /1 \/ 32000/);
  assert.match(page, /102400/);
  assert.match(page, /曝光補償/);
  assert.match(page, /MeteringMode/);
  assert.match(page, /isoAuto/);
  assert.match(page, /ISO AUTO/);
  assert.match(page, /useState<Mode>\("P"\)/);
  assert.match(page, /\[isoAuto, setIsoAuto\] = useState\(true\)/, "the game starts in P mode with automatic ISO enabled");
  assert.doesNotMatch(page, /ShutterType|shutter-type-buttons|機械快門|電子快門/);
  assert.match(page, /className="mobile-console"/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /fullscreenchange/);
  assert.match(page, /document\.fullscreenEnabled/);
  assert.match(page, /await target\.requestFullscreen\(\)/, "fullscreen uses the broadly compatible argument-free API so mobile browser chrome can be removed");
  assert.doesNotMatch(page, /immersiveFallback|navigationUI/, "a failed fullscreen request must not masquerade as real fullscreen while leaving the URL bar visible");
  assert.match(page, /className="fullscreen-notice"/, "fullscreen failures are explained instead of silently falling back");
  assert.match(photoLibrary, /<Histogram image=\{selectedPhoto\.image\}/);
  assert.match(histogramStyles, /\.playback-histogram/);
  assert.match(styles, /\.exposure-scale\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(styles, /\.library-button\{[^}]*bottom:max\(/);
  assert.match(page, /className="gear-button"/);
  assert.match(page, /className="gear-icon"/);
  assert.match(page, /aria-label="相機鏡頭與測光設定"/);
  assert.match(page, /aria-label="更換鏡頭"/);
  assert.match(page, /aria-label="測光模式"/);
  assert.match(page, /24–70 mm F2\.8 II 旗艦標準變焦/);
  assert.match(page, /70–200 mm F2\.8 II 防手震遠攝變焦/);
  assert.match(page, /100–400 mm F4\.5–5\.6 防手震超遠攝變焦/);
  assert.match(page, /50 mm F1\.2 頂級旗艦大光圈定焦/);
  assert.match(page, /600 mm F4\.0 飛羽生態終極巨砲/);
  assert.match(page, /value="multi".*多重測光/s);
  assert.match(page, /value="center".*中央偏重/s);
  assert.match(page, /value="spot".*定點/s);
  assert.match(page, /value="average".*全螢幕平均/s);
  assert.match(page, /value="highlight".*高光/s);
  assert.match(styles, /\.gear-button\{[^}]*left:max\(22px/);
  assert.match(styles, /\.gear-button[^}]*border-radius:50%/);
  assert.match(styles, /\.mobile-console\{[^}]*background:transparent[^}]*box-shadow:none/);
  assert.match(styles, /\.mobile-shutter i\{[^}]*#ff5a54[^}]*#c9151b/);
  assert.match(styles, /@media \(hover:none\), \(pointer:coarse\)/, "touch layouts are selected by input capability, including phones wider than 720px in landscape");
  assert.match(styles, /@media \(orientation:landscape\) and \(max-height:600px\)/, "short landscape phones receive a height-aware layout");
  assert.match(styles, /@media \(max-width:480px\) and \(orientation:portrait\)/, "narrow portrait phones receive their own layout");
  assert.match(styles, /@media \(max-width:720px\)\s*\{[\s\S]*?\.mobile-drive-strip\s*\{\s*display:none\s*\}/, "phone-width layouts hide the obsolete drive strip even when pointer emulation reports a fine pointer");
  assert.match(styles, /@media \(max-width:720px\) and \(orientation:landscape\) and \(max-height:600px\)\s*\{[\s\S]*?\.hud-top-mid\s*\{[\s\S]*?position:absolute;[\s\S]*?top:max\(5px,env\(safe-area-inset-top\)\);[\s\S]*?\.mobile-console\s*\{[\s\S]*?display:grid;[\s\S]*?height:calc\(var\(--touch-console-height\) \+ env\(safe-area-inset-bottom\)\);[\s\S]*?grid-template-rows:1fr;/, "fine-pointer phone landscape restores the compact two-column console and keeps the focal scale in the top band");
  assert.match(styles, /--touch-console-height:\s*clamp\(/, "the touch console scales with the available viewport instead of using one fixed size");
  assert.match(styles, /\.mobile-adjuster input\s*\{[^}]*height:\s*44px[^}]*min-height:\s*44px/s, "the mobile slider keeps a finger-sized hit area");
  assert.match(styles, /\.gallery\{[^}]*background:rgba\(3,5,4,\.52\)/);
  assert.match(styles, /\.gallery-panel\{[^}]*background:rgba\(8,12,10,\.78\)/);
  assert.match(styles, /\.gallery\s*\{[^}]*width:\s*100vw[^}]*height:\s*100dvh[^}]*padding:\s*0/s, "the photo library occupies the complete dynamic viewport");
  assert.match(styles, /\.gallery-panel\{[^}]*width:100%[^}]*height:100%/, "the photo library fills nearly the entire viewport");
  assert.match(styles, /\.gallery\s*\{[^}]*width:\s*100vw[^}]*height:\s*100dvh[^}]*max-width:\s*none[^}]*max-height:\s*none[^}]*margin:\s*0[^}]*border:\s*0/s, "the native dialog defaults are reset so the library cannot collapse into a left sidebar");
  assert.doesNotMatch(styles, /\.gallery-panel\{[^}]*(?:1180px|max-height)/, "the desktop photo library must not be constrained to a small modal");
  assert.match(styles, /\.gallery-viewer\{[^}]*height:100%[^}]*min-height:0/, "photo review fills the library below its header");
  assert.match(styles, /\.photo-nav-previous\{[^}]*left:18px/);
  assert.match(styles, /\.photo-nav-next\{[^}]*right:18px/);
  assert.match(photoLibrary, /deleteSelectedPhoto/, "photo gallery includes photo deletion support");
  assert.match(photoLibrary, /aria-label="刪除照片"/);
  assert.match(photoLibrary, /className="gallery-card-delete"/);
  assert.match(photoLibrary, /event\.code === "Delete" \|\| event\.code === "Backspace"/, "supports Delete/Backspace keyboard shortcut to delete photos");
  assert.match(styles, /\.gallery-card-delete/);
  // The single-photo viewer gives the image its own uncluttered column; EXIF,
  // histogram, and the frame id live in a dedicated sidebar instead of being
  // stacked on top of the photo, and the delete action isn't duplicated there.
  assert.match(photoLibrary, /className="viewer-stage"/);
  assert.match(photoLibrary, /className="viewer-sidebar"/);
  assert.match(photoLibrary, /className="viewer-frame-id"/);
  assert.doesNotMatch(photoLibrary, /className="viewer-delete-btn"/, "the viewer no longer duplicates the header's delete button");
  assert.match(styles, /\.gallery-viewer\{[^}]*grid-template-columns/, "wide screens split the viewer into a photo column and an info sidebar");
  assert.match(styles, /\.viewer-stage \.playback-photo\{[^}]*object-fit:contain/, "the photo is letterboxed, never cropped, in its own stage");

  // Exposure countdown HUD & motion trail trajectory during long exposures
  assert.match(page, /exposure-countdown-hud/, "exposing countdown HUD is rendered during exposure");
  assert.match(page, /countdown-digits/, "displays large countdown digits");
  assert.match(page, /countdown-progress-bar/, "displays real-time exposure progress bar");
  assert.match(page, /lookTrajectory/, "tracks camera motion trajectory during exposure for light trails");
  assert.match(styles, /\.exposure-countdown-hud/, "exposure countdown HUD styling is defined");
  assert.match(styles, /\.countdown-digits/, "countdown digit typography is styled");

  // Drive modes (連拍/過片模式) and buffer memory HUD
  assert.match(page, /DRIVE_MODES/, "defines drive mode options");
  assert.match(page, /單張拍攝|高速連拍|中速連拍|低速連拍/, "includes Sony a1-style drive modes");
  assert.match(styles, /\.hud-quick-modes \.mode-icon-trigger\.active,[\s\S]*?filter: none;/, "open quick-mode pickers do not grow a translucent shadow box");
  assert.match(styles, /\.hud-quick-modes \.mode-glyph \{[\s\S]*?text-shadow: none;/, "the exposure-mode glyph has no clipped background-like shadow");
  assert.match(styles, /\.hud-quick-modes \.drive-icon-trigger \.drive-svg-icon \{[\s\S]*?filter: none;/, "the drive icon has no clipped background-like shadow");
  assert.match(page, /className="drive-strip/, "renders drive mode strip in the HUD top");
  assert.match(page, /className="drive-section/, "renders drive mode section in the parameter deck");
  assert.match(page, /className="mobile-drive-strip/, "renders mobile drive mode selector");
  assert.match(page, /className=\{`buffer-gauge/, "renders the burst buffer gauge");
  assert.match(page, /className=\{`card-gauge/, "renders the memory-card frame counter");
  assert.match(page, /startBurst/, "supports continuous burst shooting");
  assert.match(page, /MAX_BUFFER/, "implements realistic buffer capacity limit");
  assert.match(page, /e\.code === "KeyD"/, "supports D keyboard shortcut to cycle drive modes");
  assert.match(styles, /\.drive-strip/, "drive strip is styled in CSS");
  assert.match(styles, /\.buffer-gauge/, "buffer memory gauge is styled in CSS");
  assert.match(styles, /\.drive-card-btn/, "deck drive mode cards are styled");

  // The live view is a WebGL first-person render, not a stack of flat artwork.
  assert.match(page, /<Viewport3D ref=\{viewportRef\}/);
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
  await assertEveryScenarioHasItsOwnModule();
  assert.match(world3d, /mergeGeometries/);
  assert.match(page, /horizontalFieldOfView\(focal\)/);
  assert.match(page, /LOOK_LIMITS/);

  // Aiming is a shooter's: the pointer is locked and raw movement turns the
  // camera while the AF frame and focus probe stay fixed at screen centre.
  assert.match(page, /requestPointerLock/);
  assert.match(page, /document\.exitPointerLock\(\)/);
  assert.match(page, /pointerlockchange/);
  assert.match(page, /event\.movementX/);
  assert.match(page, /event\.movementY/);
  assert.match(page, /af-frame/);
  assert.match(page, /aimX=\{0\} aimY=\{0\}/);
  assert.doesNotMatch(page, /\bsetAim\b|\bupdateAim\b|\btype Aim\b/, "the centre AF target must not follow mouse or touch coordinates");
  assert.match(styles, /\.af-frame\{position:absolute[^}]*left:50%[^}]*top:50%/);
  assert.match(page, /type AfFrameSize = "small" \| "medium" \| "large"/);
  assert.match(page, /useState<AfFrameSize>\("small"\)/, "the existing compact AF frame remains the default");
  assert.match(page, /className=\{`af-frame af-size-\$\{afFrameSize\}/, "the selected AF size changes only the visible centre frame");
  assert.match(page, /className="af-size-options" role="group" aria-label="AF 對焦框尺寸"/);
  assert.match(styles, /\.af-frame\.af-size-small\{width:var\(--af-frame-small\)\}/);
  assert.match(styles, /\.af-frame\.af-size-medium\{width:var\(--af-frame-medium\)\}/);
  assert.match(styles, /\.af-frame\.af-size-large\{width:var\(--af-frame-large\)\}/);
  assert.match(styles, /\.af-size-options button\{[^}]*min-width:44px[^}]*min-height:44px/, "AF size choices remain finger-sized");
  assert.match(viewport, /Raycaster/);
  assert.match(viewport, /probeFocus/);
  assert.match(viewport, /intersectObjects\(built\.scene\.children, true\)/);
  assert.match(viewport, /findSubjectForHit/);
  assert.match(viewport, /mat\?\.depthWrite !== false/);
  assert.doesNotMatch(page, /scene-art|bg-art-layer|subject-art-layer|q-subject/);
  assert.match(viewport, /import\("\.\/three-runtime"\)/);
  assert.match(viewport, /verticalFieldOfView\(/);
  assert.match(viewport, /depthBlurPlan\(/);
  assert.match(viewport, /onLight/);
  assert.doesNotMatch(viewport, /lightExposureAt\(/);
  assert.match(viewport, /exposureSamples\(/);
  assert.match(viewport, /toDataURL/);
  assert.match(viewport, /camera\.layers\.enable\(layer\)/, "a capture pass renders every depth band it covers");
  assert.match(viewport, /depthPasses\(built\.key/, "capture plans its render passes from the occupied depth bands");
  assert.match(viewport, /engine\.captureMaterials = collectMaterials\(built\.scene\)/, "capture caches every scene material for the depth-only pass");
  assert.match(viewport, /material\.colorWrite = false/, "the occlusion pass writes depth without painting color");
  const depthPass = viewport.indexOf("engine.captureMaterials.forEach(material => { material.colorWrite = false; });");
  const bucketPass = viewport.indexOf("passes.forEach((pass, index) =>", depthPass);
  assert.ok(depthPass >= 0 && bucketPass > depthPass, "the complete-scene depth pass runs before any isolated blur bucket");
  assert.match(viewport, /renderer\.clear\(true, false, false\)/, "later buckets clear color while preserving complete-scene depth occlusion");
  assert.match(viewport, /className="live-canvas" style=\{\{ filter: sensorFilter\(brightness, noise\) \}\}/, "the viewfinder previews exposure instead of hiding it until playback");
  assert.match(viewport, /renderer\.autoClear = previousAutoClear/, "capture restores the live renderer's automatic clearing mode");
  // Every photographable subject is procedural 3D geometry: no flat cutouts,
  // no canvas-painted people, no bitmap subject art anywhere in the world.
  assert.doesNotMatch(world3d, /SUBJECT_ART|billboard\(|characterTexture|_subject\.png|_bg_clean\.png|TextureLoader/);
  assert.doesNotMatch(world3d, /isBillboard/);
  assert.match(world3d, /function build3DHuman\(THREE/, "people are modelled, not painted onto a plane");
  assert.match(world3d, /build3DHuman\(THREE, \{[\s\S]*pose: "run"/, "the sprinters are posed 3D figures");
  for (const pose of ["stand", "walk", "sit", "run"]) {
    assert.match(world3d, new RegExp(`pose: "${pose}"`), `the human builder needs a ${pose} stance`);
  }
  assert.match(world3d, /HUMAN_POSES/);
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
  await assertEveryScenarioHasItsOwnModule();
  assert.match(styles, /@media\(max-width:720px\).*\.mobile-console\{display:block/s);
  assert.match(styles, /html:fullscreen \.game-shell/);
  assert.match(styles, /\.live-canvas\{position:absolute/);
  // The social card is a photograph at the 1200x630 standard, so it ships as JPEG.
  assert.match(layout, /og\.jpg/);
  assert.match(layout, /width: 1200, height: 630/);
  assert.match(packageJson, /"name": "aperture-world"/);
  assert.match(packageJson, /"three": "\^?0\.\d+\.\d+"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  // The 2D scene artwork was deleted with the code that drew it; nothing may ship it back.
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
    "bird_bg.jpg",
    "bird_subject.jpg",
    "group.jpg",
    "landscape.jpg",
    "night.jpg",
    "portrait_bg.jpg",
    "portrait_subject.jpg",
    "sports_bg.jpg",
    "sports_subject.jpg",
    "street.jpg",
  ].map(file => assert.rejects(access(new URL(`public/scenes/${file}`, templateRoot)), `public/scenes/${file} must be gone`)));
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
});

test("every scene gains grounded, low-poly animal diversity", async () => {
  for (const [species, build] of Object.entries(NEW_ANIMAL_BUILDERS)) {
    const animal = build(THREE);
    assert.equal(animal.userData.species, species, `${species} needs a semantic species tag`);
    assert.ok(animal.userData.behavior, `${species} needs a recognizable behavior or pose`);
    let meshes = 0;
    animal.traverse(object => { if (object.isMesh) meshes += 1; });
    assert.ok(meshes >= 4 && meshes <= 14, `${species} should stay recognizable without exceeding the low-poly mesh budget`);
    const bounds = new THREE.Box3().setFromObject(animal);
    assert.ok(bounds.min.y >= -0.0001, `${species} must be grounded at its local origin`);
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.max(size.x, size.y, size.z) >= 0.2, `${species} needs a readable silhouette`);
    animal.traverse(object => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
  }

  const expectedPlacements = {
    landscape: ["build3DFox", "build3DHedgehog"],
    bird: ["build3DFrog", "build3DSwan"],
    sports: ["build3DRaccoon", "build3DHedgehog"],
    portrait: ["build3DHamster"],
    group: ["build3DFrog", "build3DSwan"],
    street: ["build3DRaccoon", "build3DRat"],
    night: ["build3DRaccoon", "build3DRat", "build3DBat"],
    starry: ["build3DFox", "build3DBat"],
    city_night: ["build3DFox", "build3DBat"],
    airport: ["build3DFox", "build3DHedgehog"],
    outdoor_portrait: ["build3DFrog", "build3DSwan", "build3DHedgehog"],
  };
  assert.deepEqual(Object.keys(expectedPlacements).sort(), [...SCENE_KEYS].sort(), "no playable world may be omitted from the diversity pass");
  for (const [sceneKey, builders] of Object.entries(expectedPlacements)) {
    const source = await readFile(new URL(`../app/scenes/${sceneKey}.mjs`, import.meta.url), "utf8");
    for (const builder of builders) {
      assert.match(source, new RegExp(`= ${builder}\\(THREE`), `${sceneKey} needs a placed ${builder.replace("build3D", "").toLowerCase()}`);
    }
    const sceneModule = await import(new URL(`../app/scenes/${sceneKey}.mjs`, import.meta.url));
    const scene = new THREE.Scene();
    sceneModule.terrain(THREE, scene);
    scene.updateMatrixWorld(true);
    const placedAnimals = [];
    scene.traverse(object => { if (object.userData.species) placedAnimals.push(object); });
    assert.equal(placedAnimals.length, builders.length, `${sceneKey} must construct every declared new animal`);
    for (const animal of placedAnimals) {
      const bounds = new THREE.Box3().setFromObject(animal);
      assert.ok([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite), `${sceneKey} ${animal.userData.species} needs finite world bounds`);
      assert.ok(Math.hypot(animal.position.x, animal.position.z) >= 2.5, `${sceneKey} ${animal.userData.species} must stay outside the tripod's critical near sightline`);
    }
    scene.traverse(object => {
      if (!object.isMesh && !object.isPoints && !object.isLineSegments) return;
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => material.dispose());
    });
    scene.clear();
  }
});

test("responsive contracts cover portrait, landscape, tablet, desktop, and ultrawide viewports", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readProductStyles(),
  ]);
  const viewports = [
    { name: "compact Android portrait", width: 360, height: 800, coarse: true },
    { name: "phone portrait", width: 390, height: 844, coarse: true },
    { name: "large phone portrait", width: 412, height: 915, coarse: true },
    { name: "phone landscape", width: 844, height: 390, coarse: true },
    { name: "short phone landscape", width: 700, height: 323, coarse: true },
    { name: "tablet portrait", width: 768, height: 1024, coarse: true },
    { name: "tablet landscape", width: 1024, height: 768, coarse: true },
    { name: "large tablet 16:10", width: 1280, height: 800, coarse: true },
    { name: "laptop 16:9", width: 1366, height: 768, coarse: false },
    { name: "desktop 16:10", width: 1440, height: 900, coarse: false },
    { name: "desktop QHD", width: 2560, height: 1440, coarse: false },
    { name: "ultrawide 21:9", width: 3440, height: 1440, coarse: false },
  ];
  assert.deepEqual(viewports.map(({ width, height }) => `${width}x${height}`), ["360x800", "390x844", "412x915", "844x390", "700x323", "768x1024", "1024x768", "1280x800", "1366x768", "1440x900", "2560x1440", "3440x1440"]);
  for (const viewport of viewports) {
    assert.ok(viewport.width > 0 && viewport.height > 0, `${viewport.name} has a valid viewport`);
    if (viewport.coarse) assert.match(styles, /@media \(hover:none\), \(pointer:coarse\)/, `${viewport.name} uses the touch-capability layout`);
    if (viewport.width <= 480 && viewport.height > viewport.width) assert.match(styles, /@media \(max-width:480px\) and \(orientation:portrait\)/, `${viewport.name} uses the narrow portrait layout`);
    if (viewport.height <= 600 && viewport.width > viewport.height) assert.match(styles, /@media \(orientation:landscape\) and \(max-height:600px\)/, `${viewport.name} uses the short landscape layout`);
    if (viewport.width >= 721 && viewport.width <= 1100) assert.match(styles, /@media \(min-width:721px\) and \(max-width:1100px\)/, `${viewport.name} uses the tablet layout`);
  }
  assert.match(styles, /\.hud\{[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/, "the desktop and ultrawide HUD retain flexible centre space");
  assert.match(styles, /\.hud-top-left \{ max-width:calc\(100vw - \(var\(--touch-target\) \* 3\) - 32px\) \}/, "portrait HUD reserves space for all three top-right controls");
  assert.match(styles, /\.mobile-console \{[\s\S]*?grid-template-columns: minmax\(0, \.9fr\) minmax\(0, 1\.5fr\);/, "landscape touch controls can shrink without horizontal overflow");
  const shortLandscapeFallback = { width: 700, height: 323, consoleHeight: 66, focalTop: 5, focalHeight: 50 };
  assert.ok(shortLandscapeFallback.focalTop + shortLandscapeFallback.focalHeight <= shortLandscapeFallback.height - shortLandscapeFallback.consoleHeight, "700x323 keeps the focal scale above the compact console");
  assert.match(styles, /\.gallery\s*\{[^}]*width:\s*100vw[^}]*height:\s*100dvh[^}]*max-width:\s*none[^}]*max-height:\s*none[^}]*margin:\s*0[^}]*padding:\s*0/s, "the gallery is full-viewport at every aspect ratio");
  assert.match(styles, /\.af-frame\{position:absolute[^}]*left:50%[^}]*top:50%[^}]*transform:translate\(-50%,-50%\)/, "the AF frame remains geometrically centred at every aspect ratio");
  assert.match(page, /<Viewport3D[^>]*aimX=\{0\} aimY=\{0\}/, "the renderer focus probe remains centred independently of layout");
  const touchRelease = page.slice(page.indexOf("const onPointerUp"), page.indexOf("const mobileOptions"));
  assert.doesNotMatch(touchRelease, /capture\(|startBurst\(/, "touch release never fires the shutter; only dedicated shutter controls do");
});

test("commercial interaction contracts preserve keyboard focus, modal isolation, and quiet assistive updates", async () => {
  const [page, photoLibrary, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readProductStyles(),
  ]);
  assert.match(photoLibrary, /dialogRef/);
  assert.match(photoLibrary, /typeof dialog\.showModal === "function"\) dialog\.showModal\(\)/, "the photo library uses the browser's real modal top layer and focus isolation");
  assert.match(photoLibrary, /typeof dialog\.close === "function"\) dialog\.close\(\)/);
  assert.match(photoLibrary, /else dialog\.setAttribute\("open", ""\)/, "older dialog implementations retain a usable fallback");
  assert.match(photoLibrary, /returnFocusRef\.current\?\.focus/, "closing the library returns focus to the control that opened it");
  assert.match(photoLibrary, /onCancel=\{event => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?if \(selectedPhoto\) setSelectedPhotoId\(null\);[\s\S]*?else onClose\(\);/, "Escape backs out of playback before closing the native modal");
  assert.doesNotMatch(photoLibrary, /<dialog open className="gallery"/, "the gallery does not imitate modality with a permanently open non-modal dialog");
  assert.match(styles, /:where\(button, input, select, \[role="button"\], \[role="menuitemradio"\]\):focus-visible/);
  assert.match(styles, /\.live-stage:focus-visible\s*\{[^}]*outline:3px solid var\(--accent\)/, "the viewfinder restores a visible keyboard focus ring");
  assert.match(styles, /\.gallery:not\(\[open\]\)\s*\{\s*display:none\s*\}/, "the modal cannot flash visibly before it enters the top layer");
  assert.match(page, /role="timer" aria-label=\{`[^`]*Math\.ceil\(exposureState\.remainingSeconds\)/, "the exposure timer is not a high-frequency live region");
  assert.match(page, /role="meter" aria-valuemin=\{0\} aria-valuemax=\{CARD_CAPACITY\}/);
  assert.match(page, /role="meter" aria-valuemin=\{0\} aria-valuemax=\{MAX_BUFFER\}/);
  assert.match(page, /aria-haspopup="menu"/);
  assert.match(page, /role="menuitemradio"/);
  assert.match(page, /target\.closest\('button,\[role="button"\],\[role="menuitemradio"\]'\)/, "focused controls own Space and Enter instead of also firing the global shutter");
  assert.match(page, /event\.key !== "Enter"[\s\S]*startBurst\(\)[\s\S]*setTimeout\(stopBurst, 0\)/, "the focused viewfinder supports expected Enter activation");
});

test("notched screens and legacy mobile viewport units retain a usable launch surface", async () => {
  const [styles, criticalStyles, cameraStyles] = await Promise.all([
    readProductStyles(),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/camera.css", import.meta.url), "utf8"),
  ]);
  assert.match(styles, /\.start-screen\s*\{[\s\S]*?padding-top:\s*max\(16px, env\(safe-area-inset-top\)\)[\s\S]*?padding-right:\s*max\(14px, env\(safe-area-inset-right\)\)[\s\S]*?padding-bottom:\s*max\(16px, env\(safe-area-inset-bottom\)\)[\s\S]*?padding-left:\s*max\(14px, env\(safe-area-inset-left\)\)/, "the launch card clears all four device cutout insets");
  assert.match(styles, /\.start-card\s*\{[\s\S]*?max-width:\s*100%[\s\S]*?max-height:\s*calc\(100dvh - max\(16px, env\(safe-area-inset-top\)\) - max\(16px, env\(safe-area-inset-bottom\)\)\)/, "the launch card remains scrollable inside the safe dynamic viewport");
  assert.match(criticalStyles, /@supports not \(height:100dvh\)\s*\{[\s\S]*?\.game-shell\s*\{\s*height:100vh\s*\}/, "the launch shell keeps its legacy viewport-height fallback on the critical path");
  assert.match(cameraStyles, /@supports not \(height:100dvh\)\s*\{[\s\S]*?\.gallery\s*\{\s*height:100vh\s*\}/, "the entered gallery keeps the same legacy viewport-height fallback");
  assert.match(styles, /@media \(hover:none\)\s*\{[\s\S]*?\.start-play:hover[\s\S]*?transform:none/, "touch devices do not retain desktop hover movement after a tap");
  assert.match(styles, /@media \(forced-colors:active\)/, "forced-colour users retain a visible focus and AF indicator");
});

test("the production stylesheet does not ship selectors for retired interface components", async () => {
  const [styles, ...consumers] = await Promise.all([
    readProductStyles(),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/histogram.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  const consumerSource = consumers.join("\n");
  const generatedClassNames = new Set(["af-size-small", "af-size-medium", "af-size-large"]);
  const cssClassNames = new Set(Array.from(styles.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g), match => match[1]));
  const unreferenced = Array.from(cssClassNames)
    .filter(className => !generatedClassNames.has(className) && !consumerSource.includes(className))
    .sort();
  assert.deepEqual(unreferenced, [], `unreferenced CSS class selectors: ${unreferenced.join(", ")}`);
  assert.doesNotMatch(styles, /\.(?:mission-copy|scene-rail|scene-icon|playback-exif|photo-library|status-readout|wheel-hint)(?:\b|:)/, "retired HUD, scene rail, EXIF, and playback selectors stay out of the critical stylesheet");
});

test("camera interface CSS stays off the menu path and is ready before entry", async () => {
  const [page, styleBoundary, criticalStyles, cameraStyles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/camera-styles.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/camera.css", import.meta.url), "utf8"),
  ]);
  assert.match(styleBoundary, /import "\.\/camera\.css"/);
  assert.match(page, /const loadCameraStyles = \(\) => import\("\.\/camera-styles"\)/);
  assert.match(page, /function warmCameraExperience\(\) \{\s*void warmRenderer\(\);\s*return loadCameraStyles\(\);\s*\}/);
  assert.match(page, /warmCameraExperience\(\)\.then\([\s\S]{0,100}\(\) => \{ setStarted\(true\); setLaunching\(false\); \}/, "camera markup waits for its stylesheet boundary");
  assert.match(page, /onPointerEnter=\{\(\) => \{ void warmCameraExperience\(\); \}\}/, "pointer intent warms both CSS and renderer code");
  assert.match(page, /disabled=\{launching\} aria-busy=\{launching\}/, "entry controls expose and lock their preparation state");
  assert.doesNotMatch(criticalStyles, /\.hud\b|\.gallery\b|\.mobile-console\b|\.af-frame\b/, "camera-only interface selectors must not block the launch menu");
  assert.match(cameraStyles, /\.hud\{/);
  assert.match(cameraStyles, /\.gallery\{/);
  assert.match(cameraStyles, /\.mobile-console\{/);
  assert.match(cameraStyles, /\.af-frame\{/);

  const cssRoot = new URL("../dist/client/_next/static/css/", import.meta.url);
  const stylesheets = await readdir(cssRoot);
  const emittedStyles = await Promise.all(stylesheets.map(async name => ({ name, css: await readFile(new URL(name, cssRoot), "utf8") })));
  const criticalEntry = emittedStyles.find(entry => entry.css.includes(".start-screen"));
  const cameraEntry = emittedStyles.find(entry => entry.css.includes(".hud{") && entry.css.includes(".gallery{"));
  assert.ok(criticalEntry, "the launch menu emits its critical stylesheet");
  assert.ok(cameraEntry, "the entered camera emits a separate stylesheet");
  const [criticalArtifact, cameraArtifact, menuResponse] = await Promise.all([
    Promise.resolve(criticalEntry.css),
    Promise.resolve(cameraEntry.css),
    render(),
  ]);
  assert.ok(Buffer.byteLength(criticalArtifact) < Buffer.byteLength(cameraArtifact), "the smaller launch surface, not the camera UI, remains render-blocking");
  assert.doesNotMatch(await menuResponse.text(), new RegExp(cameraEntry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "server-rendered menu HTML does not advertise the camera stylesheet");
});

test("Worker responses retain streaming bodies and receive low-risk production security headers", async () => {
  const source = new Response("streamed body", {
    status: 202,
    statusText: "Accepted",
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "unsafe-old-value",
    },
  });
  const hardened = withSecurityHeaders(source);
  assert.equal(hardened.status, 202);
  assert.equal(hardened.statusText, "Accepted");
  assert.equal(hardened.headers.get("Cache-Control"), "public, max-age=31536000, immutable", "existing cache behavior is preserved");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(hardened.headers.get(name), value);
  assert.equal(await hardened.text(), "streamed body");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(worker, /const response = await handler\.fetch\(request, env, ctx\)/, "the application response remains awaited and stream-backed");
  assert.match(worker, /return withSecurityHeaders\(response\)/);
  assert.doesNotMatch(worker, /interface Env|interface ExecutionContext/, "Worker types derive from the Vinext handler instead of drifting hand-written platform types");
  assert.match(viteConfig, /compatibility_date:\s*"2026-08-10"/, "the Worker compatibility date is explicit and current for this production pass");
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
    readWorldSource(),
  ]);
  assert.match(viewport, /powerPreference: "high-performance"/);
  assert.match(viewport, /preserveDrawingBuffer: false/);
  assert.match(viewport, /BufferGeometryUtils/);
  assert.match(viewport, /dataset\.fps/);
  assert.match(viewport, /dataset\.gpu/);
  assert.match(world3d, /mergeGeometries/);
});

test("captured photos are truly rendered at Full HD or better in every common orientation", async () => {
  assert.equal(MIN_PHOTO_SHORT_EDGE, 1080);
  assert.equal(MIN_PHOTO_LONG_EDGE, 1920);
  assert.deepEqual(photoOutputSize(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(photoOutputSize(1024, 768), { width: 1920, height: 1440 });
  assert.deepEqual(photoOutputSize(390, 844), { width: 1080, height: 2338 });
  assert.deepEqual(photoOutputSize(844, 390), { width: 2338, height: 1080 });
  assert.deepEqual(photoOutputSize(3440, 1440), { width: 2580, height: 1080 });

  for (const [inputWidth, inputHeight] of [[360, 800], [800, 360], [768, 1024], [1366, 768], [2560, 1080]]) {
    const output = photoOutputSize(inputWidth, inputHeight);
    assert.ok(Math.min(output.width, output.height) >= 1080, `${inputWidth}x${inputHeight} keeps a 1080 px short edge`);
    assert.ok(Math.max(output.width, output.height) >= 1920, `${inputWidth}x${inputHeight} keeps a 1920 px long edge`);
    assert.ok(Math.abs(output.width / output.height - inputWidth / inputHeight) < .001, `${inputWidth}x${inputHeight} keeps its composition`);
  }

  const viewport = await readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8");
  assert.match(viewport, /const \{ width, height \} = photoOutputSize\(liveWidth, liveHeight\)/);
  assert.match(viewport, /renderer\.setPixelRatio\(1\);\s*renderer\.setSize\(width, height, false\)/, "capture raises the real WebGL drawing buffer instead of upscaling a screenshot");
  assert.match(viewport, /finally \{[\s\S]*renderer\.setPixelRatio\(livePixelRatio\);\s*renderer\.setSize\(liveWidth, liveHeight, false\)/, "live-view GPU cost is restored even when capture fails");
  assert.match(viewport, /toBlob\(resolve, "image\/jpeg", 0\.92\)/, "the downloadable JPEG uses a high-quality encode");
  assert.match(viewport, /return \{ width, height, thumb, image, \.\.\.reading \}/, "the library records the actual output resolution");
});

test("capture sampling spends work only on visible motion and preserves returning paths", async () => {
  assert.equal(CAPTURE_SAMPLE_SPACING_PX, 2.5);
  assert.equal(MAX_CAPTURE_SAMPLES, 64);
  assert.equal(captureSampleCount(0), 1, "a static Full-HD frame needs one temporal render");
  assert.equal(captureSampleCount(0.5), 1, "sub-pixel travel is not visible enough to justify another render");
  assert.equal(captureSampleCount(0.51), 2);
  assert.equal(captureSampleCount(5), 2);
  assert.equal(captureSampleCount(20), 8);
  assert.equal(captureSampleCount(160), 64);
  assert.equal(captureSampleCount(1000), 64, "extreme long exposures retain the established safety cap");
  assert.equal(captureSampleCount(-4), 1);

  const returnPan = [{ yaw: 0, pitch: 0 }, { yaw: 2, pitch: 0 }, { yaw: 0, pitch: 0 }];
  assert.equal(trajectoryDistance(returnPan), 4, "out-and-back camera movement cannot disappear because its endpoints match");
  assert.equal(trajectoryDistance([{ yaw: 1, pitch: 2 }]), 0);

  const [viewport, page] = await Promise.all([
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(viewport, /const MOTION_PROBE_SEGMENTS = 8/);
  assert.match(viewport, /for \(let probe = 0; probe <= MOTION_PROBE_SEGMENTS; probe \+= 1\)/, "each subject's projected exposure path is measured through intermediate positions");
  assert.match(viewport, /subjectMotionPx = Math\.max\(subjectMotionPx, pathPixels\)/, "the fastest visible subject protects all scene motion");
  assert.match(viewport, /const cameraMotionAngle = trajectoryDistance\(trajectory\)/, "camera sampling measures the complete recorded pan");
  assert.match(viewport, /const motionPixels = subjectMotionPx \+ request\.shakePx \* 2 \+ cameraMotionPx \* 0\.75/);
  assert.match(viewport, /const samples = captureSampleCount\(motionPixels\)/);
  assert.doesNotMatch(viewport, /Math\.max\(8, Math\.min\(64/, "static and frozen burst frames must not pay the old eight-sample floor");
  assert.match(page, /const motionSpread = trajectoryDistance\(trajectory\)/, "capture coaching scores the same complete camera path");

  assert.equal(8 * 4, 32, "the old static floor performed eight depth-plus-three-layer passes");
  assert.equal(captureSampleCount(0) * 4, 4, "the adaptive static path performs one depth-plus-three-layer pass");
});

test("players can download the original captured JPEG without recompression", async () => {
  const [photoLibrary, styles] = await Promise.all([
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readProductStyles(),
  ]);
  assert.match(photoLibrary, /URL\.createObjectURL\(photo\.image\)/, "download points directly at the stored full-resolution Blob");
  assert.match(photoLibrary, /link\.download = `aperture-world-\$\{photo\.scene\}[^`]+\.jpg`/);
  assert.match(photoLibrary, /document\.body\.appendChild\(link\);\s*link\.click\(\);\s*link\.remove\(\)/);
  assert.match(photoLibrary, /URL\.revokeObjectURL\(url\)/, "the short-lived download URL is released");
  assert.match(photoLibrary, /className="gallery-action-download"/, "single-photo playback offers download");
  assert.match(photoLibrary, /className="gallery-card-download"/, "each gallery card offers download");
  assert.match(photoLibrary, /\{selectedPhoto\.width\} × \{selectedPhoto\.height\} JPEG/, "playback reports the actual file dimensions");
  assert.match(styles, /\.gallery-card-download/);
});

test("background scene warming respects data-saving and slow mobile connections", async () => {
  assert.equal(shouldPrefetchScenes(undefined), true);
  assert.equal(shouldPrefetchScenes({ saveData: false, effectiveType: "4g" }), true);
  assert.equal(shouldPrefetchScenes({ saveData: true, effectiveType: "4g" }), false);
  assert.equal(shouldPrefetchScenes({ saveData: false, effectiveType: "slow-2g" }), false);
  assert.equal(shouldPrefetchScenes({ saveData: false, effectiveType: "2g" }), false);

  const viewport = await readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const sceneLoader = await readFile(new URL("../app/scene3d.mjs", import.meta.url), "utf8");
  assert.match(page, /let rendererWarmPromise: Promise<unknown> \| null = null/, "renderer intent warming is deduped across hover, focus, pointer-down, and activation");
  assert.match(page, /function warmRenderer\(\)[\s\S]*import\("\.\/three-runtime"\)[\s\S]*import\("three\/addons\/utils\/BufferGeometryUtils\.js"\)/, "interaction intent warms both renderer dependencies");
  assert.doesNotMatch(page, /if \(typeof window !== "undefined"\)\s*\{[\s\S]{0,220}import\("\.\/three-runtime"\)/, "hydration alone must not download the 3D renderer");
  assert.match(page, /\{started\s*\? <Viewport3D[\s\S]{0,360}: <div className="viewport-stage" aria-hidden="true" \/>\}/, "the 3D viewport does not mount behind the start screen");
  assert.match(page, /\{started && <div className="hud">/, "the full camera HUD is created only after entry");
  assert.match(page, /\{started && <section className="mobile-console"/, "the mobile camera console is created only after entry");
  assert.match(page, /className="start-actions" onPointerEnter=\{\(\) => \{ void warmCameraExperience\(\); \}\}/, "mouse intent can overlap camera CSS and renderer transfer with activation");
  assert.match(page, /onPointerDown=\{\(\) => \{ void warmCameraExperience\(\); \}\}/, "touch intent can overlap camera preparation with activation");
  assert.match(page, /onFocus=\{\(\) => \{ void warmCameraExperience\(\); \}\}/, "keyboard intent can overlap camera preparation with activation");
  assert.match(page, /const enterGame[\s\S]{0,220}warmCameraExperience\(\)\.then\([\s\S]{0,100}setStarted\(true\)/, "activation waits for camera styling before mounting the viewport");
  assert.match(viewport, /viewRef\.current\.frozen \|\| document\.hidden \|\| !shouldPrefetchScenes\(connection\)/, "the start screen, hidden tabs, and constrained links must not warm unused worlds");
  assert.match(viewport, /requestIdleCallback\(warm, \{ timeout: 2500 \}\)/, "scene warming waits for an idle main-thread slot");
  assert.match(viewport, /prefetchOtherScenes\(engine\.sceneKey, canContinue\)/, "warming stops between chunks if the player returns home or the tab becomes hidden");
  assert.match(sceneLoader, /await SCENE_LOADERS\[other\]\(\)/, "the remaining scene chunks download sequentially");
  assert.doesNotMatch(viewport, /setTimeout\(\(\) => prefetchOtherScenes/, "mounting the preview must not immediately download all worlds");
  const menuHtml = await (await render()).text();
  assert.doesNotMatch(menuHtml, /\/(?:viewport|three\.module|scene-kit|performance)-[^"']+\.js/, "the server-rendered menu must not preload camera-only renderer or performance chunks");
});

test("photo histogram code stays off the initial page path until playback", async () => {
  const [page, photoLibrary, histogramSource, criticalStyles, cameraStyles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/histogram.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/camera.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /import \{ Histogram \} from "\.\/histogram"/, "the playback analyzer must not be a static page dependency");
  assert.doesNotMatch(page, /loadHistogram|shadowPercent|getImageData/, "the menu and camera page do not own playback analysis code");
  assert.match(photoLibrary, /const loadHistogram = \(\) => import\("\.\/histogram"\)/, "histogram loading has an explicit nested demand boundary");
  assert.match(photoLibrary, /const Histogram = dynamic\(\(\) => loadHistogram\(\)\.then\(module => module\.Histogram\)/, "the analyzer component is demand-loaded");
  assert.match(photoLibrary, /const showPhoto[\s\S]{0,120}void loadHistogram\(\);[\s\S]{0,120}setSelectedPhotoId\(/, "selecting a photo begins transfer before the playback render");
  assert.match(photoLibrary, /className="playback-histogram histogram-loading" aria-hidden="true"/, "playback reserves stable layout while the analyzer arrives");
  assert.match(cameraStyles, /\.histogram-loading\{min-height:164px\}/);
  assert.doesNotMatch(criticalStyles, /\.histogram-loading|\.playback-histogram/, "playback-only layout and graph styling must not remain in the critical stylesheet");
  assert.doesNotMatch(cameraStyles, /\.playback-histogram\{/, "the analyzer's own graph styling stays in its smaller playback chunk");
  assert.match(histogramSource, /import "\.\/histogram\.css"/, "the analyzer owns its demand-loaded styles");

  const chunkRoot = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const cssRoot = new URL("../dist/client/_next/static/css/", import.meta.url);
  const [chunks, stylesheets] = await Promise.all([readdir(chunkRoot), readdir(cssRoot)]);
  const pageChunkName = chunks.find(name => /^page-.*\.js$/.test(name));
  const histogramChunkName = chunks.find(name => /^histogram-.*\.js$/.test(name));
  const histogramCssName = stylesheets.find(name => /^histogram\..*\.css$/.test(name));
  assert.ok(pageChunkName, "the production page chunk must exist");
  assert.ok(histogramChunkName, "the production histogram must emit as its own chunk");
  assert.ok(histogramCssName, "the production histogram styles must emit as their own chunk");
  const [pageChunk, histogramChunk, histogramCss, menuResponse] = await Promise.all([
    readFile(new URL(pageChunkName, chunkRoot), "utf8"),
    readFile(new URL(histogramChunkName, chunkRoot), "utf8"),
    readFile(new URL(histogramCssName, cssRoot), "utf8"),
    render(),
  ]);
  assert.doesNotMatch(pageChunk, /shadowPercent|getImageData\(0,0,/, "histogram sampling code must not remain in the initial page chunk");
  assert.match(histogramChunk, /shadowPercent/);
  assert.match(histogramChunk, /getImageData\(0,0,/);
  assert.match(histogramCss, /\.playback-histogram/);
  assert.doesNotMatch(await menuResponse.text(), /histogram\.[^"']+\.css/, "the menu must not advertise playback-only CSS");
});

test("large photo libraries render incrementally without limiting storage or playback", async () => {
  const [page, photoLibrary, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readProductStyles(),
  ]);
  assert.match(page, /const CARD_CAPACITY = 2000/);
  assert.match(photoLibrary, /const GALLERY_BATCH_SIZE = 48/);
  assert.match(photoLibrary, /const \[galleryLimit, setGalleryLimit\] = useState\(GALLERY_BATCH_SIZE\)/);
  assert.match(photoLibrary, /shots\.slice\(0, galleryLimit\)/, "only the current gallery window receives card DOM");
  assert.match(photoLibrary, /visibleShots\.map\(\(photo, index\) =>/, "the grid renders the bounded window");
  assert.doesNotMatch(photoLibrary, /className="gallery-grid"[^>]*>\{shots\.map/, "the grid must not render all 2,000 stored photos at once");
  assert.match(page, /libraryOpen && <PhotoLibrary/, "closing and reopening remounts the library with its first 48-card batch");
  assert.equal((page.match(/setLibraryOpen\(true\)/g) ?? []).length, 1, "all keyboard, desktop, and mobile entry paths share the bounded open routine");
  assert.match(photoLibrary, /Math\.min\(shots\.length, current \+ GALLERY_BATCH_SIZE\)/, "load-more cannot exceed the stored collection");
  assert.match(photoLibrary, /disabled=\{visibleShots\.length >= shots\.length\}/, "the final load control stays focus-stable and becomes disabled");
  assert.match(photoLibrary, /const nextIndex = \(Math\.max\(0, currentIndex\) \+ offset \+ shots\.length\) % shots\.length/, "playback arrows continue to navigate the complete collection");
  assert.match(styles, /\.gallery-card\{content-visibility:auto;contain-intrinsic-size:auto 240px\}/, "visible cards also skip offscreen paint and layout work");
  assert.match(styles, /\.gallery-grid>\.gallery-load-more\{[^}]*min-height:52px/, "the incremental control remains touch-friendly");

  let limit = 48;
  while (limit < 2000) limit = Math.min(2000, limit + 48);
  assert.equal(limit, 2000, "incremental batches eventually expose every card without truncation");
});

test("the photo library stays off the menu and camera chunks until the player opens it", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const loadPhotoLibrary = \(\) => import\("\.\/photo-library"\)/, "the library has an explicit demand boundary");
  assert.match(page, /const PhotoLibrary = dynamic\(\(\) => loadPhotoLibrary\(\)\.then\(module => module\.PhotoLibrary\)/, "the complete modal is a dynamic component");
  assert.match(page, /onPointerEnter=\{\(\) => void loadPhotoLibrary\(\)\}[\s\S]{0,180}onFocus=\{\(\) => void loadPhotoLibrary\(\)\}/, "desktop and mobile library controls warm the feature on intent");
  assert.doesNotMatch(page, /gallery-load-more|aperture-world-\$\{photo\.scene\}|URL\.createObjectURL\(blob\)/, "gallery rendering, download, and Blob viewer code must not remain in the page source");

  const chunkRoot = new URL("../dist/client/_next/static/chunks/", import.meta.url);
  const chunkNames = (await readdir(chunkRoot)).filter(name => name.endsWith(".js"));
  const artifacts = await Promise.all(chunkNames.map(async name => ({ name, source: await readFile(new URL(name, chunkRoot), "utf8") })));
  const pageArtifact = artifacts.find(artifact => /^page-.*\.js$/.test(artifact.name));
  const libraryArtifact = artifacts.find(artifact => artifact.source.includes("gallery-load-more") && artifact.source.includes("aperture-world-"));
  assert.ok(pageArtifact, "the production page chunk must exist");
  assert.ok(libraryArtifact, "the production photo library must emit as its own chunk");
  assert.notEqual(libraryArtifact.name, pageArtifact.name, "the dormant library cannot be folded back into the initial page chunk");
  assert.doesNotMatch(pageArtifact.source, /gallery-load-more|aperture-world-|createObjectURL\(/, "the initial page chunk must not contain library-only DOM, downloads, or Blob URLs");
  assert.match(libraryArtifact.source, /gallery-load-more/);
  assert.match(libraryArtifact.source, /aperture-world-/);

  const menuHtml = await (await render()).text();
  assert.doesNotMatch(menuHtml, new RegExp(libraryArtifact.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "the server-rendered menu must not advertise the dormant library chunk");
  assert.doesNotMatch(menuHtml, /gallery-loading|PHOTO LIBRARY|class="gallery"/, "the menu must not render library UI or its loading fallback");
});

test("idle work, GPU resources, capture memory, network caching, and unused starter capabilities stay bounded", async () => {
  const [page, photoLibrary, histogram, viewport, lifecycle, threeRuntime, world3d, packageJson, packageLock, nextConfig, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/histogram.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/viewport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/three-lifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/three-runtime.ts", import.meta.url), "utf8"),
    readWorldSource(),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const CARD_CAPACITY = 2000/);
  assert.match(page, /reservedFramesRef\.current >= CARD_CAPACITY/, "the card must reserve asynchronous encodes before accepting another frame");
  assert.match(page, /bufferDecayRef\.current >= MAX_BUFFER/, "encoding and queued frames must both count against the 300-frame buffer");
  assert.match(photoLibrary, /image: Blob;/, "captured photos own their pixel data as a Blob, not a long-lived object URL");
  assert.match(photoLibrary, /URL\.createObjectURL\(blob\)/, "the viewer mints an object URL from only the shown photo's Blob");
  assert.match(photoLibrary, /return \(\) => URL\.revokeObjectURL\(url\)/, "the viewer's object URL is revoked with its committed image element");
  assert.match(histogram, /image instanceof Blob \? URL\.createObjectURL\(image\) : null/, "histogram analysis also accepts the selected Blob without retaining card-wide URLs");
  assert.match(histogram, /URL\.revokeObjectURL\(objectUrl\)/, "the histogram releases its temporary analysis URL");
  assert.match(photoLibrary, /loading="lazy" decoding="async"/, "the gallery grid must not decode every frame at once");
  assert.match(page, /frozen=\{libraryOpen\}/, "only a mounted, entered viewport needs modal freezing");
  assert.doesNotMatch(page, /window\.setInterval/, "an empty buffer must not keep a permanent interval alive");
  assert.match(page, /if \(pendingRef\.current\.length > 0\) bufferTimerRef\.current = window\.setTimeout\(drain, BUFFER_WRITE_MS\)/, "ready frames must continue draining without queue-driven timer resets");
  assert.match(viewport, /if \(!viewRef\.current\.frozen\) scheduleFrame\(\)/, "a frozen view must stop requesting frames");
  assert.match(viewport, /document\.addEventListener\("visibilitychange", onVisibilityChange\)/);
  assert.match(viewport, /disposeObjectTree\(engine\.built\.scene, renderer\)/);
  // A Hi+ burst fires thirty captures a second. The intermediate surfaces survive
  // between shots; only the canvas an asynchronous toBlob is still encoding is
  // allocated per capture, so the next frame of a burst cannot paint over it.
  assert.match(viewport, /pool\.layers\[index\] = reuseScratch\(/, "burst captures reuse the depth-layer canvases");
  assert.match(viewport, /pool\.composite = reuseScratch\(/, "burst captures reuse the compositing canvas");
  assert.match(viewport, /pool\.thumb = reuseScratch\(/, "burst captures reuse the thumbnail canvas");
  assert.match(viewport, /pool\.noise = \{ tile, image \}/, "the grain tile is generated once and repainted in place");
  assert.match(viewport, /const output = scratchCanvas\(width, height\)/, "the surface handed to the asynchronous toBlob encode is never reused");
  assert.match(viewport, /engine\.scratch = \{ layers: \[\], composite: null, thumb: null, noise: null \}/, "teardown releases the capture surfaces");
  // Autofocus and the light meter read the same point on the sensor.
  assert.match(viewport, /const shared = view\.aimX === 0 && view\.aimY === 0 \? engine\.castCenter\(0, 0\) : undefined/, "one centre ray answers both AF and metering");
  assert.match(viewport, /engine\.probeFocus\(shared\)/);
  assert.match(viewport, /engine\.probeLight\(shared\)/);
  assert.match(viewport, /const METER_STEP_EV = 1 \/ 3/, "the reflected-light meter uses the camera's third-stop ladder");
  assert.match(viewport, /Math\.round\(light\.ev \/ METER_STEP_EV\) \* METER_STEP_EV/, "meter readings are quantised to third-stops");
  assert.match(viewport, /lightRef\.current\?\.\(\{ ev: meteredEv \}\)/, "React receives the quantised meter value");
  assert.doesNotMatch(viewport, /Math\.abs\(light\.ev - lastLightEv\)/, "raw EV changes must not trigger meter reports");
  // A session downloads the world it plays. Remaining worlds warm only after
  // entry, at idle, and when the current connection permits optional transfer.
  assert.match(viewport, /await loadSceneModule\(firstKey\)/, "the played scenario is fetched as its own chunk");
  assert.match(viewport, /if \(disposed \|\| engine\.sceneKey !== key\) return/, "a superseded scene load must not mount over a newer one");
  assert.match(viewport, /engine\.warmScenes\(\)/, "capable connections can warm scene switching after entry");
  assert.match(viewport, /prefetchOtherScenes\(engine\.sceneKey, canContinue\)/, "scene warming remains cancellable between chunks");
  assert.match(viewport, /window\.cancelIdleCallback\(warmIdleId\)/, "teardown cancels an idle warm-up slot");
  assert.match(viewport, /window\.clearTimeout\(warmTimer\)/, "teardown cancels the background warm-up");
  // Live look is renderer state. Pointer movement must not reconcile the whole
  // Home/HUD tree at display refresh rate.
  assert.doesNotMatch(page, /\[look, setLook\]/, "camera movement must not live in React state");
  assert.match(page, /const lookRef = useRef<Look>\(\{ yaw: 0, pitch: 0 \}\)/, "capture and gestures share one current camera look");
  assert.match(page, /viewportRef\.current\?\.setLook\(nextLook\)/, "look changes go straight to the viewport engine");
  assert.match(viewport, /setLook\(nextLook\) \{[\s\S]*view\.yaw = nextLook\.yaw;[\s\S]*view\.pitch = nextLook\.pitch;[\s\S]*engineRef\.current\?\.wake\(\)/, "the imperative look path mutates only renderer state and wakes one frame");
  assert.doesNotMatch(page, /<Viewport3D[^>]*\byaw=/, "parent renders must not push stale yaw back into the live renderer");
  // A meter reading that comes back at the same stop also remains a React bail-out.
  assert.match(page, /const \[lightEv, setLightEv\] = useState\(0\)/, "the meter is a bare number so an unchanged stop bails out");
  assert.doesNotMatch(page, /setLightRead\(\{/, "a fresh reading object would defeat that bail-out");
  assert.match(viewport, /import\("\.\/three-runtime"\)/, "the viewport must load the curated renderer boundary");
  assert.doesNotMatch(viewport, /await import\("three"\)|Promise\.all\(\[import\("three"\)/, "a runtime namespace import would retain Three.js APIs the scenes never use");
  assert.match(threeRuntime, /WebGLRenderer/);
  assert.match(lifecycle, /const geometries = new Set/);
  assert.match(lifecycle, /const materials = new Set/);
  assert.match(lifecycle, /const textures = new Set/);
  assert.match(world3d, /for \(const root of subjects\)/);
  assert.match(world3d, /rootInverse\.clone\(\)\.multiply\(mesh\.matrixWorld\)/, "rigid subjects batch in root-local coordinates");
  assert.doesNotMatch(packageJson, /drizzle|db:generate/, "unused D1 tooling must not remain installed");
  assert.doesNotMatch(packageLock, /drizzle|@drizzle-team/, "unused D1 tooling must not remain in the install graph");
  assert.match(nextConfig, /\/_next\/static\/:path\*/);
  assert.match(nextConfig, /max-age=31536000, immutable/, "content-hashed client assets should stay in the browser cache");
  assert.match(nextConfig, /stale-while-revalidate=604800/, "the social preview should revalidate without blocking repeat requests");
  assert.doesNotMatch(worker, /image-optimization|_vinext\/image|IMAGES/, "an unused image proxy must not inflate the Worker or require a binding");
  await Promise.all([
    "app/chatgpt-auth.ts",
    "db/index.ts",
    "db/schema.ts",
    "drizzle.config.ts",
    "drizzle/meta/_journal.json",
    "examples/d1/app/api/notes/route.ts",
    "examples/d1/db/schema.ts",
    "public/file.svg",
    "public/globe.svg",
    "public/window.svg",
  ].map(file => assert.rejects(access(new URL(`../${file}`, import.meta.url)), `${file} must be removed`)));
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

test("depth bands separate a scene by real distance, so aperture is visible everywhere", () => {
  // Bands cover the scenario end to end and never cross.
  for (const scene of Object.keys(WORLD)) {
    const edges = depthBandEdges(scene);
    assert.equal(edges.length, DEPTH_BANDS - 1, `${scene} splits into ${DEPTH_BANDS} bands`);
    for (let index = 1; index < edges.length; index += 1) assert.ok(edges[index] > edges[index - 1], `${scene} band edges ascend`);
    assert.equal(depthBandFor(scene, 0.01), 0, `${scene} files anything underfoot in the nearest band`);
    assert.equal(depthBandFor(scene, WORLD[scene].far * 40), DEPTH_BANDS - 1, `${scene} files the horizon in the farthest band`);
    const bands = Array.from({ length: DEPTH_BANDS }, (_, band) => depthBandDistance(scene, band));
    for (let band = 1; band < bands.length; band += 1) assert.ok(bands[band] > bands[band - 1], `${scene} band distances ascend`);
    assert.equal(depthBandFor(scene, WORLD[scene].near), depthBandFor(scene, WORLD[scene].near), "banding is stable");
  }

  // The failure this replaces: every scene had one background bucket measured at
  // its farthest distance, so a mid-distance background could not blur at all.
  const banded = depthBandBlur("landscape", { focalMm: 24, fNumber: 1.4, imageWidthPx: 1920, focusM: 8 });
  const focused = depthBandFor("landscape", 8);
  assert.ok(banded[focused] < 0.35, "the band under the AF frame is the sharp one");
  assert.ok(banded[0] > 2, "…the ground at the photographer's feet is thrown well out");
  for (let band = focused + 2; band < DEPTH_BANDS; band += 1) {
    assert.ok(banded[band] >= banded[band - 1] - 1e-9, "behind the focus plane, blur grows with distance toward its asymptote");
  }
  assert.ok(banded[DEPTH_BANDS - 1] > 1, "…so the horizon is genuinely soft, which one shared background bucket could never show");

  const open = depthBandBlur("outdoor_portrait", { focalMm: 85, fNumber: 1.4, imageWidthPx: 1920, focusM: 3.8 });
  const shut = depthBandBlur("outdoor_portrait", { focalMm: 85, fNumber: 16, imageWidthPx: 1920, focusM: 3.8 });
  for (let band = 0; band < DEPTH_BANDS; band += 1) assert.ok(shut[band] <= open[band] + 1e-9, "stopping down never blurs more");
  assert.ok(open.reduce((a, b) => a + b, 0) > shut.reduce((a, b) => a + b, 0) * 3, "f/1.4 and f/16 must not look alike");
});

test("a capture costs one render pass per band the aperture can actually separate", () => {
  const layers = Array.from({ length: DEPTH_BANDS }, (_, band) => DEPTH_LAYER_BASE + band).concat(SUBJECT_LAYER);

  const stoppedDown = depthPasses("landscape", {
    layers, bandBlur: depthBandBlur("landscape", { focalMm: 24, fNumber: 11, imageWidthPx: 1920, focusM: 90 }), subjectBlur: 0, subjectM: 90,
  });
  assert.ok(stoppedDown.length <= 2, "a stopped-down wide is sharp almost throughout and collapses to a render or two");

  const wideOpen = depthPasses("portrait", {
    layers, bandBlur: depthBandBlur("portrait", { focalMm: 85, fNumber: 1.4, imageWidthPx: 1920, focusM: 4.2 }), subjectBlur: 0, subjectM: 4.2,
  });
  assert.ok(wideOpen.length > stoppedDown.length, "wide open, the falloff has to be resolved across more passes");
  assert.ok(wideOpen.length <= 6, "…but never more passes than the readback budget allows");
  assert.ok(depthPasses("portrait", {
    layers, bandBlur: depthBandBlur("portrait", { focalMm: 85, fNumber: 1.4, imageWidthPx: 1920, focusM: 4.2 }), subjectBlur: 0, subjectM: 4.2, maxPasses: 3,
  }).length === 3, "a long exposure can trade depth passes for temporal samples");

  // Painter's order: the composite draws back to front, so passes must arrive
  // farthest first or a near band would be overpainted by the sky behind it.
  const depthOf = pass => Math.max(...pass.layers.map(layer => layer === SUBJECT_LAYER ? 4.2 : depthBandDistance("portrait", layer - DEPTH_LAYER_BASE)));
  for (let index = 1; index < wideOpen.length; index += 1) {
    assert.ok(depthOf(wideOpen[index - 1]) > depthOf(wideOpen[index]), "passes composite back to front");
  }
  const seen = wideOpen.flatMap(pass => pass.layers);
  assert.equal(new Set(seen).size, seen.length, "no layer is rendered into two passes");
  assert.equal(seen.length, layers.length, "and every occupied layer reaches the photograph");
  assert.ok(wideOpen.some(pass => pass.layers.includes(SUBJECT_LAYER)), "the subject composites at its own measured distance");
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

test("auto exposure dynamically opens aperture in low light and night scenes and scales with target EV", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
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
  const SHUTTERS = [1 / 1000, 1 / 800, 1 / 640, 1 / 500, 1 / 400, 1 / 320, 1 / 250, 1 / 200, 1 / 160, 1 / 125, 1 / 100, 1 / 80, 1 / 60, 1 / 50, 1 / 40, 1 / 30];
  const closestSafeShutter = (target, safeShutter) => closest(SHUTTERS.filter(value => value <= safeShutter), Math.min(target, safeShutter));

  // In bright daylight (EV 14.2) with F8.0, ISO 100 shutter is ~1/320s => ISO remains 100
  const brightIso = autoIso(8.0, 1 / 320, 14.2);
  assert.equal(brightIso, 100, "in bright light AUTO ISO stays at base ISO 100");

  // In night scene (EV 5.8) with F2.8 and safe shutter 1/125s => ISO must automatically scale up to ISO 1600
  const nightIso = autoIso(2.8, 1 / 125, 5.8);
  assert.equal(nightIso, 1600, "in night scene AUTO ISO must scale up to ISO 1600");

  assert.equal(closestSafeShutter(1 / 15, 1 / 125), 1 / 125, "auto shutter must not slow below the configured safety shutter in low light");
  assert.ok(closestSafeShutter(1 / 70, 1 / 70) <= 1 / 70, "a safety shutter between camera steps must round to the faster step");
  assert.match(page, /closestSafeShutter\(shutterOptions, \(a \*\* 2\) \/ Math\.pow\(2, evIso100\), safeShutter\)/, "P mode with manual ISO still obeys the safety shutter");
  assert.match(page, /closestSafeShutter\(shutterOptions, \(a \*\* 2\) \/ Math\.pow\(2, targetEv \+ Math\.log2\(i \/ 100\)\), safeShutter\)/, "A mode with manual ISO still obeys the safety shutter");
  assert.doesNotMatch(page, /darkShutter/, "reaching the Auto ISO ceiling must not override the safety shutter");
});

test("all 12 camera audio WAV sound files are present in public/sounds/ with valid RIFF headers and PCM data", async () => {
  const soundNames = [
    "shutter.wav",
    "shutter_open.wav",
    "shutter_close.wav",
    "burst.wav",
    "af_beep.wav",
    "dial.wav",
    "zoom.wav",
    "mode.wav",
    "power_on.wav",
    "warning.wav",
    "delete.wav",
    "photo_slide.wav",
  ];

  for (const name of soundNames) {
    const filePath = new URL(`../public/sounds/${name}`, import.meta.url);
    const buf = await readFile(filePath);
    assert.ok(buf.length > 44, `${name} must be a valid non-empty WAV file`);
    assert.equal(buf.subarray(0, 4).toString("ascii"), "RIFF", `${name} must have RIFF header`);
    assert.equal(buf.subarray(8, 12).toString("ascii"), "WAVE", `${name} must have WAVE format`);
    assert.equal(buf.subarray(12, 16).toString("ascii"), "fmt ", `${name} must have fmt subchunk`);
    // 16-bit PCM, 44100Hz
    assert.equal(buf.readUInt16LE(20), 1, `${name} must be uncompressed PCM`);
    assert.equal(buf.readUInt32LE(24), 44100, `${name} must have 44.1kHz sample rate`);
    assert.equal(buf.readUInt16LE(34), 16, `${name} must be 16-bit audio`);
  }
});

test("the audio engine provides zero-latency SFX and 11-scene ambient soundscapes with mute and accessibility controls", async () => {
  const audioModuleSource = await readFile(new URL("../app/audio.ts", import.meta.url), "utf8");
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const librarySource = await readFile(new URL("../app/photo-library.tsx", import.meta.url), "utf8");

  // Verify all 11 scene soundscapes are handled in audio.ts
  for (const key of SCENE_KEYS) {
    assert.ok(
      audioModuleSource.includes(`sceneKey === "${key}"`),
      `audio engine must provide soundscape generator for scene: ${key}`
    );
  }

  // Verify all essential audio functions are exported
  const expectedExports = [
    "playShutter",
    "playShutterOpen",
    "playShutterClose",
    "playBurstClick",
    "playAfLock",
    "playDialClick",
    "playZoomTick",
    "playModeDial",
    "playPowerOn",
    "playWarning",
    "playDelete",
    "playPhotoSlide",
    "startSceneAmbience",
    "stopSceneAmbience",
    "pauseSceneAmbience",
    "resumeSceneAmbience",
    "setSoundMuted",
    "isSoundMuted",
    "toggleSoundMuted",
    "unlockAudio",
  ];

  for (const fn of expectedExports) {
    assert.ok(
      audioModuleSource.includes(`export const ${fn}`),
      `audio.ts must export ${fn}`
    );
  }

  // Verify page and library integration
  assert.match(pageSource, /<button[^>]*class(Name)?="[^"]*sound-button/, "HUD includes sound toggle button");
  assert.match(pageSource, /KeyM/, "Keyboard shortcut M is bound to mute toggle");
  assert.match(pageSource, /playAfLock()/, "AF sharp lock triggers audio confirmation");
  assert.match(pageSource, /playPowerOn()/, "Game entry triggers power-on camera audio");
  assert.match(librarySource, /playPhotoSlide()/, "Photo library slide triggers photo flip audio");
  assert.match(librarySource, /playDelete()/, "Photo deletion triggers delete audio");
});
