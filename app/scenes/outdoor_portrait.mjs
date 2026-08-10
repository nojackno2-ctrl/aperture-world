import { LAYER } from "../world.mjs";
import { block, boulder, build3DBird, build3DBunny, build3DFrog, build3DHedgehog, build3DModelPose, build3DPerchedBird, build3DSittingDog, build3DSleepingCat, build3DSwan, build3DTurtle, contactShadow, cylinder, flowerPatch, hedge, peak, put, rand, slab, sphere, surface, tree } from "../scene-kit.mjs";

/** Static world for the `outdoor_portrait` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  const garden = rand(83);
  // Garden terrace cobblestone ground & green lawn
  slab(THREE, scene, 120, 120, "#4a7c44", [0, 0, -14], LAYER.far);
  for (let mow = 0; mow < 24; mow += 1) slab(THREE, scene, 120, 1.4, mow % 2 ? "#4f8449" : "#457540", [0, 0.005, -3 - mow * 1.5], LAYER.far);
  slab(THREE, scene, 9, 9, "#b8a88a", [0, 0.02, -4], LAYER.far);
  // Laid flagstones, so the terrace reads as built rather than painted.
  for (let stone = 0; stone < 42; stone += 1) {
    const sx = -3.9 + (stone % 7) * 1.3 + (garden() - 0.5) * 0.12;
    const sz = -0.6 - Math.floor(stone / 7) * 1.2 + (garden() - 0.5) * 0.1;
    slab(THREE, scene, 1.14 + garden() * 0.1, 1.04 + garden() * 0.1, stone % 3 ? "#c8b899" : "#bfae8e", [sx, 0.03, sz], LAYER.far, { spin: (garden() - 0.5) * 0.14 });
  }
  // Stone path leading away from the terrace into the garden.
  for (let step = 0; step < 14; step += 1) {
    const px = Math.sin(step * 0.42) * 1.9;
    slab(THREE, scene, 1.1, 0.8, "#c8b899", [px, 0.03, -8.8 - step * 1.15], LAYER.far, { spin: Math.cos(step * 0.42) * 0.3 });
  }

  // Pergola: four bays of beams, posts and flowering wisteria.
  const pergolaMat = "#78350f";
  for (const px of [-2.4, 2.4]) {
    for (const pz of [-3.4, -4.7, -6.0, -7.3]) {
      cylinder(THREE, scene, 0.09, 0.11, 2.9, pergolaMat, [px, 1.45, pz], LAYER.far, {}, 6);
      block(THREE, scene, [0.5, 0.5, 0.12], pergolaMat, [px + (px > 0 ? -0.3 : 0.3), 2.6, pz], LAYER.far, { rotation: [0, 0, px > 0 ? -0.78 : 0.78] });
    }
    block(THREE, scene, [0.16, 0.18, 4.6], pergolaMat, [px, 2.92, -5.35], LAYER.far);
  }
  for (let beam = 0; beam <= 10; beam += 1) {
    block(THREE, scene, [5.3, 0.11, 0.13], pergolaMat, [0, 3.06, -3.3 - beam * 0.45], LAYER.far);
  }
  const wisteriaColors = ["#c084fc", "#a855f7", "#818cf8", "#e879f9", "#f472b6"];
  for (let w = 0; w < 44; w += 1) {
    const wx = -2.35 + (w % 11) * 0.47, wz = -3.3 - Math.floor(w / 11) * 1.2;
    // Short, plump racemes: long spikes overhead read as icicles, not blossom.
    cylinder(THREE, scene, 0.085, 0.02, 0.26 + (w % 3) * 0.09, wisteriaColors[w % wisteriaColors.length], [wx, 2.84, wz], LAYER.far, {}, 6);
    sphere(THREE, scene, 0.1, wisteriaColors[(w + 2) % wisteriaColors.length], [wx, 2.96, wz], LAYER.far, {}, 6, 5);
    if (w % 2 === 0) sphere(THREE, scene, 0.17, garden() > 0.5 ? "#3f7535" : "#4d8f42", [wx + 0.2, 3.02, wz + 0.25], LAYER.far, {}, 7, 5);
  }

  // Rose arch over the stone path.
  for (const archSide of [-1, 1]) {
    cylinder(THREE, scene, 0.05, 0.06, 2.2, "#5f7a4a", [archSide * 1.05, 1.1, -9.6], LAYER.far, {}, 6);
    for (let seg = 0; seg < 5; seg += 1) {
      const segAngle = (seg + 0.5) * (Math.PI / 2) / 5;
      block(THREE, scene, [0.09, 0.09, 0.5], "#5f7a4a", [archSide * 1.05 * Math.cos(segAngle), 2.2 + 1.05 * Math.sin(segAngle), -9.6], LAYER.far, { rotation: [0, Math.PI / 2, archSide * segAngle] });
    }
  }
  block(THREE, scene, [2.2, 0.09, 0.09], "#5f7a4a", [0, 3.25, -9.6], LAYER.far);
  for (let rose = 0; rose < 26; rose += 1) {
    const roseAngle = (rose / 25) * Math.PI;
    sphere(THREE, scene, 0.09 + garden() * 0.05, rose % 3 ? "#f43f5e" : "#fda4af", [Math.cos(roseAngle) * 1.05, 2.2 + Math.sin(roseAngle) * 1.05, -9.6 + (garden() - 0.5) * 0.35], LAYER.far, {}, 6, 5);
  }

  // Clipped hedges framing the terrace, and a garden lantern by the path.
  hedge(THREE, scene, [-4.9, -1.2], [-4.9, -9.5], LAYER.far, { height: 1.05, width: 0.85 });
  hedge(THREE, scene, [4.9, -1.2], [4.9, -9.5], LAYER.far, { height: 1.05, width: 0.85 });
  hedge(THREE, scene, [-4.9, -11.5], [-1.6, -11.5], LAYER.far, { height: 0.85, width: 0.8 });
  hedge(THREE, scene, [1.6, -11.5], [4.9, -11.5], LAYER.far, { height: 0.85, width: 0.8 });
  block(THREE, scene, [0.42, 0.16, 0.42], "#8f8a7c", [-2.4, 0.08, -8.6], LAYER.far);
  cylinder(THREE, scene, 0.09, 0.11, 0.75, "#8f8a7c", [-2.4, 0.53, -8.6], LAYER.far, {}, 6);
  block(THREE, scene, [0.36, 0.34, 0.36], "#fff3d0", [-2.4, 1.06, -8.6], LAYER.far, { emissive: new THREE.Color("#ffe4a3"), emissiveIntensity: 0.9 });
  peak(THREE, scene, 0.34, 0.24, "#6b6355", [-2.4, 1.34, -8.6], LAYER.far, 4);

  // Koi pond with a stone rim, water lilies and a small birdbath beside it.
  cylinder(THREE, scene, 2.0, 2.1, 0.3, "#9c927e", [4.3, 0.15, -12.5], LAYER.far, {}, 14);
  cylinder(THREE, scene, 1.75, 1.75, 0.24, "#3f93b8", [4.3, 0.2, -12.5], LAYER.far, { emissive: new THREE.Color("#1d6f96"), emissiveIntensity: 0.45 }, 14);
  for (let rim = 0; rim < 12; rim += 1) {
    const rimAngle = rim * Math.PI / 6;
    boulder(THREE, scene, [4.3 + Math.cos(rimAngle) * 2.05, 0.2, -12.5 + Math.sin(rimAngle) * 2.05], LAYER.far, 0.22 + garden() * 0.12, garden, "#a49a86");
  }
  for (let pad = 0; pad < 7; pad += 1) {
    slab(THREE, scene, 0.5, 0.5, "#3f7a3d", [4.3 + (garden() - 0.5) * 2.4, 0.33, -12.5 + (garden() - 0.5) * 2.4], LAYER.far, { spin: garden() * 3 });
  }
  for (let koi = 0; koi < 4; koi += 1) {
    const fish = put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 5), surface(THREE, koi % 2 ? "#f97316" : "#f8fafc")), LAYER.far, [4.3 + (garden() - 0.5) * 2.0, 0.28, -12.5 + (garden() - 0.5) * 2.0], [0, garden() * 3, 0]);
    fish.scale.set(0.6, 0.5, 1.6);
  }
  cylinder(THREE, scene, 0.24, 0.3, 0.9, "#cfc6b2", [-4.2, 0.45, -12.2], LAYER.far, {}, 10);
  cylinder(THREE, scene, 0.62, 0.5, 0.16, "#d9d1bd", [-4.2, 0.98, -12.2], LAYER.far, {}, 14);
  cylinder(THREE, scene, 0.52, 0.52, 0.06, "#7fc0da", [-4.2, 1.03, -12.2], LAYER.far, { emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.4 }, 14);

  // Garden Flowerbeds on foreground sides
  const flowerColors = ["#ec4899", "#f59e0b", "#3b82f6", "#ffffff", "#8b5cf6", "#ef4444"];
  for (let f = 0; f < 28; f += 1) {
    const side = f % 2 ? 1 : -1;
    const fx = side * (1.8 + (f % 5) * 0.4), fz = -2.2 - (f % 6) * 0.5;
    peak(THREE, scene, 0.1, 0.25, flowerColors[f % flowerColors.length], [fx, 0.15, fz], LAYER.near, 4);
  }

  // Classic Stone Garden Bench
  block(THREE, scene, [1.8, 0.08, 0.55], "#f1f5f9", [3.5, 0.42, -5.6], LAYER.far, { rotation: [0, -0.4, 0] });
  cylinder(THREE, scene, 0.08, 0.08, 0.42, "#cbd5e1", [2.9, 0.21, -5.35], LAYER.far);
  cylinder(THREE, scene, 0.08, 0.08, 0.42, "#cbd5e1", [4.1, 0.21, -5.85], LAYER.far);
  block(THREE, scene, [1.8, 0.45, 0.08], "#f1f5f9", [3.6, 0.68, -5.85], LAYER.far, { rotation: [0, -0.4, 0] });

  // Multi-tier Classical Garden Fountain in bokeh background (Z = -15m)
  cylinder(THREE, scene, 1.8, 1.9, 0.4, "#cbd5e1", [0, 0.2, -15], LAYER.far, {}, 14);
  cylinder(THREE, scene, 1.6, 1.6, 0.3, "#38bdf8", [0, 0.24, -15], LAYER.far, { emissive: new THREE.Color("#0284c7"), emissiveIntensity: 0.5 }, 14);
  cylinder(THREE, scene, 0.3, 0.35, 0.9, "#94a3b8", [0, 0.7, -15], LAYER.far);
  cylinder(THREE, scene, 0.8, 0.85, 0.2, "#cbd5e1", [0, 1.2, -15], LAYER.far, {}, 12);
  cylinder(THREE, scene, 0.2, 0.24, 0.6, "#94a3b8", [0, 1.55, -15], LAYER.far);
  sphere(THREE, scene, 0.32, "#e0f2fe", [0, 1.95, -15], LAYER.far, { emissive: new THREE.Color("#7dd3fc"), emissiveIntensity: 0.6 });
  for (let jet = 0; jet < 6; jet += 1) {
    const jetAngle = jet * Math.PI / 3;
    cylinder(THREE, scene, 0.03, 0.06, 0.9, "#dff3fb", [Math.cos(jetAngle) * 0.6, 1.5, -15 + Math.sin(jetAngle) * 0.6], LAYER.far, { rotation: [Math.sin(jetAngle) * 0.6, 0, -Math.cos(jetAngle) * 0.6], emissive: new THREE.Color("#bae6fd"), emissiveIntensity: 0.5 }, 6);
  }

  // Wildflower clusters break up the mown lawn.
  for (let patch = 0; patch < 12; patch += 1) {
    flowerPatch(THREE, scene, [-14 + garden() * 28, -6 - garden() * 16], LAYER.far, garden, { spread: 2.4, count: 10, colors: ["#f9a8d4", "#fde047", "#f8fafc", "#c4b5fd"] });
  }

  // Dappled Shade Trees in background
  for (let t = 0; t < 12; t += 1) {
    const side = t % 2 ? 1 : -1;
    tree(THREE, scene, [side * (7.5 + (t % 4) * 2.6), 0, -8.5 - (t % 5) * 3.2], LAYER.far, 1.6 + (t % 3) * 0.4, "#3f7535", "#5c4033");
  }
  for (let t = 0; t < 6; t += 1) {
    const side = t % 2 ? 1 : -1;
    const bx = side * (9 + garden() * 10), bz = -14 - garden() * 12;
    cylinder(THREE, scene, 0.22, 0.3, 3.0, "#5c4033", [bx, 1.5, bz], LAYER.far, {}, 6);
    sphere(THREE, scene, 2.0 + garden() * 0.8, t % 2 ? "#4a7c3f" : "#5c8f46", [bx, 4.3, bz], LAYER.far, {}, 9, 7);
  }

  // Static animals
  const gardenDog = build3DSittingDog(THREE, "#eab308");
  put(scene, gardenDog, LAYER.far, [1.65, 0.04, -3.6], [0, -0.4, 0]);
  contactShadow(THREE, scene, 0.35).position.set(1.65, 0.05, -3.6);

  const archBird = build3DPerchedBird(THREE, "#ec4899", "#f59e0b");
  put(scene, archBird, LAYER.far, [0.55, 3.3, -9.6], [0, 0.5, 0]);

  const wallCat = build3DSleepingCat(THREE, "#ea580c");
  put(scene, wallCat, LAYER.far, [-4.9, 1.08, -6.4], [0, 0.2, 0]);

  const pondTurtle = build3DTurtle(THREE, "#365314");
  put(scene, pondTurtle, LAYER.far, [4.9, 0.32, -11.0], [0, -0.9, 0]);

  const gardenBunny = build3DBunny(THREE, "#ffffff");
  put(scene, gardenBunny, LAYER.near, [-1.8, 0.04, -2.6], [0, 0.6, 0]);
  contactShadow(THREE, scene, 0.24, 0.24, LAYER.near).position.set(-1.8, 0.05, -2.6);

  const pondFrog = build3DFrog(THREE, "#65a30d");
  put(scene, pondFrog, LAYER.far, [3.35, 0.32, -11.8], [0, -0.5, 0]);

  const koiSwan = build3DSwan(THREE, "#f8fafc");
  put(scene, koiSwan, LAYER.far, [4.35, 0.28, -12.9], [0, 0.55, 0]);

  const borderHedgehog = build3DHedgehog(THREE, "#57534e");
  put(scene, borderHedgehog, LAYER.far, [-6.2, 0.03, -8.4], [0, 0.7, 0]);
  contactShadow(THREE, scene, 0.16).position.set(-6.2, 0.04, -8.4);

  return {};
}

/** The photographable subjects of `outdoor_portrait`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const model = build3DModelPose(THREE, "#78350f", "#ec4899"); scene.add(model);
  const butterfly = build3DBird(THREE, "#f472b6"); scene.add(butterfly);

  subjects.push(model, butterfly);
  shadows.push(contactShadow(THREE, scene, 0.42), contactShadow(THREE, scene, 0.2));
}
