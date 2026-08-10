import { LAYER } from "../world.mjs";
import { block, build3DBat, build3DBird, build3DCar, build3DCat, build3DHuman, build3DPerchedBird, build3DRaccoon, build3DRat, build3DScooter, build3DSittingCat, contactShadow, cylinder, facadeBlock, facadeTexture, glowDecal, lightCone, put, rand, slab, streetLamp, surface } from "../scene-kit.mjs";

/** Static world for the `night` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  slab(THREE, scene, 600, 600, "#14161d", [0, 0, -80], LAYER.far);
  slab(THREE, scene, 12, 260, "#1b1f2a", [0, 0.01, -70], LAYER.far, { emissive: new THREE.Color("#2a2440"), emissiveIntensity: 0.5 });
  const city = rand(89);
  const neon = ["#ff5d8f", "#4fd1ff", "#ffc94f", "#9d7bff", "#4fffa8"];
  for (const side of [-1, 1]) {
    // Kerb and wet footway, set back from the carriageway.
    block(THREE, scene, [0.4, 0.32, 260], "#2b3040", [side * 6.2, 0.16, -70], LAYER.far);
    block(THREE, scene, [7, 0.28, 260], "#22262f", [side * 9.9, 0.14, -70], LAYER.far);
    for (let index = 0; index < 13; index += 1) {
      const depth = -8 - index * 12 - city() * 4, height = 16 + city() * 30;
      facadeBlock(THREE, scene, [9 + city() * 4, height, 11], [side * (20 + city() * 3), height / 2, depth], LAYER.far, facadeTexture(THREE, { base: "#0d0f16", frame: "#191d28", glass: "#ffd489", lit: 0.5, seed: index * 3 + (side > 0 ? 2 : 30) }), "#c8ccd8", "#7d5c2a");
      // Vertical blade sign hung over the pavement.
      const color = neon[Math.floor(city() * neon.length) % neon.length];
      block(THREE, scene, [0.4, 3.6 + city() * 2.4, 0.4], color, [side * 13.4, 5 + city() * 7, depth + 2], LAYER.far, { emissive: new THREE.Color(color), emissiveIntensity: 2.4 });
      // Horizontal box sign, and a ring sign, in a second colour.
      const boxColor = neon[Math.floor(city() * neon.length) % neon.length];
      block(THREE, scene, [0.3, 1.1, 3.4], boxColor, [side * 13.2, 3.2 + city() * 2.5, depth - 3], LAYER.far, { emissive: new THREE.Color(boxColor), emissiveIntensity: 2.6 });
      if (index % 3 === 0) {
        const ringColor = neon[Math.floor(city() * neon.length) % neon.length];
        const ring = put(scene, new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 16), surface(THREE, ringColor, { emissive: new THREE.Color(ringColor), emissiveIntensity: 2.8 })), LAYER.far, [side * 13.2, 9 + city() * 5, depth + 4], [0, Math.PI / 2, 0]);
        ring.updateMatrix();
      }
      // Shopfront glow at street level.
      block(THREE, scene, [0.3, 2.2, 6.5], "#ffcf7a", [side * 13.6, 1.6, depth], LAYER.far, { emissive: new THREE.Color("#ffb057"), emissiveIntensity: 1.5 });
      // Balcony air-conditioning boxes break the flat facades.
      for (let unit = 0; unit < 3; unit += 1) block(THREE, scene, [0.7, 0.6, 0.9], "#2b303c", [side * 13.8, 6 + unit * 6 + city() * 2, depth + 3], LAYER.far);
    }
    // Street lamps with a visible cone in the rain.
    for (let lamp = 0; lamp < 8; lamp += 1) {
      const lz = -12 - lamp * 18;
      streetLamp(THREE, scene, [side * 7.6, lz], LAYER.far, { height: 6.6, pole: "#2b3040", glow: "#ffd68a", arm: -side * 1.1 });
      lightCone(THREE, scene, [side * 6.5, 6.4, lz], LAYER.far, "#ffd68a", 1.25, 6.2, 0.035);
    }
    // Rain puddles catching the neon: tight, saturated smears of reflected
    // colour rather than broad washes, so they read as water and not as haze.
    for (let puddle = 0; puddle < 14; puddle += 1) {
      const pz = -6 - puddle * 8 - city() * 4;
      glowDecal(THREE, scene, [side * (2 + city() * 3), 0.045, pz], LAYER.far, neon[Math.floor(city() * neon.length) % neon.length], 0.34 + city() * 0.34, 1.3 + city() * 1.6, 0.17 + city() * 0.12);
      glowDecal(THREE, scene, [side * (8 + city() * 3), 0.3, pz - 3], LAYER.far, "#ffd68a", 0.22 + city() * 0.24, 0.7 + city() * 0.8, 0.14);
    }
  }
  // Puddles right at the tripod, so the foreground band has something to blur.
  for (let puddle = 0; puddle < 6; puddle += 1) {
    glowDecal(THREE, scene, [-5 + city() * 10, 0.05, -5 - city() * 4], LAYER.near, neon[Math.floor(city() * neon.length) % neon.length], 0.26 + city() * 0.2, 0.8 + city() * 0.7, 0.13);
  }

  // Yatai ramen stall: canvas roof, counter, stools and paper lanterns.
  block(THREE, scene, [4.6, 0.12, 2.6], "#7c2d12", [-9.4, 2.65, -26], LAYER.far);
  block(THREE, scene, [4.6, 0.5, 0.1], "#b91c1c", [-9.4, 2.35, -27.20], LAYER.far);
  for (const [px, pz] of [[-11.5, -24.90], [-11.5, -27.10], [-7.3, -24.90], [-7.3, -27.10]]) cylinder(THREE, scene, 0.07, 0.07, 2.4, "#4a3522", [px, 1.44, pz], LAYER.far, {}, 6);
  block(THREE, scene, [4.2, 0.14, 0.7], "#8a6a45", [-9.4, 1.15, -25.40], LAYER.far);
  block(THREE, scene, [4.0, 0.9, 1.4], "#3f2d1e", [-9.4, 0.72, -26.50], LAYER.far);
  block(THREE, scene, [3.6, 0.24, 1.0], "#facc15", [-9.4, 1.45, -26.60], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 1.8 });
  for (let stool = 0; stool < 3; stool += 1) {
    cylinder(THREE, scene, 0.2, 0.2, 0.07, "#7c2d12", [-10.6 + stool * 1.2, 0.71, -24.60], LAYER.far, {}, 10);
    cylinder(THREE, scene, 0.05, 0.05, 0.68, "#3f3f46", [-10.6 + stool * 1.2, 0.34, -24.60], LAYER.far, {}, 6);
  }
  for (let lantern = 0; lantern < 4; lantern += 1) {
    cylinder(THREE, scene, 0.19, 0.19, 0.34, "#ff6b4f", [-11.2 + lantern * 1.2, 2.25, -24.90], LAYER.far, { emissive: new THREE.Color("#ff8a4c"), emissiveIntensity: 2.4 }, 10);
  }
  const stallLamp = new THREE.PointLight(new THREE.Color("#ffb257"), 16, 16, 2);
  stallLamp.position.set(-9.4, 2.1, -25.8); stallLamp.layers.enableAll(); scene.add(stallLamp);
  // Steam rising off the pot.
  for (let puff = 0; puff < 5; puff += 1) {
    const steam = new THREE.Mesh(new THREE.SphereGeometry(0.3 + puff * 0.12, 7, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#e2e8f0"), transparent: true, opacity: 0.16 - puff * 0.02, depthWrite: false }));
    steam.raycast = () => {};
    put(scene, steam, LAYER.far, [-9.4 + puff * 0.12, 1.9 + puff * 0.45, -26.60]);
  }

  // Vending machines and a steam vent on the opposite footway.
  for (let machine = 0; machine < 3; machine += 1) {
    const mz = -20 - machine * 2.2;
    block(THREE, scene, [1.0, 1.9, 0.7], "#1f2937", [11.6, 1.09, mz], LAYER.far);
    block(THREE, scene, [0.86, 1.5, 0.06], ["#38bdf8", "#f43f5e", "#4ade80"][machine], [11.6, 1.2, mz - 0.36], LAYER.far, { emissive: new THREE.Color(["#38bdf8", "#f43f5e", "#4ade80"][machine]), emissiveIntensity: 1.9 });
  }
  slab(THREE, scene, 1.4, 1.4, "#3f4652", [4.2, 0.03, -24], LAYER.far);
  for (let puff = 0; puff < 4; puff += 1) {
    const vent = new THREE.Mesh(new THREE.SphereGeometry(0.5 + puff * 0.3, 7, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color("#cbd5e1"), transparent: true, opacity: 0.14 - puff * 0.025, depthWrite: false }));
    vent.raycast = () => {};
    put(scene, vent, LAYER.far, [4.2 + puff * 0.2, 0.5 + puff * 0.8, -24]);
  }

  // Overhead cables and a banner strung across the street.
  for (const cableY of [8.4, 9.2]) block(THREE, scene, [26, 0.06, 0.06], "#0b0e15", [0, cableY, -34], LAYER.far);
  block(THREE, scene, [11, 1.5, 0.08], "#f43f5e", [0, 7.4, -34], LAYER.far, { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 1.6 });

  for (const [x, z, color] of [[-6, -18, "#ff5d8f"], [6, -26, "#4fd1ff"]]) {
    const lamp = new THREE.PointLight(new THREE.Color(color), 26, 34, 2);
    lamp.position.set(x, 6, z); lamp.layers.enableAll(); scene.add(lamp);
  }
  const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 18, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#cdd6ff") }));
  moon.userData.isCelestial = true;
  moon.raycast = () => {};
  put(scene, moon, LAYER.far, [120, 130, -560]);
  scene.userData.meteringEmitter = moon;

  const drops = 900, positions = new Float32Array(drops * 6);
  for (let index = 0; index < drops; index += 1) {
    const x = -26 + city() * 52, y = city() * 22, z = -1 - city() * 54, fall = 0.5 + city() * 0.5;
    positions.set([x, y, z, x + 0.06, y - fall, z], index * 6);
  }
  const rainGeometry = new THREE.BufferGeometry();
  rainGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: new THREE.Color("#b9c8ff"), transparent: true, opacity: 0.34 }));
  rain.userData.animated = true;
  rain.raycast = () => {};
  put(scene, rain, LAYER.far, [0, 0, 0]);
  const rainNear = rain.clone();
  rainNear.material = rain.material.clone();
  rainNear.material.opacity = 0.5;
  rainNear.userData.animated = true;
  rainNear.raycast = () => {};
  put(scene, rainNear, LAYER.near, [0, 0, 3.5]);

  // A cook behind the yatai counter, and a customer on a stool.
  const cook = build3DHuman(THREE, { pose: "stand", top: "#f8fafc", bottom: "#1f2937", hair: "#0f172a", hat: "#e2e8f0", layer: LAYER.far });
  put(scene, cook, LAYER.far, [-9.4, 0.28, -27.40], [0, 0, 0]);
  const diner = build3DHuman(THREE, { pose: "sit", top: "#7c3aed", bottom: "#1e1b4b", hair: "#3f2a1b", layer: LAYER.far });
  put(scene, diner, LAYER.far, [-10.6, 0.28, -24.50], [0, Math.PI, 0]);

  // Static animals
  const ramenCat = build3DSittingCat(THREE, "#f59e0b");
  put(scene, ramenCat, LAYER.far, [-7.6, 0.28, -24.2], [0, 0.4, 0]);
  contactShadow(THREE, scene, 0.3).position.set(-7.6, 0.29, -24.2);

  const poleOwl = build3DPerchedBird(THREE, "#38bdf8", "#f59e0b");
  put(scene, poleOwl, LAYER.far, [6.5, 6.6, -30.0], [0, -0.5, 0]);

  const yataiRaccoon = build3DRaccoon(THREE, "#475569");
  put(scene, yataiRaccoon, LAYER.far, [8.7, 0.28, -19.6], [0, -0.8, 0]);
  contactShadow(THREE, scene, 0.22).position.set(8.7, 0.29, -19.6);

  const drainRat = build3DRat(THREE, "#57534e");
  put(scene, drainRat, LAYER.far, [-6.8, 0.28, -12.2], [0, 0.45, 0]);

  const neonBat = build3DBat(THREE, "#312e81");
  put(scene, neonBat, LAYER.far, [4.8, 5.8, -20], [0.15, -0.4, -0.1]);

  return {
    updaters: [(elapsed) => {
      const drop = (elapsed * 16) % 6;
      rain.position.y = -drop; rainNear.position.y = -drop * 1.4;
    }],
  };
}

/** The photographable subjects of `night`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  // It is raining, so both pedestrians carry an umbrella.
  const ped1 = build3DHuman(THREE, { pose: "walk", skin: "#e8b98a", hair: "#1e1b4b", top: "#7c3aed", bottom: "#111827", height: 1.5, prop: "umbrella", propColor: "#f43f5e" });
  scene.add(ped1);
  const ped2 = build3DHuman(THREE, { pose: "walk", skin: "#c68642", hair: "#475569", top: "#0ea5e9", bottom: "#1e1b4b", height: 1.46, prop: "umbrella", propColor: "#0f172a" });
  scene.add(ped2);
  const taxi = build3DCar(THREE, "#eab308", true); scene.add(taxi);
  const scooter = build3DScooter(THREE, "#06b6d4"); scene.add(scooter);
  const cat = build3DCat(THREE, "#1e1b4b"); scene.add(cat);
  const owl = build3DBird(THREE, "#38bdf8"); scene.add(owl);

  subjects.push(owl, ped1, ped2, taxi, scooter, cat);
  for (let i = 0; i < 6; i += 1) shadows.push(contactShadow(THREE, scene, 0.5));
}
