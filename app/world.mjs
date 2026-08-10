import { FULL_FRAME_SENSOR_WIDTH_MM } from "./optics.mjs";

/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night" | "starry" | "city_night" | "airport" | "outdoor_portrait"} SceneKey
 */

/**
 * Depth hints used while a scenario is being authored: is this piece of geometry
 * the subject, something in front of it, or the world behind it. `buildScene`
 * replaces them with a measured depth band (below) before the first frame, so a
 * builder never has to guess how far away it just put a bench.
 */
export const LAYER = { far: 0, subject: 1, near: 2 };

/**
 * Moving subjects keep a layer of their own. Their distance is whatever the AF
 * frame reads at the instant the shutter fires, which for a bird or a sprinter
 * is nowhere near where the scene builder first placed them.
 */
export const SUBJECT_LAYER = 3;
/** Static geometry is re-filed onto `DEPTH_LAYER_BASE + band` by its real distance. */
export const DEPTH_LAYER_BASE = 4;
/**
 * Bands per scenario. Three buckets could not tell a hedge from a mountain.
 *
 * Every band is a batching boundary — same-material props on opposite sides of
 * one cannot share a draw call — so this is bought with render-list length, and
 * ten is where the curve flattens: `depthPasses` collapses adjacent bands the
 * aperture cannot separate anyway, and never composites more than six.
 */
export const DEPTH_BANDS = 10;
/** Below this radius a blur is invisible, so the capture skips the filter entirely. */
export const SHARP_BLUR_PX = 0.35;

const bandEdgeCache = new Map();

/**
 * Distances that split one scenario into depth bands. Defocus follows 1/distance,
 * so equal *ratios* — not equal metres — put the boundaries where the circle of
 * confusion actually changes: a band edge every few metres up close, every few
 * hundred out at the horizon.
 *
 * @param {SceneKey} scene
 * @returns {number[]} `DEPTH_BANDS - 1` ascending edges
 */
export function depthBandEdges(scene) {
  const cached = bandEdgeCache.get(scene);
  if (cached) return cached;
  const world = WORLD[scene] ?? WORLD.landscape;
  const nearest = Math.max(0.3, world.near * 0.5);
  const farthest = Math.max(nearest * 4, world.far);
  const interior = DEPTH_BANDS - 2;
  const ratio = Math.pow(farthest / nearest, 1 / interior);
  const edges = Array.from({ length: interior + 1 }, (_, index) => nearest * Math.pow(ratio, index));
  bandEdgeCache.set(scene, edges);
  return edges;
}

/**
 * Band holding an object this far from the tripod. Band 0 is everything closer
 * than the scenario's foreground, the last band is everything at or beyond its
 * horizon — including the sky, which has no distance at all.
 *
 * @param {SceneKey} scene
 * @param {number} distanceM
 * @returns {number}
 */
export function depthBandFor(scene, distanceM) {
  const edges = depthBandEdges(scene);
  const last = edges.length - 1;
  if (!(distanceM > edges[0])) return 0;
  if (distanceM >= edges[last]) return DEPTH_BANDS - 1;
  const ratio = edges[1] / edges[0];
  return 1 + Math.min(last - 1, Math.floor(Math.log(distanceM / edges[0]) / Math.log(ratio)));
}

/**
 * The distance a whole band is blurred as. Interior bands use the geometric mean
 * of their edges, which is the middle of a band whose extent is a ratio.
 *
 * @param {SceneKey} scene
 * @param {number} band
 * @returns {number} metres
 */
export function depthBandDistance(scene, band) {
  const edges = depthBandEdges(scene);
  const last = edges.length - 1;
  if (band <= 0) return edges[0] * 0.65;
  if (band >= DEPTH_BANDS - 1) return edges[last] * 2.5;
  return Math.sqrt(edges[band - 1] * edges[band]);
}

/**
 * Per-scenario world setup. Distances are metres, the tripod always sits at
 * world origin looking down -Z, and `focus` is the plane the camera locks onto.
 */
