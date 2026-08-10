import { LAYER } from "../world.mjs";
import { bench, block, build3DFrog, build3DHuman, build3DPerchedBird, build3DSittingCat, build3DSittingDog, build3DSwan, contactShadow, cylinder, flowerPatch, hedge, peak, put, rand, slab, sphere, tree } from "../scene-kit.mjs";

/** Static world for the `group` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  const park = rand(61);
  slab(THREE, scene, 400, 400, "#5f8f4c", [0, 0, -40], LAYER.far);
  // Paved plaza with a laid stone pattern the group is posing on.
  slab(THREE, scene, 30, 26, "#b7b09c", [0, 0.02, -10], LAYER.far);
  for (let row = 0; row < 13; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      if ((row + column) % 2) continue;
      slab(THREE, scene, 1.86, 1.86, "#cec6ae", [-14 + column * 2, 0.03, -22 + row * 2], LAYER.far);
    }
  }
  slab(THREE, scene, 30, 0.5, "#8d8878", [0, 0.035, -23], LAYER.far);
  slab(THREE, scene, 0.5, 26, "#8d8878", [-15, 0.035, -10], LAYER.far);
  slab(THREE, scene, 0.5, 26, "#8d8878", [15, 0.035, -10], LAYER.far);

  // Low presentation step: the back row of the group photo stands on it.
  block(THREE, scene, [8.4, 0.2, 1.5], "#d6cfba", [0, 0.1, -6.8], LAYER.far);
  block(THREE, scene, [8.8, 0.06, 1.7], "#c3bba4", [0, 0.2, -6.8], LAYER.far);

  for (let index = 0; index < 16; index += 1) tree(THREE, scene, [(index % 2 ? 1 : -1) * (12 + park() * 22), 0, -16 - park() * 26], LAYER.far, 1.5 + park() * 1.5, "#4f7d41");
  for (let index = 0; index < 8; index += 1) {
    const side = index % 2 ? 1 : -1;
    const bx = side * (17 + park() * 14), bz = -12 - park() * 22;
    cylinder(THREE, scene, 0.2, 0.28, 3.0, "#5b422f", [bx, 1.5, bz], LAYER.far, {}, 6);
    sphere(THREE, scene, 1.9 + park() * 0.9, index % 3 ? "#4a7c3f" : "#5c8f46", [bx, 4.2 + park() * 0.6, bz], LAYER.far, {}, 9, 7);
  }

  // Clipped hedges framing the plaza, with flower beds in front of them.
  hedge(THREE, scene, [-15.5, -23.5], [15.5, -23.5], LAYER.far, { height: 1.0, width: 1.0 });
  hedge(THREE, scene, [-15.5, -23.5], [-15.5, -12], LAYER.far, { height: 1.0, width: 1.0 });
  hedge(THREE, scene, [15.5, -23.5], [15.5, -12], LAYER.far, { height: 1.0, width: 1.0 });
  for (const [bedX, bedZ] of [[-11, -21.4], [11, -21.4], [-14.2, -15], [14.2, -15]]) {
    block(THREE, scene, [5.4, 0.34, 2.0], "#8a6a45", [bedX, 0.17, bedZ], LAYER.far);
    block(THREE, scene, [5.0, 0.14, 1.6], "#5b4227", [bedX, 0.36, bedZ], LAYER.far);
    flowerPatch(THREE, scene, [bedX, bedZ], LAYER.far, park, { spread: 4.2, count: 16, colors: ["#f43f5e", "#fbbf24", "#f8fafc", "#a855f7", "#fb7185"] });
  }
  for (let index = 0; index < 5; index += 1) flowerPatch(THREE, scene, [-9 + index * 4.5, -3.4 - park() * 1.4], LAYER.near, park, { spread: 2.0, count: 7 });

  // Ornamental fountain: octagonal basin, upper bowl, jets and coping.
  cylinder(THREE, scene, 3.4, 3.6, 0.62, "#a8a294", [0, 0.31, -17], LAYER.far, {}, 8);
  cylinder(THREE, scene, 3.05, 3.05, 0.5, "#4fb3d9", [0, 0.36, -17], LAYER.far, { emissive: new THREE.Color("#0e7490"), emissiveIntensity: 0.45 }, 8);
  cylinder(THREE, scene, 3.55, 3.7, 0.16, "#cfc8b6", [0, 0.66, -17], LAYER.far, {}, 8);
  cylinder(THREE, scene, 0.42, 0.55, 1.5, "#b8b1a1", [0, 1.3, -17], LAYER.far, {}, 8);
  cylinder(THREE, scene, 1.5, 1.6, 0.24, "#cfc8b6", [0, 2.1, -17], LAYER.far, {}, 12);
  cylinder(THREE, scene, 1.35, 1.35, 0.14, "#4fb3d9", [0, 2.2, -17], LAYER.far, { emissive: new THREE.Color("#0e7490"), emissiveIntensity: 0.5 }, 12);
  cylinder(THREE, scene, 0.22, 0.3, 0.9, "#b8b1a1", [0, 2.6, -17], LAYER.far, {}, 8);
  sphere(THREE, scene, 0.42, "#e0f2fe", [0, 3.3, -17], LAYER.far, { emissive: new THREE.Color("#7dd3fc"), emissiveIntensity: 0.8 }, 10, 8);
  for (let jet = 0; jet < 8; jet += 1) {
    const jetAngle = jet * Math.PI / 4;
    cylinder(THREE, scene, 0.04, 0.09, 1.5, "#dff3fb", [Math.cos(jetAngle) * 1.5, 1.5, -17 + Math.sin(jetAngle) * 1.5], LAYER.far, { rotation: [Math.sin(jetAngle) * 0.5, 0, -Math.cos(jetAngle) * 0.5], emissive: new THREE.Color("#bae6fd"), emissiveIntensity: 0.6 }, 6);
  }

  // Ornamental lamp posts around the plaza, strung with festival bunting.
  const lampSpots = [[-12, -4], [12, -4], [-12, -20], [12, -20]];
  for (const [lx, lz] of lampSpots) {
    cylinder(THREE, scene, 0.16, 0.24, 0.5, "#3f4652", [lx, 0.25, lz], LAYER.far, {}, 8);
    cylinder(THREE, scene, 0.09, 0.13, 4.2, "#3f4652", [lx, 2.35, lz], LAYER.far, {}, 8);
    for (const armSide of [-1, 1]) {
      cylinder(THREE, scene, 0.05, 0.05, 0.7, "#3f4652", [lx + armSide * 0.35, 4.45, lz], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 6);
      peak(THREE, scene, 0.26, 0.5, "#2b3038", [lx + armSide * 0.7, 4.72, lz], LAYER.far, 6);
      sphere(THREE, scene, 0.19, "#fff3d0", [lx + armSide * 0.7, 4.4, lz], LAYER.far, { emissive: new THREE.Color("#ffe4a3"), emissiveIntensity: 1.1 }, 8, 6);
    }
    peak(THREE, scene, 0.2, 0.4, "#2b3038", [lx, 4.75, lz], LAYER.far, 6);
  }
  for (let flag = 0; flag < 22; flag += 1) {
    const t = flag / 21;
    const sag = Math.sin(t * Math.PI) * 0.7;
    block(THREE, scene, [0.34, 0.4, 0.03], ["#f43f5e", "#fbbf24", "#38bdf8", "#4ade80", "#c084fc"][flag % 5], [-12 + t * 24, 4.1 - sag, -4], LAYER.far, { rotation: [0, 0, 0.15] });
  }

  // Picnic tables, benches and a balloon bouquet for the occasion.
  for (const [tx, tz] of [[-9.5, -12.5], [9.5, -12.5]]) {
    block(THREE, scene, [2.4, 0.1, 1.0], "#8b5a34", [tx, 0.76, tz], LAYER.far);
    block(THREE, scene, [2.4, 0.09, 0.4], "#8b5a34", [tx, 0.46, tz - 0.75], LAYER.far);
    block(THREE, scene, [2.4, 0.09, 0.4], "#8b5a34", [tx, 0.46, tz + 0.75], LAYER.far);
    for (const legOffset of [-1.0, 1.0]) block(THREE, scene, [0.12, 0.76, 1.9], "#6b4526", [tx + legOffset, 0.38, tz], LAYER.far, { rotation: [0.12, 0, 0] });
  }
  bench(THREE, scene, [-6.5, -20.5], LAYER.far, {});
  bench(THREE, scene, [6.5, -20.5], LAYER.far, {});
  bench(THREE, scene, [-13.6, -9.4], LAYER.far, { spin: Math.PI / 2 });
  bench(THREE, scene, [13.6, -9.4], LAYER.far, { spin: -Math.PI / 2 });
  for (let balloon = 0; balloon < 7; balloon += 1) {
    const bx = 4.6 + Math.cos(balloon * 1.1) * 0.5, by = 2.9 + Math.sin(balloon * 0.8) * 0.35, bz = -8.2 + Math.sin(balloon * 1.4) * 0.4;
    cylinder(THREE, scene, 0.008, 0.008, 1.6, "#e2e8f0", [bx, by - 0.95, bz], LAYER.far, {}, 4);
    sphere(THREE, scene, 0.26, ["#f43f5e", "#fbbf24", "#38bdf8", "#4ade80", "#c084fc", "#fb7185", "#f8fafc"][balloon], [bx, by, bz], LAYER.far, {}, 9, 7);
  }
  cylinder(THREE, scene, 0.16, 0.2, 0.5, "#6b4526", [4.6, 0.25, -8.2], LAYER.far, {}, 8);

  // A parent taking their own snapshot from the side of the plaza.
  const guest = build3DHuman(THREE, { pose: "stand", top: "#0ea5e9", bottom: "#1e293b", hair: "#4a2e1b", layer: LAYER.far, prop: "camera" });
  put(scene, guest, LAYER.far, [-5.6, 0.02, -9.4], [0, 0.35, 0]);
  contactShadow(THREE, scene, 0.3).position.set(-5.6, 0.03, -9.4);

  // Static animals
  const pigeon1 = build3DPerchedBird(THREE, "#64748b");
  put(scene, pigeon1, LAYER.near, [-1.1, 0.03, -3.8], [0, 0.6, 0]);
  contactShadow(THREE, scene, 0.18, 0.24, LAYER.near).position.set(-1.1, 0.04, -3.8);

  const parkDog = build3DSittingDog(THREE, "#eab308");
  put(scene, parkDog, LAYER.far, [-3.4, 0.03, -8.8], [0, 0.3, 0]);
  contactShadow(THREE, scene, 0.4).position.set(-3.4, 0.04, -8.8);

  const flowerbedCat = build3DSittingCat(THREE, "#334155");
  put(scene, flowerbedCat, LAYER.near, [2.6, 0.03, -4.0], [0, -0.5, 0]);

  const fountainFrog = build3DFrog(THREE, "#4d7c0f");
  put(scene, fountainFrog, LAYER.far, [2.55, 0.7, -17.3], [0, -0.4, 0]);

  const fountainSwan = build3DSwan(THREE, "#f8fafc");
  put(scene, fountainSwan, LAYER.far, [-1.35, 0.58, -17.2], [0, 0.8, 0]);

  return {};
}

/** The photographable subjects of `group`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  // Seven guests: three in front on the paving, four behind on the step.
  const groupMembers = [
    { skin: "#ffe0bd", hair: "#4a2e1b", top: "#ef4444", bottom: "#1d4ed8", hat: "#dc2626" },
    { skin: "#c68642", hair: "#0f172a", top: "#10b981", bottom: "#334155", glasses: true },
    { skin: "#fed7aa", hair: "#d97706", top: "#8b5cf6", bottom: "#1e293b" },
    { skin: "#f5d0a9", hair: "#2563eb", top: "#f59e0b", bottom: "#475569", hat: "#0284c7" },
    { skin: "#8d5524", hair: "#111827", top: "#ec4899", bottom: "#0f172a", glasses: true },
    { skin: "#e8b98a", hair: "#047857", top: "#2563eb", bottom: "#1f2937" },
    { skin: "#e0ac69", hair: "#6b21a8", top: "#059669", bottom: "#451a03", hat: "#d97706" },
  ];
  for (const [index, look] of groupMembers.entries()) {
    const member = build3DHuman(THREE, { ...look, pose: "stand", height: 1.46 + (index % 3) * 0.06, prop: index === 2 ? "balloon" : null, propColor: "#f43f5e" });
    scene.add(member);
    subjects.push(member);
    shadows.push(contactShadow(THREE, scene, 0.45));
  }
}
