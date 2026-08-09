import { LAYER } from "../world.mjs";
import { bench, block, build3DBird, build3DCar, build3DDog, build3DHuman, build3DPerchedBird, build3DScooter, build3DSittingDog, build3DSleepingCat, contactShadow, cylinder, facadeBlock, facadeTexture, put, rand, slab, sphere, streetLamp, surface } from "../scene-kit.mjs";

/** Static world for the `street` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  slab(THREE, scene, 600, 600, "#3c3f44", [0, 0, -80], LAYER.far);
  // Two-lane carriageway with a lane divider; the kerbs keep people off it.
  slab(THREE, scene, 11, 300, "#4a4e54", [0, 0.01, -80], LAYER.far);
  for (let stripe = 0; stripe < 26; stripe += 1) slab(THREE, scene, 0.35, 2.4, "#e5e2d6", [0, 0.03, -6 - stripe * 6], LAYER.far);
  // Cross street at the signalled intersection.
  slab(THREE, scene, 300, 11, "#4a4e54", [0, 0.012, -46], LAYER.far);
  for (let stripe = 0; stripe < 20; stripe += 1) {
    slab(THREE, scene, 2.4, 0.35, "#e5e2d6", [-140 + stripe * 14, 0.03, -46], LAYER.far);
  }
  // Zebra crossings and stop bars either side of the junction.
  for (const crossZ of [-20, -40.5, -51.5]) {
    for (let bar = 0; bar < 9; bar += 1) slab(THREE, scene, 0.7, 3.0, "#eceadd", [-4.6 + bar * 1.15, 0.035, crossZ], LAYER.far);
  }
  slab(THREE, scene, 5.0, 0.42, "#eceadd", [-2.75, 0.035, -23.4], LAYER.far);
  slab(THREE, scene, 5.0, 0.42, "#eceadd", [2.75, 0.035, -37.6], LAYER.far);

  for (const side of [-1, 1]) {
    // Kerb, footway and building line, all clearly separated.
    block(THREE, scene, [0.4, 0.3, 300], "#b9b5a8", [side * 5.65, 0.15, -80], LAYER.far);
    block(THREE, scene, [9, 0.26, 300], "#8d8b84", [side * 10.3, 0.13, -80], LAYER.far);
    for (let paving = 0; paving < 40; paving += 1) {
      slab(THREE, scene, 8.4, 0.06, "#7e7c75", [side * 10.3, 0.27, -6 - paving * 7.4], LAYER.far);
    }
    const city = rand(side > 0 ? 23 : 71);
    for (let index = 0; index < 14; index += 1) {
      const depth = -10 - index * 13 - city() * 5, height = 12 + city() * 22;
      const width = 9 + city() * 4;
      facadeBlock(THREE, scene, [width, height, 11], [side * (21 + city() * 3), height / 2, depth], LAYER.far, facadeTexture(THREE, { base: index % 2 ? "#b0a091" : "#95958f", frame: "#6f6b63", glass: "#d9e4e8", lit: 0.2, seed: index + (side > 0 ? 5 : 40) }));
      // Ground-floor shopfront with a canopy over the pavement.
      block(THREE, scene, [width * 0.8, 3.0, 0.4], "#5c5750", [side * 15.4, 1.6, depth], LAYER.far);
      block(THREE, scene, [width * 0.7, 1.7, 0.12], "#a7c6d8", [side * 15.15, 1.5, depth], LAYER.far);
      block(THREE, scene, [width * 0.8, 0.5, 0.16], index % 2 ? "#b91c1c" : "#0f766e", [side * 15.4, 3.4, depth], LAYER.far);
    }
    // Street lighting: pole, cranked arm, lantern.
    for (let lamp = 0; lamp < 12; lamp += 1) {
      streetLamp(THREE, scene, [side * 7.4, -12 - lamp * 22], LAYER.far, { height: 7.0, arm: -side * 1.2 });
    }
    // Planters and litter bins along the kerb line.
    for (let planter = 0; planter < 9; planter += 1) {
      const pz = -16 - planter * 18;
      block(THREE, scene, [1.1, 0.7, 1.1], "#8a7f6d", [side * 6.7, 0.6, pz], LAYER.far);
      sphere(THREE, scene, 0.55, planter % 2 ? "#4a7c3f" : "#5c8f46", [side * 6.7, 1.2, pz], LAYER.far, {}, 8, 6);
      cylinder(THREE, scene, 0.28, 0.24, 0.9, "#3f4652", [side * 6.7, 0.71, pz + 5], LAYER.far, {}, 8);
    }
    // Street trees set into the footway.
    for (let street = 0; street < 8; street += 1) {
      const tz = -24 - street * 22;
      slab(THREE, scene, 1.4, 1.4, "#5b4227", [side * 9.4, 0.28, tz], LAYER.far);
      cylinder(THREE, scene, 0.16, 0.24, 3.4, "#5b422f", [side * 9.4, 1.7, tz], LAYER.far, {}, 6);
      sphere(THREE, scene, 1.5, street % 2 ? "#4a7c3f" : "#3f6b39", [side * 9.4, 4.0, tz], LAYER.far, {}, 8, 6);
    }
  }

  // Traffic signals on all four corners of the junction.
  for (const [sx, sz, facing] of [[-6.6, -40.2, 0], [6.6, -51.8, Math.PI], [6.6, -40.2, Math.PI / 2], [-6.6, -51.8, -Math.PI / 2]]) {
    cylinder(THREE, scene, 0.12, 0.16, 5.4, "#2f343c", [sx, 2.7, sz], LAYER.far, {}, 8);
    block(THREE, scene, [0.42, 1.15, 0.36], "#22262d", [sx, 4.6, sz], LAYER.far, { rotation: [0, facing, 0] });
    for (const [lampY, lampColor, lit] of [[5.0, "#ef4444", 2.2], [4.6, "#f59e0b", 0.25], [4.2, "#22c55e", 0.25]]) {
      sphere(THREE, scene, 0.11, lampColor, [sx + Math.sin(facing) * 0.2, lampY, sz + Math.cos(facing) * 0.2], LAYER.far, { emissive: new THREE.Color(lampColor), emissiveIntensity: lit }, 7, 6);
    }
    // Pedestrian signal on the same post.
    block(THREE, scene, [0.3, 0.42, 0.26], "#22262d", [sx, 2.9, sz], LAYER.far, { rotation: [0, facing, 0] });
  }

  // Bus stop shelter with a bench and a timetable, on the right footway.
  block(THREE, scene, [4.6, 0.16, 2.0], "#94a3b8", [10.6, 2.65, -30], LAYER.far);
  for (const [px, pz] of [[8.5, -29.1], [8.5, -30.9], [12.7, -29.1], [12.7, -30.9]]) cylinder(THREE, scene, 0.08, 0.08, 2.55, "#64748b", [px, 1.3, pz], LAYER.far, {}, 6);
  block(THREE, scene, [4.4, 2.3, 0.1], "#9fc3d6", [10.6, 1.42, -31.0], LAYER.far);
  bench(THREE, scene, [10.6, -29.6], LAYER.far, { spin: Math.PI, seat: "#475569", leg: "#334155" });
  cylinder(THREE, scene, 0.1, 0.1, 3.2, "#2f343c", [7.4, 1.6, -30], LAYER.far, {}, 6);
  block(THREE, scene, [0.7, 0.7, 0.08], "#1d4ed8", [7.4, 3.3, -30], LAYER.far);

  // Cafe terrace on the left footway: awning, tables, chairs.
  block(THREE, scene, [7.4, 0.16, 3.0], "#b91c1c", [-11.6, 3.1, -14], LAYER.far, { rotation: [0.16, 0, 0] });
  for (let stripeIndex = 0; stripeIndex < 7; stripeIndex += 1) {
    block(THREE, scene, [0.5, 0.02, 3.0], stripeIndex % 2 ? "#f8fafc" : "#b91c1c", [-14.6 + stripeIndex * 1.05, 3.2, -14], LAYER.far, { rotation: [0.16, 0, 0] });
  }
  for (const [tx, tz] of [[-9.4, -12.4], [-12.4, -14.6], [-9.8, -16.4]]) {
    cylinder(THREE, scene, 0.46, 0.46, 0.06, "#e2e8f0", [tx, 0.78, tz], LAYER.far, {}, 12);
    cylinder(THREE, scene, 0.06, 0.06, 0.75, "#64748b", [tx, 0.4, tz], LAYER.far, {}, 6);
    cylinder(THREE, scene, 0.3, 0.3, 0.04, "#64748b", [tx, 0.28, tz], LAYER.far, {}, 10);
    for (const chairAngle of [0.6, 3.6]) {
      const cx = tx + Math.cos(chairAngle) * 0.85, cz = tz + Math.sin(chairAngle) * 0.85;
      block(THREE, scene, [0.42, 0.06, 0.42], "#7c5734", [cx, 0.46, cz], LAYER.far, { rotation: [0, -chairAngle, 0] });
      block(THREE, scene, [0.42, 0.46, 0.06], "#7c5734", [cx - Math.cos(chairAngle) * 0.2, 0.72, cz - Math.sin(chairAngle) * 0.2], LAYER.far, { rotation: [0, -chairAngle, 0] });
      for (const legAngle of [0.8, 2.4, 3.9, 5.5]) cylinder(THREE, scene, 0.02, 0.02, 0.46, "#5b422f", [cx + Math.cos(legAngle) * 0.16, 0.23, cz + Math.sin(legAngle) * 0.16], LAYER.far, {}, 4);
    }
  }

  // Parked bicycles at a rack, a fire hydrant, and road signage.
  for (let rack = 0; rack < 4; rack += 1) {
    const rz = -22 - rack * 1.3;
    cylinder(THREE, scene, 0.04, 0.04, 0.75, "#64748b", [-8.2, 0.65, rz], LAYER.far, {}, 6);
    cylinder(THREE, scene, 0.04, 0.04, 0.75, "#64748b", [-7.4, 0.65, rz], LAYER.far, {}, 6);
    block(THREE, scene, [0.84, 0.05, 0.05], "#64748b", [-7.8, 1.02, rz], LAYER.far);
    for (const wheelX of [-8.3, -7.3]) {
      const wheel = put(scene, new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 5, 14), surface(THREE, "#1f2937")), LAYER.far, [wheelX, 0.6, rz], [0, Math.PI / 2, 0]);
      wheel.updateMatrix();
    }
    block(THREE, scene, [0.9, 0.06, 0.06], ["#dc2626", "#0ea5e9", "#16a34a", "#f59e0b"][rack], [-7.8, 0.85, rz], LAYER.far, { rotation: [0, 0, 0.1] });
    block(THREE, scene, [0.06, 0.42, 0.06], "#334155", [-7.35, 1.05, rz], LAYER.far);
  }
  cylinder(THREE, scene, 0.14, 0.16, 0.7, "#dc2626", [6.4, 0.63, -12], LAYER.far, {}, 8);
  sphere(THREE, scene, 0.15, "#dc2626", [6.4, 1.0, -12], LAYER.far, {}, 8, 6);
  cylinder(THREE, scene, 0.07, 0.07, 0.34, "#dc2626", [6.4, 0.82, -12], LAYER.far, { rotation: [Math.PI / 2, 0, 0] }, 6);
  for (const [signX, signZ, signColor] of [[-6.4, -8, "#1d4ed8"], [6.4, -60, "#b91c1c"], [-6.4, -72, "#15803d"]]) {
    cylinder(THREE, scene, 0.05, 0.05, 2.6, "#9ca3af", [signX, 1.3, signZ], LAYER.far, {}, 6);
    block(THREE, scene, [0.72, 0.72, 0.05], signColor, [signX, 2.5, signZ], LAYER.far);
    block(THREE, scene, [0.52, 0.14, 0.03], "#f8fafc", [signX, 2.5, signZ - 0.04], LAYER.far);
  }

  // Cars parked along the kerb, in the direction of their own lane.
  for (let parked = 0; parked < 5; parked += 1) {
    const car = build3DCar(THREE, ["#1d4ed8", "#f8fafc", "#334155", "#15803d", "#b91c1c"][parked]);
    put(scene, car, LAYER.far, [4.4, 0.02, -58 - parked * 9], [0, Math.PI, 0]);
    contactShadow(THREE, scene, 1.2, 0.2).position.set(4.4, 0.03, -58 - parked * 9);
  }
  for (let parked = 0; parked < 4; parked += 1) {
    const car = build3DCar(THREE, ["#7c3aed", "#e2e8f0", "#0f766e", "#f59e0b"][parked]);
    put(scene, car, LAYER.far, [-4.4, 0.02, -66 - parked * 9], [0, 0, 0]);
    contactShadow(THREE, scene, 1.2, 0.2).position.set(-4.4, 0.03, -66 - parked * 9);
  }

  // Two people waiting at the cafe: they stand on the footway, not the road.
  const barista = build3DHuman(THREE, { pose: "stand", top: "#f8fafc", bottom: "#111827", hair: "#1c1917", layer: LAYER.far });
  put(scene, barista, LAYER.far, [-13.4, 0.28, -13.6], [0, 1.4, 0]);
  contactShadow(THREE, scene, 0.3).position.set(-13.4, 0.29, -13.6);
  const waiting = build3DHuman(THREE, { pose: "stand", top: "#0ea5e9", bottom: "#374151", hair: "#78350f", glasses: true, layer: LAYER.far, prop: "bag", propColor: "#a16207" });
  put(scene, waiting, LAYER.far, [9.4, 0.28, -30.6], [0, -1.2, 0]);
  contactShadow(THREE, scene, 0.3).position.set(9.4, 0.29, -30.6);

  // Static animals
  const umbrellaCat = build3DSleepingCat(THREE, "#ea580c");
  put(scene, umbrellaCat, LAYER.far, [-9.8, 0.84, -12.4], [0, 0.2, 0]);

  const streetDog = build3DSittingDog(THREE, "#d97706");
  put(scene, streetDog, LAYER.far, [-7.0, 0.28, -17.2], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.35).position.set(-7.0, 0.29, -17.2);

  const kerbPigeon = build3DPerchedBird(THREE, "#64748b");
  put(scene, kerbPigeon, LAYER.near, [6.9, 0.28, -6.4], [0, -0.6, 0]);

  return {};
}

/** The photographable subjects of `street`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const ped1 = build3DHuman(THREE, { pose: "walk", skin: "#f0c9a4", hair: "#1f2937", top: "#dc2626", bottom: "#1e3a8a", height: 1.52, prop: "bag", propColor: "#7c2d12" });
  scene.add(ped1);
  const ped2 = build3DHuman(THREE, { pose: "walk", skin: "#c68642", hair: "#111827", top: "#06b6d4", bottom: "#334155", height: 1.48, hat: "#0f172a" });
  scene.add(ped2);
  const car = build3DCar(THREE, "#dc2626"); scene.add(car);
  const scooter = build3DScooter(THREE, "#2563eb"); scene.add(scooter);
  const dog = build3DDog(THREE, "#d97706"); scene.add(dog);
  const pigeons = build3DBird(THREE, "#64748b"); scene.add(pigeons);

  // The circling pigeon leads: it is the one subject that laps the whole street.
  subjects.push(pigeons, ped1, ped2, car, scooter, dog);
  for (let i = 0; i < 6; i += 1) shadows.push(contactShadow(THREE, scene, 0.5));
}