export const WORLD = {
  landscape: { cameraHeight: 1.7, focus: 90, near: 6, far: 900, pitch: 1.5, sky: ["#4a8fc8", "#ffd9a4"], fog: ["#dbe7ee", 0.0016], sun: ["#ffd7a1", 2.8, [-40, 26, 70]], ambient: ["#b8cddd", 0.24], bounce: ["#86b7d4", "#3b3328", 0.2] },
  // Shot from the deck of the birding tower, above the reed beds.
  bird: { cameraHeight: 6.0, focus: 30, near: 12, far: 420, pitch: 6, sky: ["#2f7fbe", "#d7ecf5"], fog: ["#cfe4ee", 0.0028], sun: ["#fff2d4", 2.55, [30, 40, 60]], ambient: ["#bcd7e6", 0.26], bounce: ["#74aad0", "#30463a", 0.22] },
    // The tripod is up in the near grandstand, five metres above the apron.
  sports: { cameraHeight: 7.05, focus: 30, near: 12, far: 260, pitch: -11, sky: ["#2b6fa8", "#d9eaf4"], fog: ["#dbe6ec", 0.0028], sun: ["#fff4dd", 2.8, [22, 34, 30]], ambient: ["#ccdae3", 0.26], bounce: ["#73a8cf", "#3d4c3e", 0.22] },
  // The key light is the sash window in the left wall, so the sun sits out beyond it.
  portrait: { cameraHeight: 1.2, focus: 4.2, near: 1.4, far: 9, pitch: -1, sky: ["#2b333c", "#4a5158"], fog: ["#3a4148", 0.009], sun: ["#ffe9c9", 2.6, [-7, 2.6, 2.2]], ambient: ["#9aa4b0", 0.22], bounce: ["#68727c", "#251e1a", 0.14] },
  group: { cameraHeight: 1.3, focus: 6.4, near: 2.6, far: 60, pitch: -1.5, sky: ["#3579ad", "#e8e2ca"], fog: ["#e3e2d2", 0.0045], sun: ["#ffeccb", 2.7, [16, 22, 18]], ambient: ["#cfd4cd", 0.26], bounce: ["#79acd0", "#4a4130", 0.22] },
  street: { cameraHeight: 1.6, focus: 11, near: 3, far: 170, pitch: 1.5, sky: ["#3a7cb4", "#e8ecec"], fog: ["#dfe6e8", 0.005], sun: ["#fff0d2", 2.6, [-24, 30, 26]], ambient: ["#c9d1d7", 0.23], bounce: ["#6f9fc1", "#383b3b", 0.18] },
  night: { cameraHeight: 1.6, focus: 8, near: 2.4, far: 150, pitch: 1, sky: ["#05070f", "#2b1f45"], fog: ["#151122", 0.0125], sun: ["#7d8ad0", 0.34, [-10, 18, -20]], ambient: ["#4a4269", 0.045], bounce: ["#182347", "#08070d", 0.035] },
  // Low enough that the terrace, tents and campfire anchor the bottom of the frame.
  starry: { cameraHeight: 1.7, focus: 4000, near: 4.5, far: 4000, pitch: 9, sky: ["#020409", "#080d1a"], fog: ["#03050d", 0.0003], sun: ["#313b5e", 0.03, [-15, 22, -30]], ambient: ["#0f1424", 0.012], bounce: ["#080c18", "#020306", 0.008] },
    // Up on the overlook's second level, clear of its own balustrade.
  city_night: { cameraHeight: 4.8, focus: 850, near: 9, far: 3200, pitch: 0, sky: ["#060814", "#151b2e"], fog: ["#090d1c", 0.0006], sun: ["#7986cb", 0.3, [-30, 25, -40]], ambient: ["#242b45", 0.05], bounce: ["#0f1422", "#070a12", 0.035] },
    // A raised spotter deck: the tripod clears the perimeter fence entirely.
  airport: { cameraHeight: 6.0, focus: 300, near: 14, far: 2800, pitch: -0.8, sky: ["#3682c2", "#d5e8f6"], fog: ["#cde3ef", 0.0016], sun: ["#fff2d8", 2.85, [-32, 36, 48]], ambient: ["#c2d6e4", 0.26], bounce: ["#7cb0d4", "#3a4a3e", 0.22] },
  outdoor_portrait: { cameraHeight: 1.45, focus: 3.8, near: 1.2, far: 38, pitch: -0.5, sky: ["#3b8ecc", "#e6f2d4"], fog: ["#d9ead6", 0.004], sun: ["#fff1cf", 2.7, [18, 28, 24]], ambient: ["#cfdfcd", 0.25], bounce: ["#7bb568", "#384a28", 0.22] },
};

