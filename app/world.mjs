import { FULL_FRAME_SENSOR_WIDTH_MM } from "./optics.mjs";

/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night"} SceneKey
 */

/** Render buckets. Objects are grouped by depth so a capture can blur each band independently. */
export const LAYER = { far: 0, subject: 1, near: 2 };

/**
 * Per-scenario world setup. Distances are metres, the tripod always sits at
 * world origin looking down -Z, and `focus` is the plane the camera locks onto.
 */
export const WORLD = {
  landscape: { cameraHeight: 1.7, focus: 90, near: 6, far: 900, pitch: 1.5, sky: ["#4a8fc8", "#ffd9a4"], fog: ["#dbe7ee", 0.0016], sun: ["#ffd7a1", 1.25, [-40, 26, -70]], ambient: ["#b8cddd", 0.86] },
  bird: { cameraHeight: 1.6, focus: 28, near: 4, far: 420, pitch: 15, sky: ["#2f7fbe", "#d7ecf5"], fog: ["#cfe4ee", 0.0028], sun: ["#fff2d4", 1.1, [30, 40, -60]], ambient: ["#bcd7e6", 0.84] },
  sports: { cameraHeight: 1.6, focus: 20, near: 5, far: 260, pitch: -1.5, sky: ["#2b6fa8", "#d9eaf4"], fog: ["#dbe6ec", 0.0028], sun: ["#fff4dd", 1.25, [22, 34, -30]], ambient: ["#ccdae3", 0.88] },
  portrait: { cameraHeight: 1.2, focus: 4.2, near: 1.4, far: 9, pitch: -1, sky: ["#2b333c", "#4a5158"], fog: ["#3a4148", 0.009], sun: ["#ffe9c9", 1.5, [-2.5, 1.8, 5]], ambient: ["#9aa4b0", 0.9] },
  group: { cameraHeight: 1.3, focus: 6.4, near: 2.6, far: 60, pitch: -1.5, sky: ["#3579ad", "#e8e2ca"], fog: ["#e3e2d2", 0.0045], sun: ["#ffeccb", 1.2, [16, 22, -18]], ambient: ["#cfd4cd", 0.9] },
  street: { cameraHeight: 1.6, focus: 11, near: 3, far: 170, pitch: 1.5, sky: ["#3a7cb4", "#e8ecec"], fog: ["#dfe6e8", 0.005], sun: ["#fff0d2", 1.15, [-24, 30, -26]], ambient: ["#c9d1d7", 0.86] },
  night: { cameraHeight: 1.6, focus: 8, near: 2.4, far: 150, pitch: 1, sky: ["#05070f", "#2b1f45"], fog: ["#151122", 0.0125], sun: ["#7d8ad0", 0.42, [-10, 18, -20]], ambient: ["#4a4269", 0.78] },
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
  bird: { yaw: 58, pitchUp: 34, pitchDown: 12 },
  sports: { yaw: 46, pitchUp: 18, pitchDown: 14 },
  portrait: { yaw: 26, pitchUp: 14, pitchDown: 14 },
  group: { yaw: 34, pitchUp: 15, pitchDown: 13 },
  street: { yaw: 52, pitchUp: 26, pitchDown: 16 },
  night: { yaw: 52, pitchUp: 26, pitchDown: 16 },
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
