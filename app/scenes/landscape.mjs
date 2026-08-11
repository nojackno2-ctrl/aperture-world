import { LAYER } from "../world.mjs";
import { bench, block, boulder, build3DBird, build3DBunny, build3DDeer, build3DFloatingDuck, build3DFox, build3DGrazingDeer, build3DHedgehog, build3DHuman, build3DPerchedBird, build3DRestingDeer, build3DSquirrel, contactShadow, cylinder, fence, flowerPatch, peak, put, rand, slab, sphere, surface, tree } from "../scene-kit.mjs";

/** Static world for the `landscape` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  slab(THREE, scene, 2400, 2400, "#67954f", [0, 0, -300], LAYER.far);
  const ridge = rand(31);
  for (let index = 0; index < 18; index += 1) {
    const x = -760 + index * 88 + ridge() * 40, z = -520 - ridge() * 260, radius = 80 + ridge() * 90, height = 150 + ridge() * 190;
    peak(THREE, scene, radius, height, index % 2 ? "#5f7f9e" : "#6d8aa6", [x, 0, z], LAYER.far, 5);
    peak(THREE, scene, radius * 0.34, height * 0.3, "#eef3f7", [x, height * 0.36, z], LAYER.far, 5);
  }
  for (let index = 0; index < 12; index += 1) {
    const side = index % 2 ? 1 : -1;
    peak(THREE, scene, 40 + ridge() * 34, 60 + ridge() * 70, "#5b8a4e", [side * (70 + ridge() * 140), 0, -180 - ridge() * 150], LAYER.far, 5);
  }
  // Alpine lake, pushed beyond the tree line so the meadow reads as meadow.
  put(scene, new THREE.Mesh(new THREE.CircleGeometry(110, 44), surface(THREE, "#9fd0e2", { emissive: new THREE.Color("#3a7590"), emissiveIntensity: 0.4 })), LAYER.far, [0, 0.04, -230], [-Math.PI / 2, 0, 0]);
  const grove = rand(97);
  // Boulders ringing the near shoreline.
  for (let index = 0; index < 34; index += 1) {
    const angle = 0.12 + (index / 33) * (Math.PI - 0.24);
    boulder(THREE, scene, [Math.cos(angle) * 110, 0.3, -230 + Math.sin(angle) * 110], LAYER.far, 1.4 + grove() * 2.2, grove, index % 3 ? "#8d8578" : "#9e978a");
  }
  for (let index = 0; index < 30; index += 1) {
    const side = index % 2 ? 1 : -1;
    tree(THREE, scene, [side * (16 + grove() * 86), 0, -34 - grove() * 96], LAYER.far, 1.8 + grove() * 2.4, index % 3 ? "#3f6b3c" : "#547f3f");
  }
  // A stand of pale birch breaks up the wall of conifers.
  for (let index = 0; index < 14; index += 1) {
    const side = index % 2 ? 1 : -1;
    const bx = side * (24 + grove() * 40), bz = -46 - grove() * 60;
    cylinder(THREE, scene, 0.13, 0.19, 6.5 + grove() * 2.4, "#e7e3d8", [bx, 3.4, bz], LAYER.far, {}, 6);
    sphere(THREE, scene, 1.5 + grove() * 0.9, index % 2 ? "#7fa74c" : "#8fb85a", [bx, 7.4 + grove(), bz], LAYER.far, {}, 8, 6);
  }
  // Broadleaf trees with round crowns, for a softer mid-ground silhouette.
  for (let index = 0; index < 12; index += 1) {
    const side = index % 2 ? 1 : -1;
    const bx = side * (12 + grove() * 70), bz = -30 - grove() * 70;
    cylinder(THREE, scene, 0.24, 0.34, 3.6, "#5b422f", [bx, 1.8, bz], LAYER.far, {}, 6);
    sphere(THREE, scene, 2.2 + grove() * 1.2, index % 3 ? "#4a7c3f" : "#5c8f46", [bx, 5.0 + grove() * 0.8, bz], LAYER.far, {}, 9, 7);
  }
  for (let index = 0; index < 64; index += 1) block(THREE, scene, [0.26 + grove() * 0.26, 0.14 + grove() * 0.22, 0.26], index % 3 ? "#6d9a4d" : "#5f8f46", [-13 + grove() * 26, 0.1, -3.4 - grove() * 4.6], LAYER.near, { rotation: [0, grove() * 3, 0] });
  for (let index = 0; index < 5; index += 1) put(scene, new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + grove() * 0.16), surface(THREE, "#a49d8d")), LAYER.near, [-9 + grove() * 18, 0.12, -5.4 - grove() * 2.4], [grove(), grove(), grove()]);
  for (let index = 0; index < 24; index += 1) put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.5 + grove() * 0.7, 7, 5), surface(THREE, index % 4 ? "#4f7f42" : "#5f8f46")), LAYER.far, [-40 + grove() * 80, 0.3, -12 - grove() * 34], null);
  // Wildflowers: near the tripod, and drifts across the meadow.
  for (let index = 0; index < 6; index += 1) flowerPatch(THREE, scene, [-8 + index * 3.2 + grove() * 2, -5.5 - grove() * 3], LAYER.near, grove, { spread: 2.2, count: 8 });
  for (let index = 0; index < 16; index += 1) flowerPatch(THREE, scene, [-58 + grove() * 116, -18 - grove() * 60], LAYER.far, grove, { spread: 4.5, count: 10 });

  // Meadow trail: it runs from the tripod, past the cabin turn-off, to the bridge.
  slab(THREE, scene, 3.4, 62, "#9c8158", [0, 0.02, -41], LAYER.far);
  slab(THREE, scene, 2.4, 18, "#9c8158", [-9, 0.02, -55], LAYER.far, { spin: Math.PI / 2 });

  // Meltwater stream running across the meadow into the lake.
  slab(THREE, scene, 300, 5.4, "#7fb6cc", [0, 0.03, -72], LAYER.far, { emissive: new THREE.Color("#356f8a"), emissiveIntensity: 0.35 });
  for (let index = 0; index < 40; index += 1) {
    const side = index % 2 ? 1 : -1;
    boulder(THREE, scene, [-70 + grove() * 140, 0.12, -72 + side * (2.7 + grove() * 0.9)], LAYER.far, 0.3 + grove() * 0.45, grove, "#7d7669");
  }

  // Plank bridge over the stream, on the trail.
  block(THREE, scene, [3.6, 0.2, 10.4], "#8a6a45", [0, 0.45, -72], LAYER.far);
  for (const px of [-1.5, 1.5]) {
    for (const pz of [-69.4, -74.6]) cylinder(THREE, scene, 0.2, 0.2, 2.0, "#4a3522", [px, -0.2, pz], LAYER.far, {}, 6);
    for (let pz = -76.6; pz <= -67.4; pz += 1.8) block(THREE, scene, [0.13, 0.95, 0.13], "#6b4f35", [px, 1.03, pz], LAYER.far);
    block(THREE, scene, [0.1, 0.11, 9.6], "#6b4f35", [px, 1.45, -72], LAYER.far);
  }

  // Alpine Wooden Cabin with a woodpile, water barrel and stone chimney.
  block(THREE, scene, [5.5, 3.2, 4.2], "#735238", [-18, 1.6, -55], LAYER.far);
  peak(THREE, scene, 3.8, 2.0, "#422e1f", [-18, 4.2, -55], LAYER.far, 4);
  block(THREE, scene, [0.8, 1.6, 0.2], "#362215", [-18, 0.8, -52.85], LAYER.far);
  block(THREE, scene, [1.1, 1.0, 0.1], "#ffdf85", [-16.2, 2.0, -52.85], LAYER.far, { emissive: new THREE.Color("#ffaa33"), emissiveIntensity: 1.4 });
  block(THREE, scene, [1.1, 1.0, 0.1], "#ffdf85", [-19.8, 2.0, -52.85], LAYER.far, { emissive: new THREE.Color("#ffaa33"), emissiveIntensity: 1.4 });
  cylinder(THREE, scene, 0.25, 0.25, 1.8, "#4a4a4a", [-19.8, 4.4, -55], LAYER.far);
  block(THREE, scene, [3.0, 0.16, 1.6], "#7a6448", [-18, 0.1, -52.4], LAYER.far);
  for (let row = 0; row < 4; row += 1) {
    for (let log = 0; log < 7; log += 1) {
      cylinder(THREE, scene, 0.16, 0.16, 2.2, log % 2 ? "#8a6a45" : "#6f5334", [-21.6, 0.18 + row * 0.32, -57.4 + log * 0.33], LAYER.far, { rotation: [0, Math.PI / 2, 0] }, 6);
    }
  }
  cylinder(THREE, scene, 0.42, 0.46, 0.9, "#5b442c", [-15.2, 0.45, -53.4], LAYER.far, {}, 10);
  bench(THREE, scene, [-14.6, -52.2], LAYER.far, { spin: 0.2 });

  // Fire-watch tower on the eastern rise.
  for (const [tx, tz] of [[32, -98], [37, -98], [32, -103], [37, -103]]) {
    cylinder(THREE, scene, 0.24, 0.32, 13, "#6b5334", [tx, 6.5, tz], LAYER.far, {}, 6);
  }
  for (const braceY of [4.2, 8.6]) {
    block(THREE, scene, [5.4, 0.16, 0.16], "#6b5334", [34.5, braceY, -98], LAYER.far);
    block(THREE, scene, [5.4, 0.16, 0.16], "#6b5334", [34.5, braceY, -103], LAYER.far);
  }
  block(THREE, scene, [7.0, 0.35, 7.0], "#7a6448", [34.5, 13.1, -100.5], LAYER.far);
  block(THREE, scene, [5.6, 2.0, 5.6], "#8a7350", [34.5, 14.3, -100.5], LAYER.far);
  peak(THREE, scene, 5.2, 1.7, "#3d2c20", [34.5, 16.2, -100.5], LAYER.far, 4);
  fence(THREE, scene, [31.2, -104], [37.8, -104], 14.2, "#5e452e", LAYER.far, 2.2);

  // Timber windmill on the lake side of the meadow.
  cylinder(THREE, scene, 1.6, 2.8, 9.5, "#a89a7c", [-52, 4.75, -112], LAYER.far, {}, 8);
  peak(THREE, scene, 3.2, 2.2, "#5c4326", [-52, 10.6, -112], LAYER.far, 6);
  for (let blade = 0; blade < 4; blade += 1) {
    const angle = blade * Math.PI / 2 + 0.4;
    block(THREE, scene, [1.0, 5.6, 0.16], "#d9cfb4", [-52 + Math.sin(angle) * 3.2, 8.6 + Math.cos(angle) * 3.2, -108.8], LAYER.far, { rotation: [0, 0, angle] });
  }

  // Split-Rail Fence along trail
  fence(THREE, scene, [-16, -14], [-8, -20], 0.95, "#6b4f35", LAYER.far);
  fence(THREE, scene, [8, -18], [18, -26], 0.95, "#6b4f35", LAYER.far);
  fence(THREE, scene, [-24, -40], [-24, -62], 0.95, "#6b4f35", LAYER.far);

  // Campsite
  peak(THREE, scene, 1.5, 1.3, "#ea580c", [-7, 0.65, -22], LAYER.far, 3);
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    sphere(THREE, scene, 0.12, "#64748b", [-5 + Math.cos(angle) * 0.5, 0.08, -21 + Math.sin(angle) * 0.5], LAYER.far);
  }
  block(THREE, scene, [0.5, 0.12, 0.12], "#f97316", [-5, 0.08, -21], LAYER.far, { emissive: new THREE.Color("#ff6600"), emissiveIntensity: 1.8 });

  // Distant hot-air balloons drifting over the range.
  for (const [bx, by, bz, envelope, basket] of [[-140, 82, -380, "#ef4444", "#7c5a34"], [96, 64, -300, "#f59e0b", "#7c5a34"], [26, 104, -450, "#38bdf8", "#7c5a34"]]) {
    const balloon = put(scene, new THREE.Mesh(new THREE.SphereGeometry(11, 12, 10), surface(THREE, envelope)), LAYER.far, [bx, by, bz]);
    balloon.scale.set(1, 1.22, 1);
    peak(THREE, scene, 8.4, 7.0, envelope, [bx, by - 12.5, bz], LAYER.far, 8);
    block(THREE, scene, [3.0, 2.6, 3.0], basket, [bx, by - 17.6, bz], LAYER.far);
  }

  // Static wildlife
  const grazingDeer = build3DGrazingDeer(THREE, "#92400e");
  put(scene, grazingDeer, LAYER.far, [-14, 0, -34], [0, 0.8, 0]);
  contactShadow(THREE, scene, 0.45).position.set(-14, 0.02, -34);

  const restingDeer = build3DRestingDeer(THREE, "#b45309");
  put(scene, restingDeer, LAYER.far, [12, 0, -26], [0, -0.6, 0]);
  contactShadow(THREE, scene, 0.4).position.set(12, 0.02, -26);

  const staticBunny = build3DBunny(THREE, "#f8fafc");
  put(scene, staticBunny, LAYER.near, [-4.8, 0, -4.6], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.25, 0.24, LAYER.near).position.set(-4.8, 0.02, -4.6);

  const duck1 = build3DFloatingDuck(THREE, "#15803d", "#78350f");
  put(scene, duck1, LAYER.far, [6, 0.06, -136], [0, 0.3, 0]);
  const duck2 = build3DFloatingDuck(THREE, "#047857", "#92400e");
  put(scene, duck2, LAYER.far, [-11, 0.06, -148], [0, -0.5, 0]);

  const pierBird = build3DPerchedBird(THREE, "#3b82f6");
  put(scene, pierBird, LAYER.far, [1.6, 1.5, -69.6], [0, -0.8, 0]);
  const cabinBird = build3DPerchedBird(THREE, "#475569");
  put(scene, cabinBird, LAYER.far, [-18, 5.25, -55], [0, 0.5, 0]);

  const squirrel = build3DSquirrel(THREE, "#c2410c");
  put(scene, squirrel, LAYER.far, [-11.5, 1.0, -17], [0, 0.6, 0]);

  const meadowFox = build3DFox(THREE, "#ea580c");
  put(scene, meadowFox, LAYER.far, [19.5, 0.02, -39], [0, -0.8, 0]);
  contactShadow(THREE, scene, 0.32).position.set(19.5, 0.03, -39);

  const trailHedgehog = build3DHedgehog(THREE, "#57534e");
  put(scene, trailHedgehog, LAYER.far, [-18.5, 0.02, -24], [0, 0.55, 0]);
  contactShadow(THREE, scene, 0.18).position.set(-18.5, 0.03, -24);

  // A camper by the tent gives the valley a sense of scale.
  const camper = build3DHuman(THREE, { pose: "stand", top: "#dc2626", bottom: "#1f2937", hair: "#3f2a1b", hat: "#0f766e", layer: LAYER.far, prop: "camera" });
  put(scene, camper, LAYER.far, [-6.2, 0.02, -20.4], [0, 2.5, 0]);
  contactShadow(THREE, scene, 0.32).position.set(-6.2, 0.02, -20.4);

  return {};
}

/** The photographable subjects of `landscape`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const deer1 = build3DDeer(THREE, "#b45309"); scene.add(deer1);
  const deer2 = build3DDeer(THREE, "#92400e"); scene.add(deer2);
  const eagle = build3DBird(THREE, "#3f3f46"); scene.add(eagle);
  const bunny = build3DBunny(THREE, "#ffffff"); scene.add(bunny);

  subjects.push(deer1, deer2, eagle, bunny);
  shadows.push(contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.2), contactShadow(THREE, scene, 0.3));
}