/**
 * Reflected-light metering adjustment for the part of the world the camera is
 * aimed at. Bright emitters lift the reading; dark, obliquely lit surfaces pull
 * it down. Keeping this pure makes the photographic response testable without
 * a WebGL context.
 *
 * @param {{sunAlignment?: number, surfaceLuminance?: number | null, incidence?: number, emissiveLuminance?: number}} sample
 * @returns {number} exposure-value adjustment in stops
 */
export function viewMeterAdjustment({ sunAlignment = 0, surfaceLuminance = null, incidence = 1, emissiveLuminance = 0 }) {
  const emitterEv = sunAlignment > 0.94 ? ((sunAlignment - 0.94) / 0.06) * 2.4 : 0;
  if (surfaceLuminance === null) return Math.max(-0.45, Math.min(2.4, emitterEv - 0.2));
  const reflected = Math.max(0.04, surfaceLuminance + emissiveLuminance * 0.55);
  const reflectanceEv = Math.log2(reflected / 0.32);
  const shadeEv = -1.15 * (1 - Math.max(0, Math.min(1, incidence)));
  return Math.max(-2.5, Math.min(2.5, reflectanceEv + shadeEv + emitterEv));
}

/** Tripod head travel. Wide scenes allow a broader sweep than tight interiors. */
export const LOOK_LIMITS = {
  landscape: { yaw: 62, pitchUp: 22, pitchDown: 16 },
  bird: { yaw: 58, pitchUp: 34, pitchDown: 14 },
  sports: { yaw: 46, pitchUp: 26, pitchDown: 6 },
  portrait: { yaw: 26, pitchUp: 14, pitchDown: 14 },
  group: { yaw: 34, pitchUp: 15, pitchDown: 13 },
  street: { yaw: 52, pitchUp: 26, pitchDown: 16 },
  night: { yaw: 52, pitchUp: 26, pitchDown: 16 },
  starry: { yaw: 65, pitchUp: 52, pitchDown: 20 },
  city_night: { yaw: 65, pitchUp: 20, pitchDown: 12 },
  airport: { yaw: 68, pitchUp: 34, pitchDown: 7 },
  outdoor_portrait: { yaw: 36, pitchUp: 16, pitchDown: 14 },
};

/**
 * Circle of confusion on the sensor, in millimetres, for an object that sits a
 * different distance away than the focused plane.
 *
 * @param {number} focalMm lens focal length
 * @param {number} fNumber aperture f-number
 * @param {number} focusMm distance of the focused plane
 * @param {number} objectMm distance of the object being measured
 * @returns {number}
 */
export function circleOfConfusionMm(focalMm, fNumber, focusMm, objectMm) {
  if (!(focalMm > 0) || !(fNumber > 0)) throw new RangeError("Focal length and f-number must be positive");
  if (!(focusMm > focalMm) || !(objectMm > 0)) return 0;
  return ((focalMm * focalMm) / fNumber) * (Math.abs(objectMm - focusMm) / (objectMm * (focusMm - focalMm)));
}

/**
 * Defocus blur radius expressed in rendered pixels, so a capture can blur a
 * depth band by an amount that follows real optics instead of a guess.
 *
 * @param {{focalMm: number, fNumber: number, focusM: number, objectM: number, imageWidthPx: number, sensorWidthMm?: number, maxPx?: number}} input
 * @returns {number}
 */
export function defocusBlurPixels({ focalMm, fNumber, focusM, objectM, imageWidthPx, sensorWidthMm = FULL_FRAME_SENSOR_WIDTH_MM, maxPx = 34 }) {
  const coc = circleOfConfusionMm(focalMm, fNumber, focusM * 1000, objectM * 1000);
  return Math.min(maxPx, (coc / sensorWidthMm) * imageWidthPx * 0.5);
}

/**
 * Blur radius for each depth bucket of one scenario.
 *
 * `focusM` is whatever the AF frame is actually sitting on and `subjectM` is where
 * the subject stands right now, which for a walking or flying one is not the
 * scenario's nominal plane. Both fall back to that plane, so a call without them
 * describes the old fixed-focus camera and returns a perfectly sharp subject.
 *
 * @param {SceneKey} scene
 * @param {{focalMm: number, fNumber: number, imageWidthPx: number, focusM?: number, subjectM?: number}} camera
 * @returns {{near: number, subject: number, far: number}}
 */
