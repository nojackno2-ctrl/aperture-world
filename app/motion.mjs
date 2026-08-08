/**
 * @typedef {"landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night" | "starry" | "city_night" | "airport" | "outdoor_portrait"} SceneKey
 * @typedef {{ x: number, y: number, z: number, yaw: number, pitch: number, tilt: number, phase: number, moving: boolean }} SubjectPose
 */

/**
 * Primary default route per scenario, kept in step with `MULTI_ROUTES[key][0]`.
 * These are the laps a photographer pans with, so each one is a closed circuit.
 */
export const ROUTES = {
  bird: { duration: 10.8, center: [0, 8.2, -28], radius: [27, 8], lift: 1.1, bob: 0.24, bobRate: 6, bank: 13, direction: 1 },
  sports: { duration: 8.4, center: [0, 0.06, -32.5], radius: [24, 12], lift: 0, bob: 0.05, bobRate: 16, bank: 3, direction: 1 },
  street: { duration: 12.8, center: [0, 6.5, -22], radius: [14, 8], lift: 1.0, bob: 0.2, bobRate: 6, bank: 8, direction: 1 },
  night: { duration: 14.5, center: [0, 7.0, -20], radius: [12, 7], lift: 0.8, bob: 0.15, bobRate: 6, bank: 6, direction: -1 },
};

/**
 * World-space subject routes in metres. Animals, aircraft, and vehicles enter from off-screen,
 * cross through the environment naturally, and exit off-screen before looping.
 * Vehicles drive strictly on the asphalt road lanes and runways.
 */
