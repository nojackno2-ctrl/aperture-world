import { FULL_FRAME_SENSOR_WIDTH_MM } from "./optics.mjs";

/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night" | "starry" | "city_night" | "airport" | "outdoor_portrait"} SceneKey
 */

/** Render buckets. Objects are grouped by depth so a capture can blur each band independently. */
export const LAYER = { far: 0, subject: 1, near: 2 };

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