export function depthBlurPlan(scene, { focalMm, fNumber, imageWidthPx, focusM, subjectM }) {
  const world = WORLD[scene] ?? WORLD.landscape;
  const plane = focusM > 0 ? focusM : world.focus;
  const at = objectM => defocusBlurPixels({ focalMm, fNumber, focusM: plane, objectM, imageWidthPx });
  return { near: at(world.near), subject: at(subjectM > 0 ? subjectM : world.focus), far: at(world.far) };
}

/**
 * Blur radius for every depth band of one scenario, indexed by band.
 *
 * @param {SceneKey} scene
 * @param {{focalMm: number, fNumber: number, imageWidthPx: number, focusM?: number}} camera
 * @returns {number[]} `DEPTH_BANDS` radii in rendered pixels
 */
export function depthBandBlur(scene, { focalMm, fNumber, imageWidthPx, focusM }) {
  const world = WORLD[scene] ?? WORLD.landscape;
  const plane = focusM > 0 ? focusM : world.focus;
  return Array.from({ length: DEPTH_BANDS }, (_, band) => defocusBlurPixels({
    focalMm, fNumber, imageWidthPx, focusM: plane, objectM: depthBandDistance(scene, band),
  }));
}

/** Two bands a photograph cannot tell apart, so they may share one render pass. */
function indistinguishable(a, b) {
  if (a <= SHARP_BLUR_PX && b <= SHARP_BLUR_PX) return true;
  return Math.abs(a - b) <= Math.max(0.5, Math.max(a, b) * 0.2);
}

/**
 * Plan the render passes one capture needs, ordered far to near.
 *
 * Every occupied band could be rendered and blurred on its own, but that costs a
 * full-resolution readback per band per exposure sample. Bands whose circles of
 * confusion are within a fifth of each other are indistinguishable once blurred,
 * so they collapse into a single pass: a landscape at f/11 comes out as one
 * render, while a portrait wide open still resolves its background falloff.
 *
 * @param {SceneKey} scene
 * @param {{layers: number[], bandBlur: number[], subjectBlur?: number, subjectM?: number, maxPasses?: number}} plan
 * @returns {{layers: number[], blur: number}[]}
 */
export function depthPasses(scene, { layers, bandBlur, subjectBlur = 0, subjectM = 0, maxPasses = 6 }) {
  const world = WORLD[scene] ?? WORLD.landscape;
  const entries = [];
  for (const layer of layers) {
    if (layer === SUBJECT_LAYER) entries.push({ layer, distance: subjectM > 0 ? subjectM : world.focus, blur: subjectBlur });
    else if (layer >= DEPTH_LAYER_BASE && layer < DEPTH_LAYER_BASE + DEPTH_BANDS) {
      const band = layer - DEPTH_LAYER_BASE;
      entries.push({ layer, distance: depthBandDistance(scene, band), blur: bandBlur[band] ?? 0 });
    }
  }
  if (!entries.length) return [];
  entries.sort((a, b) => b.distance - a.distance);

  const passes = [];
  for (const entry of entries) {
    const open = passes[passes.length - 1];
    if (open && indistinguishable(open.blur, entry.blur)) {
      open.layers.push(entry.layer);
      open.blur += (entry.blur - open.blur) / open.layers.length;
    } else passes.push({ layers: [entry.layer], blur: entry.blur });
  }

  // A cap on passes is a cap on readbacks per exposure sample. Give up the
  // smallest blur difference first, so what is sacrificed is what shows least.
  while (passes.length > maxPasses) {
    let seam = 0;
    for (let index = 1; index < passes.length - 1; index += 1) {
      if (Math.abs(passes[index].blur - passes[index + 1].blur) < Math.abs(passes[seam].blur - passes[seam + 1].blur)) seam = index;
    }
    const [merged] = passes.splice(seam + 1, 1);
    const host = passes[seam];
    const weight = merged.layers.length / (host.layers.length + merged.layers.length);
    host.blur += (merged.blur - host.blur) * weight;
    host.layers.push(...merged.layers);
  }
  return passes;
}