export const MULTI_ROUTES = {
  // Ground animals stand on the ground: every builder's origin is at its feet, so
  // a walking route only lifts them clear by the depth of a hoof.
  landscape: [
    { type: "orbit", duration: 16.0, center: [0, 0.05, -42], radius: [25, 6], lift: 0, bob: 0.04, bobRate: 6, bank: 1, direction: 1 },
    { type: "line", duration: 22.0, start: [45, 0.05, -62], end: [-45, 0.05, -34], bob: 0.04, bobRate: 10 },
    { type: "line", duration: 16.0, start: [-55, 28, -140], end: [55, 22, -110], bank: 5 },
    { type: "line", duration: 10.0, start: [-35, 0.14, -16], end: [35, 0.14, -20], bob: 0.12, bobRate: 16 },
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

  // Five sprinters, each locked to one marked lane of the oval. The lane ellipse
  // is exactly the track band the builder lays down: radius [2r, r] about
  // z = -32.5, with r = 11.2 + laneIndex * 1.6 + 0.8 for the lane centre.
  sports: [
    { type: "orbit", duration: 8.4, center: [0, 0.06, -32.5], radius: [24, 12], lift: 0, bob: 0.05, bobRate: 16, bank: 3, direction: 1 },
    { type: "orbit", duration: 8.9, center: [0, 0.06, -32.5], radius: [27.2, 13.6], lift: 0, bob: 0.05, bobRate: 15, bank: 3, direction: 1 },
    { type: "orbit", duration: 9.4, center: [0, 0.06, -32.5], radius: [30.4, 15.2], lift: 0, bob: 0.05, bobRate: 17, bank: 3, direction: 1 },
    { type: "orbit", duration: 9.9, center: [0, 0.06, -32.5], radius: [33.6, 16.8], lift: 0, bob: 0.05, bobRate: 14, bank: 3, direction: 1 },
    { type: "orbit", duration: 10.4, center: [0, 0.06, -32.5], radius: [36.8, 18.4], lift: 0, bob: 0.05, bobRate: 18, bank: 3, direction: 1 },
  ],

  // The sitter is posed on the chair at the anchor; the cat crosses the floor.
  portrait: [
    { type: "orbit", duration: 10, center: [0, 0.02, -4.2], radius: [0, 0] },
    { type: "line", duration: 14.0, start: [-3.2, 0.02, -2.4], end: [2.6, 0.02, -2.8], bob: 0.02, bobRate: 8 },
  ],

  // Three guests in front on the paving, four behind on the low step (top 0.23 m).
  group: [
    { type: "orbit", duration: 10, center: [-1.4, 0.02, -5.6], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [0, 0.02, -5.5], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [1.4, 0.02, -5.6], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [-2.1, 0.24, -6.8], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [-0.7, 0.24, -6.8], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [0.7, 0.24, -6.8], radius: [0, 0] },
    { type: "orbit", duration: 10, center: [2.1, 0.24, -6.8], radius: [0, 0] },
  ],

  // Right-hand traffic: travelling -Z keeps to +X, travelling +Z keeps to -X.
  // Pedestrians stay on the raised footway (top 0.26 m), never in a lane.
  street: [
    { type: "orbit", duration: 12.8, center: [0, 6.5, -22], radius: [14, 8], lift: 1.0, bob: 0.2, bobRate: 6, bank: 8, direction: 1 },
    { type: "line", duration: 15.5, start: [-7.6, 0.35, -62], end: [-7.6, 0.35, 12], bob: 0.045, bobRate: 12 },
    { type: "line", duration: 14.5, start: [7.6, 0.35, 12], end: [7.6, 0.35, -62], bob: 0.045, bobRate: 11 },
    { type: "line", duration: 9.0, start: [-2.6, 0.02, -120], end: [-2.6, 0.02, 15] },
    { type: "line", duration: 10.5, start: [2.6, 0.02, 15], end: [2.6, 0.02, -120] },
    { type: "line", duration: 11.0, start: [-8.6, 0.30, -45], end: [-8.6, 0.30, 10], bob: 0.04, bobRate: 14 },
  ],

  // Same rule after dark; the footway here is 0.28 m above the carriageway.
  night: [
    { type: "orbit", duration: 14.5, center: [0, 7.0, -20], radius: [12, 7], lift: 0.8, bob: 0.15, bobRate: 6, bank: 6, direction: -1 },
    { type: "line", duration: 17.0, start: [-7.8, 0.36, -52], end: [-7.8, 0.36, 10], bob: 0.04, bobRate: 10 },
    { type: "line", duration: 16.0, start: [7.8, 0.36, 10], end: [7.8, 0.36, -52], bob: 0.04, bobRate: 9 },
    { type: "line", duration: 9.5, start: [-2.8, 0.02, -120], end: [-2.8, 0.02, 15] },
    { type: "line", duration: 8.5, start: [2.8, 0.02, 15], end: [2.8, 0.02, -120] },
    { type: "line", duration: 12.0, start: [9.2, 0.30, 10], end: [9.2, 0.30, -45], bob: 0.03, bobRate: 10 },
  ],

  // The stargazer is subject 0: he stands on the terrace deck (top 0.245 m).
  starry: [
    { type: "orbit", duration: 10, center: [0, 0.245, -6.5], radius: [0, 0] },
    { type: "line", duration: 8.5, start: [-65, 45, -120], end: [65, 25, -80], bank: 6 },
  ],

  // Both cars run on the near highway deck (surface y = -38), each in its own
  // direction of travel, so their lights match the painted head/tail streams.
  city_night: [
    { type: "line", duration: 15.0, start: [-880, -37.98, -497], end: [880, -37.98, -497], bob: 0.02, bobRate: 10 },
    { type: "line", duration: 17.0, start: [880, -37.98, -503], end: [-880, -37.98, -503], bob: 0.02, bobRate: 10 },
    { type: "orbit", duration: 22.0, center: [0, 45, -600], radius: [90, 40], lift: 4, bob: 0.05, bobRate: 6, bank: 3, direction: -1 },
  ],

  // Aircraft roll on the runway. The jetliner's origin is its fuselage centre and
  // its main wheels hang 1.6 m below it, so y = 1.63 puts rubber on the concrete
  // of the runway at z = -260. Both movements run in the same direction.
  airport: [
    {
      type: "path", duration: 26.0, pitchGain: 0.55, bank: 0,
      points: [
        [-1700, 165, -260], [-1150, 92, -260], [-880, 26, -260], [-760, 3.2, -260], [-690, 1.63, -260],
        [-380, 1.63, -260], [-80, 1.63, -260], [180, 1.63, -260], [330, 1.63, -244], [430, 1.63, -215],
        [560, 1.63, -200], [1100, 1.63, -200], [1900, 1.63, -200],
      ],
    },
    {
      type: "path", duration: 24.0, pitchGain: 0.6, bank: 0,
      points: [
        [-1500, 1.63, -330], [-1000, 1.63, -330], [-880, 1.63, -318], [-820, 1.63, -285], [-800, 1.63, -260],
        [-500, 1.63, -260], [-180, 1.63, -260], [60, 12, -260], [400, 48, -260], [820, 96, -260],
        [1500, 165, -260], [2200, 240, -260],
      ],
    },
    { type: "line", duration: 26.0, start: [420, 0.02, -120], end: [-420, 0.02, -120], bob: 0.02, bobRate: 14 },
  ],

  outdoor_portrait: [
    { type: "orbit", duration: 10, center: [0, 0.02, -3.8], radius: [0, 0] },
    { type: "orbit", duration: 8.0, center: [0.8, 1.4, -3.5], radius: [1.2, 0.6], lift: 0.3, bob: 0.12, bobRate: 12, bank: 6, direction: 1 },
  ],
};

/** Subjects that hold still; the scene still needs their anchor. */
export const ANCHORS = {
  landscape: [0, 0, -90],
  portrait: [0, 0.02, -4.2],
  group: [0, 0.02, -6.4],
  starry: [0, 0.245, -6.5],
  city_night: [0, 3.4, -3.0],
  airport: [0, 0.02, -12],
  outdoor_portrait: [0, 0.02, -3.8],
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
    const defaultAnchor = ANCHORS[scene] ?? [0, 0.02, -6];
    const [x, y, z] = defaultAnchor;
    return { x, y, z, yaw: 0, pitch: 0, tilt: 0, phase: 0, moving: false };
  }

  const phase = ((((seconds / route.duration) + phaseOffset) % 1) + 1) % 1;

  // A waypoint path is what lets an aircraft descend, touch the runway, roll out
  // and turn off it, instead of sliding along one straight line through the air.
  if (route.type === "path" && route.points && route.points.length > 1) {
    const spans = route.points.length - 1;
    const travelled = phase * spans;
    const segment = Math.min(spans - 1, Math.floor(travelled));
    const along = travelled - segment;
    const [x1, y1, z1] = route.points[segment];
    const [x2, y2, z2] = route.points[segment + 1];
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const ground = Math.hypot(dx, dz);
    const climb = -Math.atan2(dy, ground || 1e-6) * 180 / Math.PI * (route.pitchGain ?? 0.6);
    return {
      x: x1 + dx * along,
      y: y1 + dy * along + (route.bob || 0) * Math.sin(phase * Math.PI * (route.bobRate || 10)),
      z: z1 + dz * along,
      yaw: Math.atan2(dx, dz) * 180 / Math.PI,
      pitch: Math.max(-20, Math.min(20, climb)),
      tilt: route.bank || 0,
      phase,
      moving: true,
    };
  }

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
      pitch: 0,
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
      pitch: 0,
      tilt: (route.bank || 0) * Math.cos(travelAngle),
      phase,
      moving: true,
    };
  }

  const defaultPos = route.center || ANCHORS[scene] || [0, 0.02, -6];
  return { x: defaultPos[0], y: defaultPos[1], z: defaultPos[2], yaw: 0, pitch: 0, tilt: 0, phase: 0, moving: false };
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
