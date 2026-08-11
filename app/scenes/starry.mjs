import { LAYER } from "../world.mjs";
import { block, boulder, build3DAstronomer, build3DBat, build3DBird, build3DFox, build3DPerchedBird, build3DRestingDeer, contactShadow, cylinder, fence, peak, put, rand, slab, sphere, surface, tree } from "../scene-kit.mjs";

/** Static world for the `starry` scenario. Loaded only when this scene is played. */
export function terrain(THREE, scene) {
  slab(THREE, scene, 1800, 1800, "#080c14", [0, 0, -260], LAYER.far);
  const ridge = rand(43);
  for (let index = 0; index < 22; index += 1) {
    const x = -680 + index * 65 + ridge() * 30, z = -450 - ridge() * 240, radius = 60 + ridge() * 80, height = 120 + ridge() * 160;
    peak(THREE, scene, radius, height, "#050912", [x, 0, z], LAYER.far, 5);
    peak(THREE, scene, radius * 0.4, height * 0.25, "#1e293b", [x, height * 0.4, z], LAYER.far, 4);
  }
  for (let index = 0; index < 18; index += 1) {
    const side = index % 2 ? 1 : -1;
    tree(THREE, scene, [side * (12 + ridge() * 65), 0, -22 - ridge() * 80], LAYER.far, 1.6 + ridge() * 1.8, "#060d18", "#03060c");
  }

  // Mountain Observation Terrace & Campsite
  block(THREE, scene, [18, 0.25, 14], "#131b2c", [0, 0.12, -7.5], LAYER.far);
  fence(THREE, scene, [-8.5, -5.5], [8.5, -5.5], 1.05, "#1f293d", LAYER.far);
  fence(THREE, scene, [-8.5, -5.5], [-8.5, -14.5], 1.05, "#1f293d", LAYER.far);
  fence(THREE, scene, [8.5, -5.5], [8.5, -14.5], 1.05, "#1f293d", LAYER.far);

  // Warm Camping Tent with glowing lantern inside
  peak(THREE, scene, 1.8, 1.5, "#ea580c", [-4.8, 0.75, -9.5], LAYER.far, 3);
  const campLamp = new THREE.PointLight(new THREE.Color("#fbbf24"), 6, 12, 2);
  campLamp.position.set(-4.8, 0.6, -9.5); campLamp.layers.enableAll(); scene.add(campLamp);
  block(THREE, scene, [0.4, 0.1, 0.1], "#f59e0b", [-4.8, 0.08, -8.6], LAYER.far, { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 1.8 });

  // Second tent, a bedroll and a camp table beside it.
  peak(THREE, scene, 1.6, 1.35, "#0f766e", [4.6, 0.68, -10.8], LAYER.far, 3);
  block(THREE, scene, [1.3, 0.18, 0.5], "#1e293b", [3.2, 0.2, -9.6], LAYER.far);
  block(THREE, scene, [1.1, 0.08, 0.7], "#1f2937", [5.9, 0.55, -9.4], LAYER.far);
  for (const [tx, tz] of [[5.45, -9.1], [6.35, -9.1], [5.45, -9.7], [6.35, -9.7]]) cylinder(THREE, scene, 0.03, 0.03, 0.5, "#1f2937", [tx, 0.27, tz], LAYER.far, {}, 4);

  // Campfire ring: stones, embers, and just enough glow to read in the dark.
  for (let stone = 0; stone < 10; stone += 1) {
    const stoneAngle = stone * Math.PI / 5;
    boulder(THREE, scene, [1.6 + Math.cos(stoneAngle) * 0.85, 0.09, -10.2 + Math.sin(stoneAngle) * 0.85], LAYER.far, 0.17, ridge, "#1a2231");
  }
  for (let log = 0; log < 4; log += 1) {
    cylinder(THREE, scene, 0.07, 0.07, 0.7, "#2a1c11", [1.6, 0.1, -10.2], LAYER.far, { rotation: [Math.PI / 2, log * 0.8, 0.25] }, 5);
  }
  sphere(THREE, scene, 0.22, "#b45309", [1.6, 0.1, -10.2], LAYER.far, { emissive: new THREE.Color("#ea580c"), emissiveIntensity: 1.5 }, 8, 6);
  const emberLight = new THREE.PointLight(new THREE.Color("#f97316"), 2.6, 7, 2);
  emberLight.position.set(1.6, 0.35, -10.2); emberLight.layers.enableAll(); scene.add(emberLight);

  // Little observatory dome perched on the ridge behind the terrace.
  cylinder(THREE, scene, 4.6, 5.2, 4.0, "#111a2a", [-26, 2.0, -46], LAYER.far, {}, 14);
  const observatoryDome = put(scene, new THREE.Mesh(new THREE.SphereGeometry(4.7, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), surface(THREE, "#1b2740")), LAYER.far, [-26, 4.0, -46]);
  observatoryDome.updateMatrix();
  block(THREE, scene, [1.3, 4.8, 0.5], "#050912", [-26, 6.2, -41.5], LAYER.far);
  block(THREE, scene, [0.4, 0.14, 0.14], "#ef4444", [-26, 8.6, -41.4], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 2.2 });
  block(THREE, scene, [7.0, 0.3, 5.0], "#0d1420", [-26, 0.15, -41], LAYER.far);

  // Foreground boulders framing the terrace, kept out to the flanks: a rock on
  // the centre line is the one thing that would sit between the lens and the sky.
  for (let rock = 0; rock < 10; rock += 1) {
    const side = rock % 2 ? 1 : -1;
    boulder(THREE, scene, [side * (3.6 + ridge() * 5.5), 0.25, -2.6 - ridge() * 3.0], LAYER.near, 0.35 + ridge() * 0.55, ridge, "#0d1522");
  }
  for (let rock = 0; rock < 12; rock += 1) {
    boulder(THREE, scene, [-16 + ridge() * 32, 0.3, -18 - ridge() * 14], LAYER.far, 0.6 + ridge() * 1.3, ridge, "#0a121f");
  }

  // Thousands of Twinkling Stars (1500+ star points across night celestial sphere)
  const starCount = 1600;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSeed = rand(77);
  const palettes = [[0.6, 0.8, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.8], [1.0, 0.7, 0.6], [0.8, 0.9, 1.0]];
  for (let i = 0; i < starCount; i += 1) {
    const u = starSeed(), v = starSeed();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1) * 0.45;
    const dist = 1100 + starSeed() * 200;
    starPos[i * 3] = dist * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 1] = dist * Math.cos(phi) + 80;
    starPos[i * 3 + 2] = -dist * Math.sin(phi) * Math.cos(theta) - 200;
    const c = palettes[Math.floor(starSeed() * palettes.length)];
    const bright = 0.5 + starSeed() * 0.5;
    starColors[i * 3] = c[0] * bright;
    starColors[i * 3 + 1] = c[1] * bright;
    starColors[i * 3 + 2] = c[2] * bright;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({ size: 3.5, vertexColors: true, transparent: true, opacity: 0.88 });
  const stars = new THREE.Points(starGeo, starMat);
  stars.raycast = () => {};
  stars.userData.isCelestial = true;
  put(scene, stars, LAYER.far, [0, 0, 0]);

  // Glowing Milky Way Galactic Arch
  const mwGroup = new THREE.Group();
  const mwColors = ["#312e81", "#4338ca", "#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#38bdf8"];
  for (let p = 0; p < 28; p += 1) {
    const t = p / 27;
    const angle = (t - 0.5) * 1.8;
    const x = Math.sin(angle) * 750 + (starSeed() - 0.5) * 60;
    const y = Math.cos(angle) * 750 + 120 + (starSeed() - 0.5) * 40;
    const z = -650 - Math.sin(t * Math.PI) * 200;
    const c = mwColors[p % mwColors.length];
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(160 + starSeed() * 80, 90 + starSeed() * 50), new THREE.MeshBasicMaterial({
      color: new THREE.Color(c), transparent: true, opacity: 0.14 + (1 - Math.abs(t - 0.5) * 2) * 0.18, depthWrite: false, side: THREE.DoubleSide,
    }));
    cloud.position.set(x, y, z);
    cloud.rotation.z = angle + 0.4;
    cloud.raycast = () => {};
    mwGroup.add(cloud);
  }
  mwGroup.raycast = () => {};
  mwGroup.userData.isCelestial = true;
  put(scene, mwGroup, LAYER.far, [0, 0, 0]);

  // Milky Way Core Emitter (for optical exposure & infinity focus)
  const milkyWayCore = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#c7d2fe"), transparent: true, opacity: 0.1, depthWrite: false }));
  milkyWayCore.userData.isCelestial = true;
  milkyWayCore.raycast = () => {};
  put(scene, milkyWayCore, LAYER.far, [140, 480, -780]);
  scene.userData.meteringEmitter = milkyWayCore;

  // Static mountain wildlife
  const nightOwl = build3DPerchedBird(THREE, "#38bdf8", "#f59e0b");
  put(scene, nightOwl, LAYER.far, [6.5, 4.2, -14], [0, -0.4, 0]);
  const restingGoat = build3DRestingDeer(THREE, "#475569");
  put(scene, restingGoat, LAYER.far, [-8.5, 0.2, -16], [0, 0.6, 0]);
  contactShadow(THREE, scene, 0.45).position.set(-8.5, 0.02, -16);

  const ridgeFox = build3DFox(THREE, "#9a3412");
  put(scene, ridgeFox, LAYER.far, [9.6, 0.06, -18.4], [0, -0.7, 0]);
  contactShadow(THREE, scene, 0.3).position.set(9.6, 0.07, -18.4);

  const caveBat = build3DBat(THREE, "#1e1b4b");
  put(scene, caveBat, LAYER.far, [-4.2, 5.4, -12], [0.1, 0.45, 0]);

  return {};
}

/** The photographable subjects of `starry`, plus one contact shadow each. */
export function cast(THREE, scene, subjects, shadows) {
  const stargazer = build3DAstronomer(THREE, "#1e293b"); scene.add(stargazer);
  const meteor = build3DBird(THREE, "#93c5fd"); scene.add(meteor);

  subjects.push(stargazer, meteor);
  shadows.push(contactShadow(THREE, scene, 0.45), contactShadow(THREE, scene, 0.3));
}
