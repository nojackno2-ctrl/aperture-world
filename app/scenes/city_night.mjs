import { LAYER } from "../world.mjs";
import { bench, block, build3DBat, build3DBird, build3DCar, build3DFox, build3DHuman, build3DPerchedBird, contactShadow, cylinder, facadeBlock, facadeTexture, put, rand, slab, sphere, tree } from "../scene-kit.mjs";

/** Static world for the `city_night` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  // Summit plateau, a mountainside that actually falls away, then the valley floor
  // the whole city stands on. Everything below reads at its true altitude.
  // The summit is small on purpose: the ground has to fall away a few metres
  // past the balustrade, or the flat top fills two-thirds of the frame and the
  // city never gets to be the picture.
  slab(THREE, scene, 240, 26, "#0b1220", [0, -0.02, 0], LAYER.far);
  const CLIFF_TOP = -13, CLIFF_RUN = 7.5, CLIFF_FALL = 3.1;
  const cliffY = z => -1.6 - ((CLIFF_TOP - z) / CLIFF_RUN) * CLIFF_FALL;
  for (let step = 0; step < 14; step += 1) {
    const y = -1.6 - step * CLIFF_FALL, z = CLIFF_TOP - step * CLIFF_RUN;
    // The riser spans from the level above down to this one. The first one is
    // only 1.6 m, not a full step: sized as a full step it becomes a wall that
    // stands proud of the summit and hides the entire valley.
    const above = step === 0 ? 0 : y + CLIFF_FALL;
    slab(THREE, scene, 320 + step * 130, 10, step % 2 ? "#080e1a" : "#0a1220", [0, y, z], LAYER.far);
    block(THREE, scene, [320 + step * 130, above - y, 1.0], "#070c16", [0, (above + y) / 2, z + CLIFF_RUN / 2], LAYER.far);
  }
  slab(THREE, scene, 3600, 2800, "#070c17", [0, -40, -1500], LAYER.far);
  // Mountain overlook terrace. It is deliberately shallow: a deep terrace puts
  // an unlit slab across half the frame and leaves no room for the city.
  slab(THREE, scene, 22, 9, "#22304a", [0, 0.05, -4], LAYER.far);
  block(THREE, scene, [22, 1.1, 0.4], "#3d4a61", [0, 0.55, -8.2], LAYER.far);
  block(THREE, scene, [0.4, 1.1, 9], "#3d4a61", [-10.5, 0.55, -4], LAYER.far);
  block(THREE, scene, [0.4, 1.1, 9], "#3d4a61", [10.5, 0.55, -4], LAYER.far);
  block(THREE, scene, [22, 0.14, 0.62], "#55637c", [0, 1.1, -8.2], LAYER.far);
  for (let baluster = 0; baluster < 21; baluster += 1) {
    cylinder(THREE, scene, 0.06, 0.08, 0.9, "#4a5670", [-10 + baluster, 0.5, -8.2], LAYER.far, {}, 6);
  }

  // Upper observation level. Standing a storey above the balustrade is what
  // takes the railing out of the frame: from up here it sits well below the
  // steepest downward look, and the city gets the whole picture.
  block(THREE, scene, [16, 0.3, 11], "#2a3852", [0, 3.05, -1.0], LAYER.far);
  block(THREE, scene, [16, 0.55, 0.45], "#33425e", [0, 2.92, -6.3], LAYER.far);
  for (const [cx, cz] of [[-7, -5.2], [7, -5.2], [-7, 3.2], [7, 3.2], [0, -5.2], [0, 3.2]]) {
    cylinder(THREE, scene, 0.26, 0.34, 2.9, "#233047", [cx, 1.45, cz], LAYER.far, {}, 8);
  }
  for (const sideX of [-7.9, 7.9]) {
    for (let post = 0; post < 4; post += 1) cylinder(THREE, scene, 0.055, 0.055, 1.05, "#46536d", [sideX, 3.72, 0.4 + post * 1.3], LAYER.far, {}, 6);
    block(THREE, scene, [0.08, 0.08, 4.4], "#46536d", [sideX, 4.2, 2.4], LAYER.far);
  }
  for (let post = 0; post < 8; post += 1) cylinder(THREE, scene, 0.055, 0.055, 1.05, "#46536d", [-7.9 + post * 2.26, 3.72, 4.4], LAYER.far, {}, 6);
  block(THREE, scene, [16, 0.08, 0.08], "#46536d", [0, 4.2, 4.4], LAYER.far);
  for (let step = 0; step < 9; step += 1) {
    block(THREE, scene, [2.2, 0.13, 0.4], "#2a3852", [9.4, 2.9 - step * 0.35, 0.4 + step * 0.4], LAYER.far);
  }
  // Coin telescope up on the deck, set level with the tripod rather than in
  // front of it, so it never enters the frame however far the head is yawed.
  cylinder(THREE, scene, 0.08, 0.12, 1.15, "#94a3b8", [-6.2, 3.78, -0.6], LAYER.far);
  sphere(THREE, scene, 0.14, "#64748b", [-6.2, 4.4, -0.6], LAYER.far);
  cylinder(THREE, scene, 0.07, 0.07, 0.5, "#475569", [-6.2, 4.47, -0.7], LAYER.far, { rotation: [-0.3, 0, 0] });

  // Observation binocular telescope on swivel pedestal
  cylinder(THREE, scene, 0.08, 0.12, 1.2, "#94a3b8", [-2.8, 0.6, -7.4], LAYER.far);
  sphere(THREE, scene, 0.14, "#64748b", [-2.8, 1.25, -7.4], LAYER.far);
  cylinder(THREE, scene, 0.07, 0.07, 0.5, "#475569", [-2.8, 1.32, -7.5], LAYER.far, { rotation: [-0.3, 0, 0] });

  // Two lookout lanterns, placed inside the frame so their pools of warm light
  // actually fall on the terrace the photographer is standing on.
  for (const lanternX of [-8.6, 8.6]) {
    cylinder(THREE, scene, 0.05, 0.05, 3.2, "#1e293b", [lanternX, 1.6, -7.6], LAYER.far);
    sphere(THREE, scene, 0.22, "#fef08a", [lanternX, 3.1, -7.6], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 2.2 });
    const lanternLight = new THREE.PointLight(new THREE.Color("#fbbf24"), 9, 16, 2);
    lanternLight.position.set(lanternX, 3.1, -7.6); lanternLight.layers.enableAll(); scene.add(lanternLight);
  }

  // Terrace paving, seating and an interpretation board.
  for (let paver = 0; paver < 32; paver += 1) {
    const px = -9.5 + (paver % 8) * 2.7, pz = -0.9 - Math.floor(paver / 8) * 2.1;
    slab(THREE, scene, 2.5, 1.9, (paver % 2) ? "#243349" : "#1d2a3e", [px, 0.06, pz], LAYER.far);
  }
  bench(THREE, scene, [-8.4, -2.6], LAYER.far, { seat: "#2b3852", leg: "#1b2334" });
  bench(THREE, scene, [8.4, -2.6], LAYER.far, { seat: "#2b3852", leg: "#1b2334" });
  block(THREE, scene, [1.9, 0.9, 0.09], "#2b3852", [1.4, 1.15, -7.1], LAYER.far, { rotation: [-0.5, 0, 0] });
  for (const boardLeg of [-0.8, 0.8]) cylinder(THREE, scene, 0.05, 0.05, 0.9, "#3d4a61", [1.4 + boardLeg, 0.45, -7.3], LAYER.far, {}, 6);
  // A visitor leaning on the balustrade, taking the same picture.
  const visitor = build3DHuman(THREE, { pose: "stand", top: "#1e293b", bottom: "#0f172a", hair: "#111827", hat: "#334155", layer: LAYER.far, prop: "camera" });
  put(scene, visitor, LAYER.far, [-6.4, 0.08, -6.9], [0, 0.1, 0]);

  // Pines clinging to the cliff face, each one planted at the height the
  // hillside actually has at that depth.
  const slope = rand(67);
  for (let index = 0; index < 30; index += 1) {
    const side = index % 2 ? 1 : -1;
    const tz = CLIFF_TOP - 2 - slope() * 88;
    tree(THREE, scene, [side * (14 + slope() * 90), cliffY(tz), tz], LAYER.far, 1.8 + slope() * 2.0, "#081422", "#040810");
  }

  // Distant Metropolis (Z = -500 to -2400): 60+ skyscraper towers with lit window facades
  const city = rand(91);
  const neonColors = ["#38bdf8", "#818cf8", "#f43f5e", "#fbbf24", "#34d399", "#c084fc", "#ffffff"];
  for (let i = 0; i < 56; i += 1) {
    const cx = -650 + (i % 14) * 100 + (city() - 0.5) * 40;
    const cz = -600 - Math.floor(i / 14) * 350 - city() * 180;
    const cw = 25 + city() * 35, cd = 25 + city() * 35, ch = 70 + city() * 160;
    facadeBlock(THREE, scene, [cw, ch, cd], [cx, ch / 2 - 40, cz], LAYER.far, facadeTexture(THREE, { base: "#0a0f1d", frame: "#151d30", glass: "#fde047", lit: 0.68, columns: 5, rows: 9, seed: i * 7 + 3 }), "#cbd5e1", "#a16207", [2, Math.max(3, Math.round(ch / 26))]);
    const nc = neonColors[i % neonColors.length];
    block(THREE, scene, [cw * 0.7, 8, cd * 0.7], nc, [cx, ch - 36, cz], LAYER.far, { emissive: new THREE.Color(nc), emissiveIntensity: 2.5 });
    cylinder(THREE, scene, 0.4, 1.2, 28, "#ef4444", [cx, ch - 20, cz], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 3.0 });
  }

  // City street grid on the valley floor, lit by its own sodium lamps.
  for (let avenue = 0; avenue < 15; avenue += 1) {
    const ax = -700 + avenue * 100;
    slab(THREE, scene, 9, 2000, "#151d2e", [ax, -39.9, -1500], LAYER.far);
    slab(THREE, scene, 13, 2000, "#fbbf24", [ax, -39.8, -1500], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 2.4 });
  }
  for (let cross = 0; cross < 8; cross += 1) {
    const cz = -620 - cross * 320;
    slab(THREE, scene, 1500, 9, "#151d2e", [0, -39.9, cz], LAYER.far);
    slab(THREE, scene, 1500, 13, "#fde68a", [0, -39.8, cz], LAYER.far, { emissive: new THREE.Color("#fde68a"), emissiveIntensity: 2.2 });
  }

  // Arterial Highway Ribbons with glowing headlight/taillight trails
  for (let h = 0; h < 3; h += 1) {
    // The nearest deck sits in front of the low-rise carpet, otherwise its
    // traffic is hidden behind the first row of buildings.
    const hz = -500 - h * 420;
    slab(THREE, scene, 1800, 16, "#1e293b", [0, -38, hz], LAYER.far);
    slab(THREE, scene, 1800, 5, "#ffffff", [0, -37.8, hz + 3], LAYER.far, { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 2.6 });
    slab(THREE, scene, 1800, 5, "#ef4444", [0, -37.8, hz - 3], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 2.6 });
    // Elevated deck on piers, and slip roads dropping into the grid.
    for (let pier = 0; pier < 24; pier += 1) block(THREE, scene, [3, 2, 3], "#131b2b", [-880 + pier * 76, -39, hz], LAYER.far);
    for (const rampX of [-320, 320]) {
      slab(THREE, scene, 12, 120, "#1a2334", [rampX, -39.6, hz - 62], LAYER.far, { spin: 0.24 });
    }
  }

  // River winding across the valley, holding the reflection of the skyline.
  slab(THREE, scene, 2400, 90, "#08111f", [0, -39.7, -1080], LAYER.far);
  slab(THREE, scene, 2400, 26, "#1d4ed8", [0, -39.6, -1080], LAYER.far, { emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.8 });
  slab(THREE, scene, 2400, 8, "#fbbf24", [0, -39.5, -1066], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 1.1 });
  // Suspension bridge across the river.
  slab(THREE, scene, 26, 130, "#1e293b", [-120, -33.5, -1080], LAYER.far);
  slab(THREE, scene, 3, 130, "#fef08a", [-120, -33.3, -1080], LAYER.far, { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 1.8 });
  for (const towerZ of [-1122, -1038]) {
    block(THREE, scene, [5, 60, 5], "#233047", [-133, -8, towerZ], LAYER.far);
    block(THREE, scene, [5, 60, 5], "#233047", [-107, -8, towerZ], LAYER.far);
    block(THREE, scene, [32, 4, 5], "#233047", [-120, 18, towerZ], LAYER.far);
    block(THREE, scene, [2, 2, 2], "#ef4444", [-120, 21, towerZ], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 3 });
  }
  for (let stay = 0; stay < 12; stay += 1) {
    const stayZ = -1122 + stay * 7.6;
    block(THREE, scene, [0.8, 46 - stay * 2.6, 0.8], "#2c3b55", [-133, -12 + stay * 1.3, stayZ], LAYER.far, { rotation: [0.22, 0, 0] });
  }

  // Red-blinking radio mast on the ridge above the city.
  for (let leg = 0; leg < 3; leg += 1) {
    const legAngle = leg * Math.PI * 2 / 3;
    cylinder(THREE, scene, 1.0, 1.6, 150, "#1b2436", [340 + Math.cos(legAngle) * 6, 35, -640 + Math.sin(legAngle) * 6], LAYER.far, { rotation: [Math.sin(legAngle) * 0.04, 0, -Math.cos(legAngle) * 0.04] }, 5);
  }
  for (let beaconIndex = 0; beaconIndex < 6; beaconIndex += 1) {
    sphere(THREE, scene, 2.6, "#ef4444", [340, -30 + beaconIndex * 27, -640], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 3.2 }, 8, 6);
  }
  cylinder(THREE, scene, 0.4, 1.0, 40, "#1b2436", [340, 130, -640], LAYER.far, {}, 5);

  // Low-rise carpet between the towers: without it the valley floor reads as
  // a black void under a band of skyscrapers.
  for (let lot = 0; lot < 110; lot += 1) {
    const lx = -700 + (lot % 11) * 140 + (city() - 0.5) * 80;
    const lz = -560 - Math.floor(lot / 11) * 250 - city() * 160;
    const lw = 26 + city() * 40, lh = 8 + city() * 16, ld = 26 + city() * 40;
    block(THREE, scene, [lw, lh, ld], "#111a2e", [lx, lh / 2 - 40, lz], LAYER.far, { emissive: new THREE.Color("#8a5a1e"), emissiveIntensity: 0.85 });
    block(THREE, scene, [lw * 0.9, 3.2, ld * 0.9], "#fbbf24", [lx, lh - 40, lz], LAYER.far, { emissive: new THREE.Color("#fcd34d"), emissiveIntensity: 2.4 });
  }

  // Distant City Center Glow Emitter
  const cityCenterGlow = new THREE.Mesh(new THREE.SphereGeometry(60, 18, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fef08a"), transparent: true, opacity: 0.4 }));
  cityCenterGlow.userData.isCelestial = true;
  cityCenterGlow.raycast = () => {};
  put(scene, cityCenterGlow, LAYER.far, [0, 40, -1200]);
  scene.userData.meteringEmitter = cityCenterGlow;

  // Static wildlife
  const lookoutHawk = build3DPerchedBird(THREE, "#475569", "#f59e0b");
  put(scene, lookoutHawk, LAYER.far, [-9.0, 1.18, -8.2], [0, 0.5, 0]);
  const mountainFox = build3DFox(THREE, "#ea580c");
  put(scene, mountainFox, LAYER.far, [6.6, 0.08, -5.6], [0, -0.6, 0]);
  contactShadow(THREE, scene, 0.35).position.set(6.6, 0.09, -5.6);

  const skylineBat = build3DBat(THREE, "#312e81");
  put(scene, skylineBat, LAYER.far, [-5.2, 3.6, -13.5], [0.12, 0.5, -0.08]);

  return {};
}

/** The photographable subjects of `city_night`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const car1 = build3DCar(THREE, "#fef08a"); scene.add(car1);
  const car2 = build3DCar(THREE, "#ef4444"); scene.add(car2);
  const drone = build3DBird(THREE, "#38bdf8"); scene.add(drone);

  subjects.push(car1, car2, drone);
  shadows.push(contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.3));
}
