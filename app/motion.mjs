/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night"} SceneKey
 * @typedef {{ x: number, y: number, z: number, yaw: number, tilt: number, phase: number, moving: boolean }} SubjectPose
 */

/** Primary default route per scenario for backwards compatibility. */
export const ROUTES = {
  bird: { duration: 10.8, center: [0, 8.2, -30], radius: [27, 8], lift: 1.1, bob: 0.24, bobRate: 6, bank: 13, direction: 1 },
  sports: { duration: 8.4, center: [0, 1, -21], radius: [13, 6], lift: 0, bob: 0.09, bobRate: 16, bank: 4, direction: 1 },
  street: { duration: 12.8, center: [0, 0.95, -13.75], radius: [8, 4.25], lift: 0, bob: 0.055, bobRate: 12, bank: 2.5, direction: 1 },
  night: { duration: 14.5, center: [0, 1, -10.5], radius: [7, 3.5], lift: 0, bob: 0.05, bobRate: 10, bank: 2, direction: -1 },
};

/**
 * World-space subject routes in metres. Animals and vehicles enter from off-screen,
 * cross through the environment naturally, and exit off-screen before looping.
 * Vehicles drive strictly on the asphalt road lanes.
 */
export const MULTI_ROUTES = {
  landscape: [
    { type: "orbit", duration: 16.0, center: [0, 0.9, -42], radius: [25, 6], lift: 0, bob: 0.04, bobRate: 6, bank: 1, direction: 1 },
    { type: "line", duration: 22.0, start: [45, 0.9, -70], end: [-45, 0.9, -36], bob: 0.04, bobRate: 10 },
    { type: "line", duration: 16.0, start: [-55, 28, -140], end: [55, 22, -110], bank: 5 },
    { type: "line", duration: 10.0, start: [-35, 0.45, -16], end: [35, 0.45, -20], bob: 0.12, bobRate: 16 },
  ],

  bird: [
    { type: "orbit", duration: 10.8, center: [0, 8.2, -28], radius: [27, 8], lift: 1.1, bob: 0.24, bobRate: 6, bank: 13, direction: 1 },
    { type: "line", duration: 8.5, start: [55, 5, -20], end: [-55, 7, -28], bank: -6 },
    { type: "line", duration: 13.0, start: [-50, 18, -48], end: [50, 15, -38], bank: 10 },
    { type: "line", duration: 15.0, start: [60, 22, -55], end: [-60, 16, -42], bank: -8 },
    { type: "line", duration: 9.5, start: [-45, 8, -18], end: [45, 11, -24], bank: 7 },
    { type: "line", duration: 12.5, start: [50, 12, -32], end: [-50, 9, -36], bank: -5 },
    { type: "line", duration: 7.8, start: [-40, 5, -14], end: [40, 8, -16], bank: 6 },
  ],

  sports: [
    { type: "orbit", duration: 8.4, center: [0, 1, -21], radius: [13, 6], lift: 0, bob: 0.09, bobRate: 16, bank: 4, direction: 1 },
    { type: "line", duration: 7.1, start: [-2.6, 0.95, -60], end: [-2.6, 0.95, 10], bob: 0.09, bobRate: 19 },
    { type: "line", duration: 7.9, start: [2.6, 0.95, -60], end: [2.6, 0.95, 10], bob: 0.09, bobRate: 17 },
    { type: "line", duration: 6.8, start: [-5.2, 0.95, -60], end: [-5.2, 0.95, 10], bob: 0.09, bobRate: 20 },
    { type: "line", duration: 8.2, start: [5.2, 0.95, -60], end: [5.2, 0.95, 10], bob: 0.09, bobRate: 16 },
  ],

  portrait: [
    { type: "orbit", duration: 10, center: [0, 0.75, -4.2], radius: [0, 0] },
    { type: "line", duration: 14.0, start: [-2.0, 0.52, -4.8], end: [1.8, 0.52, -4.4], bob: 0.02, bobRate: 8 },
  ],

  group: [
    { type: "orbit", duration: 10, center: [-1.4, 0.80, -5.5], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [0, 0.80, -5.4], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [1.4, 0.80, -5.5], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [-2.1, 0.92, -6.8], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [-0.7, 0.92, -6.6], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [0.7, 0.92, -6.6], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [2.1, 0.92, -6.8], radius: [0, 0] },
  ],

  street: [
    { type: "orbit", duration: 12.8, center: [0, 0.95, -13.75], radius: [8, 4.25], lift: 0, bob: 0.055, bobRate: 12, bank: 2.5, direction: 1 },
    { type: "line", duration: 14.5, start: [7.2, 0.95, 10], end: [7.2, 0.95, -50], bob: 0.055, bobRate: 11 },
    { type: "line", duration: 9.0, start: [2.6, 0.7, -120], end: [2.6, 0.7, 15] },
    { type: "line", duration: 10.5, start: [-2.6, 0.7, 15], end: [-2.6, 0.7, -120] },
    { type: "line", duration: 11.0, start: [-6.8, 0.5, -45], end: [-6.8, 0.5, 10], bob: 0.04, bobRate: 14 },
    { type: "line", duration: 6.5, start: [-45, 3.5, -25], end: [45, 4.2, -15], bank: 5 },
  ],

  night: [
    { type: "orbit", duration: 14.5, center: [0, 1, -10.5], radius: [7, 3.5], lift: 0, bob: 0.05, bobRate: 10, bank: 2, direction: -1 },
    { type: "line", duration: 16.5, start: [7.0, 1.0, 10], end: [7.0, 1.0, -50], bob: 0.05, bobRate: 9 },
    { type: "line", duration: 9.5, start: [2.8, 0.75, -120], end: [2.8, 0.75, 15] },
    { type: "line", duration: 8.5, start: [-2.8, 0.7, 15], end: [-2.8, 0.7, -120] },
    { type: "line", duration: 12.0, start: [8.2, 0.4, 10], end: [8.2, 0.4, -45], bob: 0.03, bobRate: 10 },
    { type: "line", duration: 11.0, start: [-45, 12, -28], end: [45, 10, -18], bank: 8 },
  ],
};

