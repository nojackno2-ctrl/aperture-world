import { LAYER } from "../world.mjs";
import { block, build3DCat, build3DHamster, build3DHuman, build3DLyingDog, build3DPerchedBird, build3DSleepingCat, contactShadow, cylinder, put, rand, slab, sphere, surface } from "../scene-kit.mjs";

/** Static world for the `portrait` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  const room = rand(29);
  // Living-room studio: parquet floor, plastered walls, a ceiling to bounce into.
  slab(THREE, scene, 8, 12, "#946a44", [0, 0, -3.4], LAYER.far);
  for (let plank = 0; plank < 16; plank += 1) slab(THREE, scene, 0.03, 12, "#7d5735", [-3.75 + plank * 0.5, 0.008, -3.4], LAYER.far);
  slab(THREE, scene, 8, 12, "#e6dfd0", [0, 2.9, -3.4], LAYER.far);
  block(THREE, scene, [8, 2.9, 0.16], "#e3d8c2", [0, 1.45, -9.3], LAYER.far);
  block(THREE, scene, [0.16, 2.9, 12], "#ded2bc", [3.95, 1.45, -3.4], LAYER.far);
  block(THREE, scene, [8, 0.1, 0.1], "#f5efe2", [0, 0.05, -9.2], LAYER.far);
  block(THREE, scene, [8, 0.09, 0.09], "#f5efe2", [0, 2.84, -9.2], LAYER.far);

  // Left wall with the sash window that is the key light for this sitting.
  block(THREE, scene, [0.16, 2.9, 3.2], "#ded2bc", [-3.95, 1.45, -1.2], LAYER.far);
  block(THREE, scene, [0.16, 2.9, 4.0], "#ded2bc", [-3.95, 1.45, -7.4], LAYER.far);
  block(THREE, scene, [0.16, 0.75, 2.4], "#ded2bc", [-3.95, 0.37, -4.2], LAYER.far);
  block(THREE, scene, [0.16, 0.55, 2.4], "#ded2bc", [-3.95, 2.62, -4.2], LAYER.far);
  block(THREE, scene, [0.1, 1.6, 2.4], "#fff6e2", [-3.9, 1.55, -4.2], LAYER.far, { emissive: new THREE.Color("#fff3d6"), emissiveIntensity: 2.1 });
  for (const mullionZ of [-3.6, -4.2, -4.8]) block(THREE, scene, [0.14, 1.62, 0.07], "#f8f4e8", [-3.86, 1.55, mullionZ], LAYER.far);
  block(THREE, scene, [0.14, 0.07, 2.5], "#f8f4e8", [-3.86, 1.55, -4.2], LAYER.far);
  block(THREE, scene, [0.34, 0.09, 2.6], "#f8f4e8", [-3.7, 0.74, -4.2], LAYER.far);
  // Curtains bunched at each side of the opening.
  for (const [curtainZ, curtainDepth] of [[-3.0, 0.6], [-5.4, 0.6]]) {
    block(THREE, scene, [0.22, 2.3, curtainDepth], "#c9b8a0", [-3.72, 1.5, curtainZ], LAYER.far);
    block(THREE, scene, [0.16, 2.3, curtainDepth * 0.5], "#d8c9b2", [-3.58, 1.5, curtainZ], LAYER.far);
  }
  cylinder(THREE, scene, 0.035, 0.035, 3.4, "#8a6a45", [-3.7, 2.72, -4.2], LAYER.far, { rotation: [Math.PI / 2, 0, 0] }, 6);

  // Sitter's chair, rug and side table at the portrait anchor.
  slab(THREE, scene, 3.6, 3.0, "#b9836a", [0.1, 0.02, -4.3], LAYER.far);
  slab(THREE, scene, 3.1, 2.5, "#a9714f", [0.1, 0.03, -4.3], LAYER.far);
  // Seat top at 0.44 m, which is where the sitter's hips land in the sit stance.
  block(THREE, scene, [0.66, 0.1, 0.62], "#8b5a34", [0, 0.35, -4.2], LAYER.far);
  block(THREE, scene, [0.6, 0.08, 0.56], "#c084fc", [0, 0.41, -4.2], LAYER.far);
  block(THREE, scene, [0.62, 0.66, 0.09], "#7c3aed", [0, 0.75, -4.52], LAYER.far, { rotation: [-0.12, 0, 0] });
  for (const [lx, lz] of [[-0.27, -3.95], [0.27, -3.95], [-0.27, -4.45], [0.27, -4.45]]) {
    cylinder(THREE, scene, 0.035, 0.03, 0.34, "#5b422f", [lx, 0.17, lz], LAYER.far, {}, 6);
  }
  cylinder(THREE, scene, 0.34, 0.34, 0.05, "#6b4f35", [1.35, 0.56, -4.6], LAYER.far, {}, 12);
  cylinder(THREE, scene, 0.05, 0.06, 0.55, "#5b422f", [1.35, 0.28, -4.6], LAYER.far, {}, 8);
  cylinder(THREE, scene, 0.06, 0.05, 0.09, "#f8fafc", [1.35, 0.63, -4.6], LAYER.far, {}, 10);
  sphere(THREE, scene, 0.08, "#f472b6", [1.2, 0.68, -4.55], LAYER.far, {}, 7, 6);

  // Bookshelf against the back wall.
  block(THREE, scene, [2.4, 2.1, 0.34], "#6b4f35", [1.9, 1.05, -9.0], LAYER.far);
  for (let shelf = 0; shelf < 4; shelf += 1) {
    block(THREE, scene, [2.24, 0.05, 0.3], "#8a6a45", [1.9, 0.42 + shelf * 0.52, -8.98], LAYER.far);
    for (let book = 0; book < 13; book += 1) {
      const bookColor = ["#dc2626", "#1d4ed8", "#16a34a", "#f59e0b", "#7c3aed", "#0e7490"][(book + shelf) % 6];
      block(THREE, scene, [0.07 + room() * 0.05, 0.28 + room() * 0.13, 0.22], bookColor, [0.9 + book * 0.16, 0.62 + shelf * 0.52, -8.96], LAYER.far);
    }
  }
  // Framed prints hung above the sofa line.
  for (const [fx, fy, fw, fh, mat] of [[-1.5, 1.9, 0.6, 0.8, "#f8fafc"], [-0.7, 2.0, 0.5, 0.4, "#fde68a"], [-0.75, 1.5, 0.45, 0.55, "#bfdbfe"]]) {
    block(THREE, scene, [fw, fh, 0.05], "#4a3522", [fx, fy, -9.18], LAYER.far);
    block(THREE, scene, [fw - 0.09, fh - 0.09, 0.02], mat, [fx, fy, -9.14], LAYER.far);
  }

  // Softbox on a stand, and a reflector disc opposite it.
  cylinder(THREE, scene, 0.05, 0.05, 1.75, "#1f2937", [-2.35, 0.88, -3.1], LAYER.far, {}, 8);
  for (const legAngle of [0, 2.1, 4.2]) {
    cylinder(THREE, scene, 0.02, 0.02, 0.7, "#1f2937", [-2.35 + Math.cos(legAngle) * 0.2, 0.2, -3.1 + Math.sin(legAngle) * 0.2], LAYER.far, { rotation: [Math.sin(legAngle) * 0.5, 0, -Math.cos(legAngle) * 0.5] }, 5);
  }
  block(THREE, scene, [0.16, 0.95, 0.95], "#0f172a", [-2.28, 1.78, -3.4], LAYER.far, { rotation: [0, 0, 0.2] });
  block(THREE, scene, [0.05, 0.85, 0.85], "#fefce8", [-2.16, 1.8, -3.4], LAYER.far, { emissive: new THREE.Color("#fff5da"), emissiveIntensity: 1.5, rotation: [0, 0, 0.2] });
  cylinder(THREE, scene, 0.62, 0.62, 0.04, "#f5f5f4", [2.15, 1.05, -3.9], LAYER.far, { rotation: [0, 0, Math.PI / 2 - 0.25] }, 18);
  cylinder(THREE, scene, 0.04, 0.04, 1.05, "#1f2937", [2.35, 0.52, -3.9], LAYER.far, {}, 8);

  // Floor lamp and a big potted fig, the usual furniture of a lit room.
  cylinder(THREE, scene, 0.22, 0.24, 0.04, "#334155", [3.2, 0.03, -7.2], LAYER.far, {}, 12);
  cylinder(THREE, scene, 0.03, 0.03, 1.55, "#334155", [3.2, 0.8, -7.2], LAYER.far, {}, 6);
  cylinder(THREE, scene, 0.2, 0.3, 0.35, "#f5e6c8", [3.2, 1.72, -7.2], LAYER.far, { emissive: new THREE.Color("#ffe0a3"), emissiveIntensity: 1.2 }, 10);
  cylinder(THREE, scene, 0.26, 0.21, 0.42, "#b45309", [-2.9, 0.21, -7.9], LAYER.far, {}, 10);
  cylinder(THREE, scene, 0.03, 0.04, 1.05, "#4d7c3a", [-2.9, 0.9, -7.9], LAYER.far, {}, 6);
  for (let leaf = 0; leaf < 11; leaf += 1) {
    const leafAngle = leaf * 1.4;
    const blade = put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 5), surface(THREE, leaf % 2 ? "#3f7535" : "#4d8f42")), LAYER.far, [-2.9 + Math.cos(leafAngle) * 0.3, 1.05 + leaf * 0.07, -7.9 + Math.sin(leafAngle) * 0.3], [0, leafAngle, 0.4]);
    blade.scale.set(1.5, 0.28, 1);
  }

  // Foreground: a chest of drawers just inside the near limit, for depth.
  block(THREE, scene, [1.3, 0.85, 0.5], "#6b4f35", [2.5, 0.42, -1.5], LAYER.near);
  for (let drawer = 0; drawer < 3; drawer += 1) block(THREE, scene, [1.16, 0.2, 0.04], "#8a6a45", [2.5, 0.18 + drawer * 0.27, -1.24], LAYER.near);
  cylinder(THREE, scene, 0.14, 0.11, 0.2, "#0e7490", [2.15, 0.95, -1.5], LAYER.near, {}, 10);
  sphere(THREE, scene, 0.16, "#4d8f42", [2.15, 1.15, -1.5], LAYER.near, {}, 8, 6);

  // Static animals
  const sleepingCat = build3DSleepingCat(THREE, "#ea580c");
  put(scene, sleepingCat, LAYER.far, [1.35, 0.59, -4.6], [0, 0.3, 0]);

  const rugDog = build3DLyingDog(THREE, "#f59e0b");
  put(scene, rugDog, LAYER.far, [0.95, 0.03, -3.5], [0, -0.4, 0]);
  contactShadow(THREE, scene, 0.35).position.set(0.95, 0.04, -3.5);

  const shelfBird = build3DPerchedBird(THREE, "#38bdf8", "#f59e0b");
  put(scene, shelfBird, LAYER.far, [2.6, 2.13, -8.98], [0, -0.4, 0]);

  const dresserHamster = build3DHamster(THREE, "#d97706", LAYER.near);
  put(scene, dresserHamster, LAYER.near, [2.68, 0.88, -1.42], [0, -0.55, 0]);

  return {};
}

/** The photographable subjects of `portrait`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const sitter = build3DHuman(THREE, { pose: "sit", skin: "#f0c9a4", hair: "#3f2a1b", top: "#be123c", bottom: "#1f2937", height: 1.52 });
  scene.add(sitter);
  subjects.push(sitter);
  shadows.push(contactShadow(THREE, scene, 0.42));

  const cat = build3DCat(THREE, "#ea580c"); scene.add(cat);
  subjects.push(cat);
  shadows.push(contactShadow(THREE, scene, 0.3));
}
