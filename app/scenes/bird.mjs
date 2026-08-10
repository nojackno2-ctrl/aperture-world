import { LAYER } from "../world.mjs";
import { BIRD_COUNT, block, build3DBird, build3DFloatingDuck, build3DFrog, build3DHuman, build3DPerchedBird, build3DStandingHeron, build3DSwan, build3DTurtle, contactShadow, cylinder, fence, peak, put, rand, slab, sphere, surface, tree } from "../scene-kit.mjs";

/** Static world for the `bird` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  slab(THREE, scene, 1600, 1600, "#6fa2b8", [0, 0, -240], LAYER.far, { emissive: new THREE.Color("#2b5568"), emissiveIntensity: 0.34 });
  const marsh = rand(53);
  for (let index = 0; index < 12; index += 1) peak(THREE, scene, 90 + marsh() * 70, 46 + marsh() * 60, "#87a8b6", [-520 + index * 96, 0, -430 - marsh() * 190], LAYER.far, 5);
  for (let index = 0; index < 30; index += 1) block(THREE, scene, [2.4 + marsh() * 5, 0.35, 2 + marsh() * 4], "#6b9059", [-70 + marsh() * 140, 0.16, -46 - marsh() * 110], LAYER.far);
  for (let index = 0; index < 54; index += 1) {
    const side = index % 2 ? 1 : -1, x = side * (11 + marsh() * 26), z = -14 - marsh() * 58;
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.6 + marsh() * 1.5, 4), surface(THREE, marsh() > 0.5 ? "#8fae57" : "#a2b964")), LAYER.far, [x, 0.9, z], [0, 0, (marsh() - 0.5) * 0.4]);
  }
  for (let index = 0; index < 40; index += 1) {
    const side = index % 2 ? 1 : -1, x = side * (2.2 + marsh() * 8), z = -2.6 - marsh() * 4.4;
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, 1.9 + marsh() * 1.3, 4), surface(THREE, "#93b45c")), LAYER.near, [x, 1, z], [0, 0, (marsh() - 0.5) * 0.5]);
  }
  for (let index = 0; index < 10; index += 1) tree(THREE, scene, [(index % 2 ? 1 : -1) * (26 + marsh() * 58), 0, -54 - marsh() * 44], LAYER.far, 2 + marsh() * 1.6, "#57874f");

  // Cattail heads on a share of the reeds, so the marsh reads as a marsh.
  for (let index = 0; index < 26; index += 1) {
    const side = index % 2 ? 1 : -1, x = side * (9 + marsh() * 24), z = -12 - marsh() * 52;
    cylinder(THREE, scene, 0.02, 0.03, 2.1, "#8fae57", [x, 1.05, z], LAYER.far, {}, 4);
    cylinder(THREE, scene, 0.09, 0.09, 0.42, "#7a4a24", [x, 2.3, z], LAYER.far, {}, 6);
  }
  // Reed islands: raised mud shelves crowned with dense stems.
  for (let island = 0; island < 6; island += 1) {
    const ix = -46 + island * 18 + marsh() * 8, iz = -34 - marsh() * 46;
    cylinder(THREE, scene, 3.4 + marsh() * 1.6, 4.4 + marsh() * 1.6, 0.5, "#6b7f4c", [ix, 0.22, iz], LAYER.far, {}, 9);
    for (let stem = 0; stem < 14; stem += 1) {
      cylinder(THREE, scene, 0.03, 0.06, 1.6 + marsh() * 1.2, "#94b45c", [ix + (marsh() - 0.5) * 6, 1.2, iz + (marsh() - 0.5) * 6], LAYER.far, {}, 4);
    }
  }
  // Lily pads scattered over the open water.
  for (let pad = 0; pad < 46; pad += 1) {
    const px = -34 + marsh() * 68, pz = -8 - marsh() * 48;
    slab(THREE, scene, 0.7 + marsh() * 0.7, 0.7 + marsh() * 0.7, pad % 5 ? "#3f7a3d" : "#4d8f45", [px, 0.05, pz], pz > -12 ? LAYER.near : LAYER.far, { spin: marsh() * 3 });
    if (pad % 7 === 0) sphere(THREE, scene, 0.13, "#f9a8d4", [px, 0.2, pz], LAYER.far, {}, 6, 5);
  }

  // Observation boardwalk running out from the hide, straight past the tripod.
  block(THREE, scene, [2.6, 0.16, 40], "#8a6a45", [-2.4, 0.62, -28], LAYER.far);
  for (let pile = 0; pile < 11; pile += 1) {
    const pz = -8.5 - pile * 3.8;
    cylinder(THREE, scene, 0.14, 0.14, 1.4, "#4a3522", [-3.5, 0.0, pz], LAYER.far, {}, 6);
    cylinder(THREE, scene, 0.14, 0.14, 1.4, "#4a3522", [-1.3, 0.0, pz], LAYER.far, {}, 6);
    for (const railX of [-3.55, -1.25]) {
      block(THREE, scene, [0.11, 0.9, 0.11], "#6b4f35", [railX, 1.15, pz], LAYER.far);
    }
  }
  for (const railX of [-3.55, -1.25]) {
    block(THREE, scene, [0.09, 0.1, 39], "#6b4f35", [railX, 1.56, -28], LAYER.far);
    block(THREE, scene, [0.09, 0.1, 39], "#6b4f35", [railX, 1.12, -28], LAYER.far);
  }
  const birder = build3DHuman(THREE, { pose: "stand", top: "#0f766e", bottom: "#3f3f46", hair: "#1c1917", hat: "#a16207", layer: LAYER.far, prop: "camera" });
  put(scene, birder, LAYER.far, [-2.4, 0.72, -20], [0, 0.5, 0]);

  // The tripod stands on the deck of a birding tower at the end of the
  // boardwalk. Its rails run down the flanks and across the back only; the
  // marsh side is open, so nothing the tower is built from meets the lens.
  for (const [lx, lz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    cylinder(THREE, scene, 0.17, 0.23, 4.3, "#57422f", [lx, 2.15, lz], LAYER.far, {}, 7);
  }
  for (const braceY of [1.4, 3.0]) {
    block(THREE, scene, [5.4, 0.13, 0.13], "#57422f", [0, braceY, -2.6], LAYER.far);
    block(THREE, scene, [5.4, 0.13, 0.13], "#57422f", [0, braceY, 2.6], LAYER.far);
    block(THREE, scene, [0.13, 0.13, 5.4], "#57422f", [-2.6, braceY, 0], LAYER.far);
    block(THREE, scene, [0.13, 0.13, 5.4], "#57422f", [2.6, braceY, 0], LAYER.far);
  }
  block(THREE, scene, [6.2, 0.22, 6.2], "#8a6a45", [0, 4.29, 0], LAYER.far);
  block(THREE, scene, [6.2, 0.34, 0.32], "#7a5c3c", [0, 4.23, -3.0], LAYER.far);
  for (const railX of [-3.0, 3.0]) {
    for (let post = 0; post < 3; post += 1) block(THREE, scene, [0.12, 1.0, 0.12], "#6b4f35", [railX, 4.9, 0.5 + post * 1.2], LAYER.far);
    block(THREE, scene, [0.1, 0.1, 3.0], "#6b4f35", [railX, 5.34, 1.7], LAYER.far);
    block(THREE, scene, [0.1, 0.1, 3.0], "#6b4f35", [railX, 4.86, 1.7], LAYER.far);
  }
  for (let post = 0; post < 4; post += 1) block(THREE, scene, [0.12, 1.0, 0.12], "#6b4f35", [-2.7 + post * 1.8, 4.9, 3.0], LAYER.far);
  block(THREE, scene, [6.2, 0.1, 0.1], "#6b4f35", [0, 5.34, 3.0], LAYER.far);
  for (let step = 0; step < 12; step += 1) {
    block(THREE, scene, [1.5, 0.12, 0.4], "#6b4f35", [0, 4.05 - step * 0.35, 3.5 + step * 0.34], LAYER.far);
  }
  // Short link from the tower down to the boardwalk it stands at the end of.
  block(THREE, scene, [2.2, 0.16, 3.2], "#8a6a45", [-2.4, 0.62, -5.4], LAYER.far);

  // Moored wooden rowboat.
  block(THREE, scene, [1.5, 0.42, 4.2], "#a3703f", [3.4, 0.24, -12.6], LAYER.far, { rotation: [0, 0.22, 0] });
  block(THREE, scene, [1.16, 0.2, 3.8], "#6d4826", [3.4, 0.44, -12.6], LAYER.far, { rotation: [0, 0.22, 0] });
  block(THREE, scene, [1.2, 0.09, 0.3], "#7c5734", [3.4, 0.5, -11.6], LAYER.far, { rotation: [0, 0.22, 0] });
  block(THREE, scene, [1.2, 0.09, 0.3], "#7c5734", [3.32, 0.5, -13.6], LAYER.far, { rotation: [0, 0.22, 0] });
  cylinder(THREE, scene, 0.05, 0.05, 2.4, "#9a7a4c", [4.1, 0.62, -12.4], LAYER.far, { rotation: [0.1, 0.5, 1.35] }, 5);

  // Observatory Tower
  for (const [px, pz] of [[12, -26], [16, -26], [12, -30], [16, -30]]) {
    cylinder(THREE, scene, 0.18, 0.18, 6.5, "#574233", [px, 3.25, pz], LAYER.far);
  }
  block(THREE, scene, [4.8, 0.3, 4.8], "#6e5543", [14, 6.2, -28], LAYER.far);
  fence(THREE, scene, [11.8, -30.2], [16.2, -30.2], 7.2, "#574233", LAYER.far);
  peak(THREE, scene, 3.4, 2.0, "#3d2c20", [14, 8.2, -28], LAYER.far, 4);
  for (let step = 0; step < 9; step += 1) block(THREE, scene, [1.6, 0.12, 0.5], "#6b4f35", [14, 0.5 + step * 0.62, -23.6 + step * 0.32], LAYER.far);

  // Osprey nesting platform out on the flats.
  cylinder(THREE, scene, 0.22, 0.3, 9.0, "#5b452e", [-15, 4.5, -40], LAYER.far, {}, 6);
  block(THREE, scene, [2.0, 0.16, 2.0], "#6e5543", [-15, 9.1, -40], LAYER.far);
  for (let twig = 0; twig < 16; twig += 1) {
    cylinder(THREE, scene, 0.05, 0.05, 1.5, "#7a5c39", [-15 + (marsh() - 0.5) * 1.4, 9.3 + marsh() * 0.3, -40 + (marsh() - 0.5) * 1.4], LAYER.far, { rotation: [Math.PI / 2, marsh() * 3, marsh() * 0.4] }, 4);
  }

  // Harbour lighthouse marking the far shore.
  cylinder(THREE, scene, 4.2, 6.5, 34, "#f1f5f9", [-96, 17, -206], LAYER.far, {}, 12);
  cylinder(THREE, scene, 6.6, 6.6, 3.0, "#dc2626", [-96, 22, -206], LAYER.far, {}, 12);
  cylinder(THREE, scene, 5.0, 5.0, 5.0, "#fde68a", [-96, 36.5, -206], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 1.6 }, 10);
  peak(THREE, scene, 5.4, 4.2, "#334155", [-96, 41, -206], LAYER.far, 8);
  block(THREE, scene, [16, 8, 12], "#e2e8f0", [-84, 4, -204], LAYER.far);
  peak(THREE, scene, 11, 5, "#475569", [-84, 10.5, -204], LAYER.far, 4);

  // Static wetland animals
  const egret = build3DStandingHeron(THREE, "#f8fafc", "#f59e0b");
  put(scene, egret, LAYER.far, [-8.5, 0, -16], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.3).position.set(-8.5, 0.02, -16);

  const heron = build3DStandingHeron(THREE, "#94a3b8", "#eab308");
  put(scene, heron, LAYER.far, [7.5, 0, -20], [0, -0.6, 0]);
  contactShadow(THREE, scene, 0.3).position.set(7.5, 0.02, -20);

  const duck1 = build3DFloatingDuck(THREE, "#15803d", "#78350f");
  put(scene, duck1, LAYER.far, [-3.8, 0.03, -14], [0, 0.2, 0]);
  const duck2 = build3DFloatingDuck(THREE, "#059669", "#854d0e");
  put(scene, duck2, LAYER.far, [11.5, 0.03, -18], [0, -0.4, 0]);

  const kingfisher = build3DPerchedBird(THREE, "#0284c7", "#ea580c");
  put(scene, kingfisher, LAYER.far, [-6, 1.4, -18], [0, 0.5, 0]);
  const buoyBird = build3DPerchedBird(THREE, "#64748b");
  put(scene, buoyBird, LAYER.far, [-2, 1.1, -16], [0, -0.3, 0]);
  const towerBird = build3DPerchedBird(THREE, "#334155");
  put(scene, towerBird, LAYER.far, [12.2, 6.4, -26], [0, 0.8, 0]);

  const turtle = build3DTurtle(THREE, "#365314");
  put(scene, turtle, LAYER.far, [8, 0.82, -22], [0.3, 0.2, 0]);

  const reedFrog = build3DFrog(THREE, "#65a30d");
  put(scene, reedFrog, LAYER.far, [4.8, 0.08, -10.8], [0, -0.4, 0]);

  const marshSwan = build3DSwan(THREE, "#f8fafc");
  put(scene, marshSwan, LAYER.far, [-14, 0.04, -24], [0, 0.65, 0]);

  return {};
}

/** The photographable subjects of `bird`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const colors = ["#475569", "#1e293b", "#0f172a", "#334155", "#475569", "#1e293b", "#3b82f6"];
  for (let index = 0; index < BIRD_COUNT; index += 1) {
    const bird = build3DBird(THREE, colors[index % colors.length]);
    scene.add(bird);
    subjects.push(bird);
    shadows.push(contactShadow(THREE, scene, 0.3));
  }
}