/** Subjects that hold still; the scene still needs their anchor. */
export const ANCHORS = {
  landscape: [0, 0, -90],
  portrait: [0, 0.75, -4.2],
  group: [0, 0.62, -6.4],
};

/**
 * Deterministic world-space pose of a scenario's subject at an elapsed time.
 *
 * @param {SceneKey} scene
 * @param {number} seconds
 * @param {number} [phaseOffset=0] fraction of a lap, used to spread a flock
 * @param {number} [subjectIndex=0] index of the subject in the scenario
 * @returns {SubjectPose}
 */
export function subjectPath(scene, seconds, phaseOffset = 0, subjectIndex = 0) {
  const routes = MULTI_ROUTES[scene];
  const route = (routes && routes[subjectIndex % routes.length]) || ROUTES[scene];
  if (!route) {
    const defaultAnchor = ANCHORS[scene] ?? [0, 0.9, -6];
    const [x, y, z] = defaultAnchor;
    return { x, y, z, yaw: 0, tilt: 0, phase: 0, moving: false };
  }

  const phase = ((((seconds / route.duration) + phaseOffset) % 1) + 1) % 1;

  if (route.type === "line" && route.start && route.end) {
    const [x1, y1, z1] = route.start;
    const [x2, y2, z2] = route.end;
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const step = Math.sin(phase * Math.PI * (route.bobRate || 10));
    const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    return {
      x: x1 + dx * phase,
      y: y1 + dy * phase + (route.bob || 0) * step,
      z: z1 + dz * phase,
      yaw,
      tilt: route.bank || 0,
      phase,
      moving: true,
    };
  }

  if (route.radius && (route.radius[0] > 0 || route.radius[1] > 0)) {
    const angle = phase * Math.PI * 2;
    const step = Math.sin(angle * (route.bobRate || 6));
    const travelAngle = angle * (route.direction || 1);
    const dx = route.radius[0] * Math.cos(travelAngle) * (route.direction || 1);
    const dz = -route.radius[1] * Math.sin(travelAngle) * (route.direction || 1);
    return {
      x: route.center[0] + route.radius[0] * Math.sin(travelAngle),
      y: route.center[1] + (route.lift || 0) * Math.sin(angle) + (route.bob || 0) * step,
      z: route.center[2] + route.radius[1] * Math.cos(travelAngle),
      yaw: Math.atan2(dx, -dz) * 180 / Math.PI,
      tilt: (route.bank || 0) * Math.cos(travelAngle),
      phase,
      moving: true,
    };
  }

  const defaultPos = route.center || ANCHORS[scene] || [0, 0.9, -6];
  return { x: defaultPos[0], y: defaultPos[1], z: defaultPos[2], yaw: 0, tilt: 0, phase: 0, moving: false };
}

/**
 * Sub-frame poses spanning one exposure, used to accumulate real motion blur.
 *
 * @param {SceneKey} scene
 * @param {number} seconds shutter-open time
 * @param {number} exposureSeconds shutter duration
 * @param {number} samples number of sub-frames
 * @param {number} [subjectIndex=0]
 * @returns {SubjectPose[]}
 */
export function exposureSamples(scene, seconds, exposureSeconds, samples, subjectIndex = 0) {
  const count = Math.max(1, Math.round(samples));
  return Array.from({ length: count }, (_, index) => subjectPath(scene, seconds + (exposureSeconds * index) / count, 0, subjectIndex));
}
