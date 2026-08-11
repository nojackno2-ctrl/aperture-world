import { LAYER } from "./world.mjs";

/**
 * The shared modelling kit every scenario is built from: primitives, props, the
 * procedural people, and the animals. `THREE` is passed in so this module never
 * pulls the renderer into the server bundle.
 *
 * This is the part all eleven worlds have in common, so it ships with the
 * viewport; the geometry unique to one scenario lives in `./scenes/<key>.mjs`.
 *
 * Every mesh is assigned to a depth bucket (`LAYER.far` / `LAYER.subject` /
 * `LAYER.near`) so a capture can blur each band by its own circle of confusion.
 */

/** A proper flock gives the wildlife scene multiple targets to track. */
export const BIRD_COUNT = 7;

export const rand = seed => { let value = seed; return () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648; };

export function surface(THREE, color, options = {}) { return new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: true, ...options }); }

export function put(scene, object, layer, position, rotation) {
  object.layers.set(layer);
  if (position) object.position.set(position[0], position[1], position[2]);
  if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
  scene.add(object);
  return object;
}

export function block(THREE, scene, size, color, position, layer, { rotation, ...material } = {}) {
  return put(scene, new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), surface(THREE, color, material)), layer, position, rotation);
}

export function slab(THREE, scene, width, depth, color, position, layer, { spin = 0, ...material } = {}) {
  return put(scene, new THREE.Mesh(new THREE.PlaneGeometry(width, depth), surface(THREE, color, { side: THREE.DoubleSide, ...material })), layer, position, [-Math.PI / 2, 0, spin]);
}

export function peak(THREE, scene, radius, height, color, position, layer, segments = 5) {
  return put(scene, new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), surface(THREE, color)), layer, position);
}

export function tree(THREE, scene, position, layer, scale = 1, leaf = "#43703f", trunk = "#5b422f") {
  put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.22 * scale, 1.5 * scale, 6), surface(THREE, trunk)), layer, [position[0], position[1] + 0.75 * scale, position[2]]);
  for (let tier = 0; tier < 3; tier += 1) {
    put(scene, new THREE.Mesh(new THREE.ConeGeometry((1.15 - tier * 0.28) * scale, (1.5 - tier * 0.22) * scale, 6), surface(THREE, leaf)), layer, [position[0], position[1] + (1.55 + tier * 0.78) * scale, position[2]]);
  }
}

/** Procedural facade texture: far cheaper than modelling every window. */
export function facadeTexture(THREE, { base, frame, glass, lit = 0, columns = 6, rows = 12, seed = 7 }) {
  if (typeof document === "undefined") {
    const texture = new THREE.Texture();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const next = rand(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 256);
  const cellW = 128 / columns, cellH = 256 / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const roll = next();
      ctx.fillStyle = roll < lit ? glass : frame;
      ctx.fillRect(column * cellW + cellW * 0.22, row * cellH + cellH * 0.2, cellW * 0.56, cellH * 0.5);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * A window grid only reads if each window survives as a couple of pixels. One
 * tile per four metres is right for a building you stand next to and hopeless
 * for a tower a kilometre away, where it aliases down to flat paint — so a
 * distant facade passes its own repeat.
 */
export function facadeBlock(THREE, scene, size, position, layer, texture, tint = "#ffffff", glow, repeat) {
  const material = new THREE.MeshLambertMaterial({ map: texture.clone(), color: new THREE.Color(tint) });
  material.map.needsUpdate = true;
  if (glow) { material.emissive = new THREE.Color(glow); material.emissiveMap = material.map; material.emissiveIntensity = 1.1; }
  material.map.repeat.set(...(repeat ?? [Math.max(1, Math.round(size[0] / 4)), Math.max(1, Math.round(size[1] / 4))]));
  return put(scene, new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material), layer, position);
}

export function skyDome(THREE, scene, [top, bottom]) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(top) }, bottomColor: { value: new THREE.Color(bottom) } },
    vertexShader: "varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    // The warm band belongs to the lowest ~11 degrees; above that it is sky.
    fragmentShader: "uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorld; void main(){ float h = normalize(vWorld).y; gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(-0.03, 0.2, h)), 1.0); }",
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 18), material);
  // The dome is not a thing you can focus on: an AF frame over it means infinity.
  dome.raycast = () => {};
  // …and it wraps the tripod, so its centre distance is zero. Depth banding has
  // to be told this is the horizon, not the closest object in the scene.
  dome.userData.infinite = true;
  return put(scene, dome, LAYER.far, [0, 0, 0]);
}

/**
 * Limb rotations per stance, in radians about the local X axis.
 * The figure faces local +Z, so a negative hip angle swings that leg forward.
 */
export const HUMAN_POSES = {
  stand: { lean: 0, drop: 0, hip: [-0.03, 0.03], knee: [0.04, 0.04], shoulder: [0.10, -0.10], elbow: [0.22, 0.22] },
  walk: { lean: -0.04, drop: -0.03, hip: [-0.40, 0.34], knee: [0.20, 0.16], shoulder: [0.38, -0.34], elbow: [0.34, 0.30] },
  // Mid-stride: front knee driven high, trailing toe still brushing the track.
  // `drop` is what puts that trailing toe on the ground rather than in the air.
  run: { lean: -0.30, drop: -0.09, hip: [-1.25, 0.72], knee: [1.55, 0.12], shoulder: [1.15, -1.00], elbow: [1.35, 1.15] },
  sit: { lean: -0.04, drop: -0.33, hip: [-1.50, -1.44], knee: [1.46, 1.40], shoulder: [-0.18, -0.24], elbow: [0.62, 0.56] },
};

/**
 * Stylised low-poly person, roughly 1.5 m tall, built from flat-shaded solids.
 * The group origin sits at the FEET so a route only has to lift it clear of the
 * ground by the thickness of a shoe sole.
 */
export function build3DHuman(THREE, options = {}) {
  const {
    skin = "#f0c9a4", hair = "#2a1d14", top = "#3b82f6", bottom = "#1f2937",
    shoes = "#111827", hat = null, glasses = false, pose = "stand",
    height = 1.5, layer = LAYER.subject, prop = null, propColor = "#334155",
    sleeves = true, bare = false,
  } = options;
  const s = height / 1.5;
  const stance = HUMAN_POSES[pose] ?? HUMAN_POSES.stand;
  const group = new THREE.Group();
  const skinMat = surface(THREE, skin);
  const hairMat = surface(THREE, hair);
  const topMat = surface(THREE, top);
  const bottomMat = surface(THREE, bottom);
  const shoeMat = surface(THREE, shoes);
  const darkMat = surface(THREE, "#111827");
  const armMat = sleeves ? topMat : skinMat;
  const shinMat = bare ? skinMat : bottomMat;

  // The whole figure hangs off `frame`, which a stance can drop towards the
  // ground. `upper` pivots at the hips, so leaning tips the torso forward
  // without swinging the legs — which is what keeps a sprinter's feet on the track.
  const HIP_Y = 0.74;
  const frame = new THREE.Group();
  frame.position.y = stance.drop * s;
  group.add(frame);
  const upper = new THREE.Group();
  upper.position.y = HIP_Y * s;
  upper.rotation.x = stance.lean;
  frame.add(upper);
  const at = y => (y - HIP_Y) * s;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34 * s, 0.44 * s, 0.21 * s), topMat);
  torso.position.set(0, at(0.97), 0);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.31 * s, 0.16 * s, 0.21 * s), bottomMat);
  hips.position.set(0, at(0.71), 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.06 * s, 0.09 * s, 6), skinMat);
  neck.position.set(0, at(1.22), 0);
  upper.add(torso, hips, neck);

  // Head, hair and optional accessories.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155 * s, 10, 8), skinMat);
  head.position.set(0, at(1.36), 0);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.163 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  cap.position.set(0, at(1.36), -0.01 * s);
  const nape = new THREE.Mesh(new THREE.BoxGeometry(0.24 * s, 0.14 * s, 0.1 * s), hairMat);
  nape.position.set(0, at(1.31), -0.11 * s);
  upper.add(head, cap, nape);
  for (const ex of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 6, 5), darkMat);
    eye.position.set(ex * s, at(1.37), 0.14 * s);
    upper.add(eye);
  }
  if (glasses) {
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.015 * s, 0.02 * s), darkMat);
    bridge.position.set(0, at(1.375), 0.15 * s);
    upper.add(bridge);
    for (const ex of [-0.062, 0.062]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.009 * s, 4, 8), darkMat);
      rim.position.set(ex * s, at(1.375), 0.148 * s);
      upper.add(rim);
    }
  }
  if (hat) {
    const hatMat = surface(THREE, hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * s, 0.24 * s, 0.02 * s, 12), hatMat);
    brim.position.set(0, at(1.47), 0.01 * s);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.145 * s, 0.16 * s, 0.13 * s, 10), hatMat);
    crown.position.set(0, at(1.54), 0);
    upper.add(brim, crown);
  }

  // Legs: hip pivot -> thigh -> knee pivot -> shin -> shoe. They hang off the
  // unleaned frame so the stance's drop alone decides where the feet land.
  for (const [index, side] of [-1, 1].entries()) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095 * s, HIP_Y * s, 0);
    hip.rotation.x = stance.hip[index];
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.078 * s, 0.066 * s, 0.36 * s, 6), bottomMat);
    thigh.position.y = -0.18 * s;
    const knee = new THREE.Group();
    knee.position.y = -0.36 * s;
    knee.rotation.x = stance.knee[index];
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.05 * s, 0.34 * s, 6), shinMat);
    shin.position.y = -0.17 * s;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.23 * s), shoeMat);
    shoe.position.set(0, -0.355 * s, 0.05 * s);
    knee.add(shin, shoe);
    hip.add(thigh, knee);
    frame.add(hip);
  }

  // Arms: shoulder pivot -> upper arm -> elbow pivot -> forearm -> hand.
  const hands = [];
  for (const [index, side] of [-1, 1].entries()) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.215 * s, at(1.14), 0);
    shoulder.rotation.set(stance.shoulder[index], 0, side * 0.13);
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.058 * s, 0.05 * s, 0.31 * s, 6), armMat);
    upperArm.position.y = -0.155 * s;
    const elbow = new THREE.Group();
    elbow.position.y = -0.31 * s;
    elbow.rotation.x = stance.elbow[index];
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.048 * s, 0.042 * s, 0.29 * s, 6), skinMat);
    fore.position.y = -0.145 * s;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 6, 5), skinMat);
    hand.position.y = -0.31 * s;
    elbow.add(fore, hand);
    shoulder.add(upperArm, elbow);
    upper.add(shoulder);
    hands.push({ shoulder, elbow });
  }

  if (prop === "umbrella") {
    // A raised canopy reads instantly in the rain, so the arm goes up with it.
    hands[1].shoulder.rotation.set(-0.35, 0, 0.55);
    hands[1].elbow.rotation.x = -1.15;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.016 * s, 0.95 * s, 5), surface(THREE, "#3f3f46"));
    shaft.position.set(0.3 * s, at(1.42), 0.06 * s);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.52 * s, 0.3 * s, 10), surface(THREE, propColor));
    canopy.position.set(0.3 * s, at(1.99), 0.06 * s);
    upper.add(shaft, canopy);
  } else if (prop === "bag") {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.24 * s, 0.1 * s), surface(THREE, propColor));
    bag.position.set(-0.3 * s, at(0.72), 0.02 * s);
    upper.add(bag);
  } else if (prop === "camera") {
    hands[0].shoulder.rotation.set(-1.15, 0, 0.35);
    hands[0].elbow.rotation.x = -1.05;
    hands[1].shoulder.rotation.set(-1.15, 0, -0.35);
    hands[1].elbow.rotation.x = -1.05;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.11 * s, 0.08 * s), surface(THREE, "#1f2937"));
    body.position.set(0, at(1.3), 0.24 * s);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.12 * s, 8), surface(THREE, "#0f172a"));
    lens.position.set(0, at(1.3), 0.33 * s);
    lens.rotation.x = Math.PI / 2;
    upper.add(body, lens);
  } else if (prop === "balloon") {
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.7 * s, 4), surface(THREE, "#e2e8f0"));
    string.position.set(0.3 * s, at(1.35), 0.05 * s);
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 7), surface(THREE, propColor));
    balloon.position.set(0.3 * s, at(1.84), 0.05 * s);
    upper.add(string, balloon);
  }

  group.traverse(object => { if (object.isMesh) object.layers.set(layer); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DDeer(THREE, color = "#b45309") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const darkMat = surface(THREE, "#78350f");
  const whiteMat = surface(THREE, "#ffffff");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 1.3), mat); body.position.set(0, 0.7, 0); group.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 6), mat); neck.position.set(0, 1.15, 0.45); neck.rotation.x = 0.35; group.add(neck);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.5), mat); head.position.set(0, 1.4, 0.65); group.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.25), darkMat); snout.position.set(0, 1.35, 0.95); group.add(snout);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), mat); earL.position.set(-0.2, 1.55, 0.6); earL.rotation.z = -0.6;
  const earR = earL.clone(); earR.position.x = 0.2; earR.rotation.z = 0.6; group.add(earL, earR);
  const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 5), darkMat); antL.position.set(-0.15, 1.7, 0.6); antL.rotation.z = -0.3;
  const antR = antL.clone(); antR.position.x = 0.15; antR.rotation.z = 0.3; group.add(antL, antR);
  for (const [lx, lz] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 6), mat); leg.position.set(lx, 0.35, lz); group.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.15), whiteMat); tail.position.set(0, 0.8, -0.68); group.add(tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DBird(THREE, color = "#475569") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const beakMat = surface(THREE, "#f59e0b");
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 6), mat); body.rotation.x = Math.PI / 2; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat); head.position.set(0, 0.08, 0.35); group.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), beakMat); beak.position.set(0, 0.05, 0.5); beak.rotation.x = Math.PI / 2; group.add(beak);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.28), mat); wingL.position.set(-0.35, 0.05, 0.05); wingL.rotation.z = 0.15;
  const wingR = wingL.clone(); wingR.position.x = 0.35; wingR.rotation.z = -0.15; group.add(wingL, wingR);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DBunny(THREE, color = "#ffffff") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat); body.position.set(0, 0.3, 0); group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat); head.position.set(0, 0.48, 0.2); group.add(head);
  const earL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.38, 6), mat); earL.position.set(-0.09, 0.72, 0.18); earL.rotation.z = -0.15;
  const earR = earL.clone(); earR.position.x = 0.09; earR.rotation.z = 0.15; group.add(earL, earR);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mat); tail.position.set(0, 0.28, -0.28); group.add(tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DDog(THREE, color = "#d97706") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.8), mat); body.position.set(0, 0.45, 0); group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.35), mat); head.position.set(0, 0.7, 0.38); group.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.2), surface(THREE, "#1e293b")); snout.position.set(0, 0.65, 0.58); group.add(snout);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.12), mat); earL.position.set(-0.17, 0.72, 0.36);
  const earR = earL.clone(); earR.position.x = 0.17; group.add(earL, earR);
  for (const [lx, lz] of [[-0.18, 0.26], [0.18, 0.26], [-0.18, -0.26], [0.18, -0.26]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6), mat); leg.position.set(lx, 0.22, lz); group.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.3, 5), mat); tail.position.set(0, 0.6, -0.48); tail.rotation.x = -0.7; group.add(tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DCat(THREE, color = "#ea580c") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.6), mat); body.position.set(0, 0.32, 0); group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat); head.position.set(0, 0.46, 0.25); group.add(head);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat); earL.position.set(-0.1, 0.65, 0.24);
  const earR = earL.clone(); earR.position.x = 0.1; group.add(earL, earR);
  for (const [lx, lz] of [[-0.12, 0.18], [0.12, 0.18], [-0.12, -0.18], [0.12, -0.18]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6), mat); leg.position.set(lx, 0.16, lz); group.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 5), mat); tail.position.set(0, 0.45, -0.38); tail.rotation.x = -0.9; group.add(tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DCar(THREE, color = "#dc2626", isTaxi = false) {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const glassMat = surface(THREE, "#38bdf8", { opacity: 0.8, transparent: true });
  const wheelMat = surface(THREE, "#1e293b");
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 3.2), mat); body.position.set(0, 0.5, 0); group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.8), mat); cabin.position.set(0, 1.0, -0.2); group.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.9), glassMat); glass.position.set(0, 1.0, 0.3); group.add(glass);
  for (const [wx, wz] of [[-0.85, 0.9], [0.85, 0.9], [-0.85, -0.9], [0.85, -0.9]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12), wheelMat);
    wheel.position.set(wx, 0.32, wz); wheel.rotation.z = Math.PI / 2; group.add(wheel);
  }
  const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), surface(THREE, "#fef08a", { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 1.5 }));
  lightL.position.set(-0.55, 0.55, 1.6);
  const lightR = lightL.clone(); lightR.position.x = 0.55; group.add(lightL, lightR);
  if (isTaxi) {
    const taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), surface(THREE, "#f59e0b", { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 1.2 }));
    taxiSign.position.set(0, 1.35, -0.2); group.add(taxiSign);
  }
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function build3DScooter(THREE, color = "#2563eb") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const wheelMat = surface(THREE, "#1e293b");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.4), mat); body.position.set(0, 0.45, 0); group.add(body);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), mat); shield.position.set(0, 0.8, 0.6); group.add(shield);
  for (const wz of [0.55, -0.55]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 10), wheelMat);
    wheel.position.set(0, 0.22, wz); wheel.rotation.z = Math.PI / 2; group.add(wheel);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), surface(THREE, "#fef08a", { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.8 }));
  light.position.set(0, 0.95, 0.72); group.add(light);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

/** Commercial passenger jetliner model with swept wings, turbofan engines, cockpit & tailfin. */
export function build3DAirplane(THREE, color = "#f8fafc", liveryColor = "#2563eb") {
  const group = new THREE.Group();
  const bodyMat = surface(THREE, color);
  const liveryMat = surface(THREE, liveryColor);
  const cockpitMat = surface(THREE, "#0f172a");
  const metalMat = surface(THREE, "#64748b");
  const darkMat = surface(THREE, "#1e293b");

  // Streamlined Fuselage (Length ~ 13m)
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 10.5, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  // Aerodynamic Nose Cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 12), bodyMat);
  nose.position.set(0, 0, 6.35);
  nose.rotation.x = Math.PI / 2;
  group.add(nose);

  // Tapered Tailcone
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.22, 2.8, 12), liveryMat);
  tailCone.position.set(0, 0.12, -6.65);
  tailCone.rotation.x = Math.PI / 2;
  group.add(tailCone);

  // Cockpit Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 0.75), cockpitMat);
  windshield.position.set(0, 0.6, 5.8);
  windshield.rotation.x = -0.3;
  group.add(windshield);

  // Passenger Windows
  for (const side of [-0.86, 0.86]) {
    for (let w = -3.5; w <= 3.5; w += 0.8) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.26), cockpitMat);
      win.position.set(side, 0.18, w);
      group.add(win);
    }
  }

  // Swept Wings
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 1.9), bodyMat);
  wingL.position.set(-3.4, -0.18, 0.2);
  wingL.rotation.y = 0.28;
  wingL.rotation.z = 0.08;
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 1.9), bodyMat);
  wingR.position.set(3.4, -0.18, 0.2);
  wingR.rotation.y = -0.28;
  wingR.rotation.z = -0.08;
  group.add(wingL, wingR);

  // Winglets
  const wingletL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.6), liveryMat);
  wingletL.position.set(-6.2, 0.26, -0.7);
  wingletL.rotation.z = -0.2;
  const wingletR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.6), liveryMat);
  wingletR.position.set(6.2, 0.26, -0.7);
  wingletR.rotation.z = 0.2;
  group.add(wingletL, wingletR);

  // Dual Underwing Turbofan Jet Engines
  for (const ex of [-2.2, 2.2]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 1.1), metalMat);
    pylon.position.set(ex, -0.32, 0.4);
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.48, 1.9, 10), bodyMat);
    nacelle.position.set(ex, -0.65, 0.4);
    nacelle.rotation.x = Math.PI / 2;
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), darkMat);
    spinner.position.set(ex, -0.65, 1.4);
    spinner.rotation.x = Math.PI / 2;
    group.add(pylon, nacelle, spinner);
  }

  // Vertical Tailfin with Airline Livery
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 2.1), liveryMat);
  fin.position.set(0, 1.8, -6.1);
  fin.rotation.x = -0.38;
  group.add(fin);

  // Horizontal Tail Stabilizers
  const hStabL = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.0), liveryMat);
  hStabL.position.set(-1.25, 0.35, -7.2);
  hStabL.rotation.y = 0.22;
  const hStabR = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.0), liveryMat);
  hStabR.position.set(1.25, 0.35, -7.2);
  hStabR.rotation.y = -0.22;
  group.add(hStabL, hStabR);

  // Tricycle Landing Gear
  const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), metalMat);
  noseStrut.position.set(0, -0.9, 4.4);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 8), darkMat);
  noseWheel.position.set(0, -1.3, 4.4);
  noseWheel.rotation.z = Math.PI / 2;
  group.add(noseStrut, noseWheel);

  for (const mx of [-1.6, 1.6]) {
    const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), metalMat);
    mainStrut.position.set(mx, -0.9, 0.0);
    const mainWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 8), darkMat);
    mainWheel.position.set(mx, -1.35, 0.0);
    mainWheel.rotation.z = Math.PI / 2;
    group.add(mainStrut, mainWheel);
  }

  // Navigation Wingtip Strobe Lights
  const navPort = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), surface(THREE, "#ef4444", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 2 }));
  navPort.position.set(-6.3, 0.26, -0.7);
  const navStbd = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), surface(THREE, "#22c55e", { emissive: new THREE.Color("#22c55e"), emissiveIntensity: 2 }));
  navStbd.position.set(6.3, 0.26, -0.7);
  group.add(navPort, navStbd);

  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

/** Mountain astronomer with tripod-mounted optical telescope. */
export function build3DAstronomer(THREE, coatColor = "#1e293b") {
  const group = new THREE.Group();
  const mat = surface(THREE, coatColor);
  const skinMat = surface(THREE, "#fed7aa");
  const darkMat = surface(THREE, "#0f172a");

  // Astronomer figure
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.75, 8), mat);
  body.position.set(0, 0.75, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), skinMat);
  head.position.set(0, 1.25, 0);
  const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), surface(THREE, "#ef4444"));
  beanie.position.set(0, 1.32, -0.02);
  group.add(body, head, beanie);

  // Astronomical Telescope on Tripod
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), darkMat);
    leg.position.set(0.55 + Math.cos(angle) * 0.25, 0.6, 0.45 + Math.sin(angle) * 0.25);
    leg.rotation.z = Math.cos(angle) * 0.22;
    leg.rotation.x = Math.sin(angle) * 0.22;
    group.add(leg);
  }
  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), darkMat);
  mount.position.set(0.55, 1.22, 0.45);
  const ota = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8), surface(THREE, "#ffffff"));
  ota.position.set(0.55, 1.38, 0.45);
  ota.rotation.x = 0.55;
  const dewShield = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8), surface(THREE, "#3b82f6"));
  dewShield.position.set(0.55, 1.74, 0.22);
  dewShield.rotation.x = 0.55;
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 6), surface(THREE, "#eab308"));
  eyepiece.position.set(0.55, 1.02, 0.68);
  eyepiece.rotation.x = 0.55;
  group.add(mount, ota, dewShield, eyepiece);

  // Astronomy red headlamp/torch
  const torch = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), surface(THREE, "#ef4444", { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 2 }));
  torch.position.set(0, 1.32, 0.18);
  group.add(torch);

  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

/** Outdoor portrait model in sunny garden dress with sunhat and flower bouquet. */
export function build3DModelPose(THREE, hairColor = "#78350f", dressColor = "#ec4899") {
  const group = new THREE.Group();
  const skinMat = surface(THREE, "#fed7aa");
  const hairMat = surface(THREE, hairColor);
  const dressMat = surface(THREE, dressColor);
  const whiteMat = surface(THREE, "#ffffff");

  // Character body & summer dress
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.65, 8), dressMat);
  body.position.set(0, 0.82, 0);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.6, 8), dressMat);
  skirt.position.set(0, 0.45, 0);
  group.add(body, skirt);

  for (const lx of [-0.08, 0.08]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.48, 6), skinMat);
    leg.position.set(lx, 0.24, 0);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.14), whiteMat);
    shoe.position.set(lx, 0.03, 0.03);
    group.add(leg, shoe);
  }

  // Head & Sunhat
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skinMat);
  head.position.set(0, 1.3, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), hairMat);
  hair.position.set(0, 1.33, -0.04);
  const ponytail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), hairMat);
  ponytail.position.set(0.15, 1.2, -0.16);
  ponytail.rotation.z = -0.3;
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.03, 12), surface(THREE, "#fef08a"));
  hatBrim.position.set(0, 1.42, 0);
  hatBrim.rotation.x = 0.08;
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10), surface(THREE, "#fde047"));
  hatCrown.position.set(0, 1.51, -0.02);
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.04, 10), dressMat);
  ribbon.position.set(0, 1.46, -0.02);
  group.add(head, hair, ponytail, hatBrim, hatCrown, ribbon);

  // Garden flower bouquet in hands
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), surface(THREE, "#15803d"));
  stem.position.set(0.14, 0.8, 0.2);
  stem.rotation.z = 0.2;
  group.add(stem);
  const flowerColors = ["#f43f5e", "#fbbf24", "#c084fc", "#ffffff", "#38bdf8"];
  for (let f = 0; f < 5; f += 1) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), surface(THREE, flowerColors[f]));
    fl.position.set(0.14 + Math.cos(f * 1.2) * 0.07, 0.92 + Math.sin(f * 1.2) * 0.05, 0.2 + Math.sin(f) * 0.05);
    group.add(fl);
  }

  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.subject); });
  group.position.set(0, 0, -6);
  return group;
}

export function contactShadow(THREE, scene, radius, opacity = 0.24, layer = LAYER.far) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));
  mesh.raycast = () => {};
  return put(scene, mesh, layer, [0, 0.02, -6], [-Math.PI / 2, 0, 0]);
}

export function lighting(THREE, scene, world, key) {
  const [sunColor, sunPower, sunAt] = world.sun, [ambientColor, ambientPower] = world.ambient;
  const sun = new THREE.DirectionalLight(new THREE.Color(sunColor), sunPower);
  sun.position.set(sunAt[0], sunAt[1], sunAt[2]);
  sun.layers.enableAll();
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -70;
  sun.shadow.camera.right = sun.shadow.camera.top = 70;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 700;
  sun.shadow.camera.layers.enableAll();
  sun.shadow.bias = -0.00035;
  const ambient = new THREE.AmbientLight(new THREE.Color(ambientColor), ambientPower);
  ambient.layers.enableAll();
  const bounce = new THREE.HemisphereLight(new THREE.Color(world.sky[0]), new THREE.Color(world.sky[1]), 0.35);
  bounce.layers.enableAll();
  scene.add(sun, ambient, bounce);
  if (key !== "night" && key !== "starry" && key !== "city_night") {
    // The sun is world geometry, not a backdrop: its position is collinear with
    // the DirectionalLight so the visible source, illumination and shadows agree.
    const sourcePosition = new THREE.Vector3(sunAt[0], sunAt[1], sunAt[2]).normalize().multiplyScalar(900);
    const visibleSun = new THREE.Mesh(new THREE.SphereGeometry(24, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(sunColor) }));
    visibleSun.layers.set(LAYER.far);
    visibleSun.position.copy(sourcePosition);
    visibleSun.userData.lightSource = "sun";
    visibleSun.userData.isCelestial = true;
    // The sun is a celestial object: an AF frame over it means infinity.
    visibleSun.raycast = () => {};
    scene.userData.meteringEmitter = visibleSun;
    scene.add(visibleSun);
  }
  return sun;
}

export function cylinder(THREE, scene, radiusTop, radiusBottom, height, color, position, layer, { rotation, ...material } = {}, radialSegments = 8) {
  return put(scene, new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), surface(THREE, color, material)), layer, position, rotation);
}

export function sphere(THREE, scene, radius, color, position, layer, { rotation, ...material } = {}, widthSegments = 10, heightSegments = 8) {
  return put(scene, new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), surface(THREE, color, material)), layer, position, rotation);
}

export function fence(THREE, scene, [x1, z1], [x2, z2], height, color, layer, postSpacing = 2.5) {
  const dx = x2 - x1, dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  const angle = Math.atan2(dx, dz);
  const posts = Math.max(2, Math.ceil(dist / postSpacing));
  for (let i = 0; i < posts; i += 1) {
    const t = i / (posts - 1);
    cylinder(THREE, scene, 0.08, 0.08, height, color, [x1 + dx * t, height / 2, z1 + dz * t], layer);
  }
  block(THREE, scene, [0.06, 0.08, dist], color, [(x1 + x2) / 2, height * 0.75, (z1 + z2) / 2], layer, { rotation: [0, angle, 0] });
  block(THREE, scene, [0.06, 0.08, dist], color, [(x1 + x2) / 2, height * 0.35, (z1 + z2) / 2], layer, { rotation: [0, angle, 0] });
}

/** Street furniture reused by the plaza, street and neon-rain scenes. */
export function streetLamp(THREE, scene, [x, z], layer, { height = 6.2, pole = "#414954", glow = null, arm = 1.1 } = {}) {
  cylinder(THREE, scene, 0.11, 0.16, height, pole, [x, height / 2, z], layer);
  cylinder(THREE, scene, 0.07, 0.07, arm, pole, [x + arm / 2 * Math.sign(arm || 1), height, z], layer, { rotation: [0, 0, Math.PI / 2] });
  const headX = x + arm * Math.sign(arm || 1);
  if (glow) {
    block(THREE, scene, [0.5, 0.16, 0.34], glow, [headX, height - 0.1, z], layer, { emissive: new THREE.Color(glow), emissiveIntensity: 2.2 });
  } else {
    block(THREE, scene, [0.5, 0.16, 0.34], "#e2e8f0", [headX, height - 0.1, z], layer);
  }
  return headX;
}

/** Warm cone of light under a lamp head, rendered as a decal so AF ignores it. */
export function lightCone(THREE, scene, [x, y, z], layer, color = "#ffd68a", radius = 2.4, height = 5.6, opacity = 0.09) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 12, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  }));
  cone.raycast = () => {};
  return put(scene, cone, layer, [x, y - height / 2, z], [Math.PI, 0, 0]);
}

/** Emissive puddle / reflection decal. Never blocks autofocus. */
export function glowDecal(THREE, scene, [x, y, z], layer, color = "#4fd1ff", radiusX = 1.6, radiusZ = 0.9, opacity = 0.32) {
  const decal = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity, depthWrite: false,
  }));
  decal.scale.set(radiusX, radiusZ, 1);
  decal.raycast = () => {};
  return put(scene, decal, layer, [x, y, z], [-Math.PI / 2, 0, 0]);
}

/** Park bench: slatted seat, back rest and two cast legs. */
export function bench(THREE, scene, [x, z], layer, { spin = 0, seat = "#8b5a34", leg = "#4b5563" } = {}) {
  block(THREE, scene, [1.8, 0.09, 0.52], seat, [x, 0.45, z], layer, { rotation: [0, spin, 0] });
  block(THREE, scene, [1.8, 0.46, 0.09], seat, [x - Math.sin(spin) * 0.26, 0.72, z - Math.cos(spin) * 0.26], layer, { rotation: [0, spin, 0] });
  for (const offset of [-0.72, 0.72]) {
    block(THREE, scene, [0.1, 0.45, 0.46], leg, [x + Math.cos(spin) * offset, 0.22, z - Math.sin(spin) * offset], layer, { rotation: [0, spin, 0] });
  }
}

/** Clipped hedge run, used to frame plazas and garden terraces. */
export function hedge(THREE, scene, [x1, z1], [x2, z2], layer, { height = 0.9, width = 0.8, color = "#3f6b39" } = {}) {
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  block(THREE, scene, [width, height, length], color, [(x1 + x2) / 2, height / 2, (z1 + z2) / 2], layer, { rotation: [0, Math.atan2(dx, dz), 0] });
}

/** Scattered wildflower or shrub cluster; cheap colour to break up flat ground. */
export function flowerPatch(THREE, scene, [x, z], layer, next, { spread = 1.6, count = 9, colors = ["#f472b6", "#fbbf24", "#f8fafc", "#a78bfa"] } = {}) {
  for (let index = 0; index < count; index += 1) {
    const fx = x + (next() - 0.5) * spread, fz = z + (next() - 0.5) * spread;
    cylinder(THREE, scene, 0.012, 0.012, 0.22, "#4d7c3a", [fx, 0.11, fz], layer, {}, 4);
    sphere(THREE, scene, 0.055 + next() * 0.035, colors[Math.floor(next() * colors.length) % colors.length], [fx, 0.24, fz], layer, {}, 6, 5);
  }
}

/** Angular boulder, a cheap way to give shorelines and ridges some silhouette. */
export function boulder(THREE, scene, [x, y, z], layer, radius, next, color = "#8d8578") {
  const rock = put(scene, new THREE.Mesh(new THREE.DodecahedronGeometry(radius), surface(THREE, color)), layer, [x, y, z], [next(), next() * 3, next()]);
  rock.scale.set(1, 0.7 + next() * 0.4, 1);
  return rock;
}

export function build3DRestingDeer(THREE, color = "#b45309") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const darkMat = surface(THREE, "#78350f");
  const whiteMat = surface(THREE, "#ffffff");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 1.2), mat);
  body.position.set(0, 0.35, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 6), mat);
  neck.position.set(0, 0.75, 0.4);
  neck.rotation.x = 0.4;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.45), mat);
  head.position.set(0, 0.98, 0.58);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.22), darkMat);
  snout.position.set(0, 0.92, 0.85);
  const antL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.45, 5), darkMat);
  antL.position.set(-0.12, 1.25, 0.52); antL.rotation.z = -0.3;
  const antR = antL.clone(); antR.position.x = 0.12; antR.rotation.z = 0.3;
  const legFoldF = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.4), mat);
  legFoldF.position.set(0, 0.1, 0.35);
  const legFoldB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.45), mat);
  legFoldB.position.set(0, 0.11, -0.35);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.12), whiteMat);
  tail.position.set(0, 0.45, -0.62);
  group.add(body, neck, head, snout, antL, antR, legFoldF, legFoldB, tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DGrazingDeer(THREE, color = "#92400e") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const darkMat = surface(THREE, "#78350f");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.65, 1.25), mat);
  body.position.set(0, 0.68, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 6), mat);
  neck.position.set(0, 0.5, 0.55);
  neck.rotation.x = 1.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.45), mat);
  head.position.set(0, 0.28, 0.88);
  head.rotation.x = 0.4;
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.22), darkMat);
  snout.position.set(0, 0.18, 1.1);
  for (const [lx, lz] of [[-0.24, 0.38], [0.24, 0.38], [-0.24, -0.38], [0.24, -0.38]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.68, 6), mat);
    leg.position.set(lx, 0.34, lz);
    group.add(leg);
  }
  group.add(body, neck, head, snout);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DStandingHeron(THREE, bodyColor = "#f8fafc", beakColor = "#f59e0b") {
  const group = new THREE.Group();
  const mat = surface(THREE, bodyColor);
  const beakMat = surface(THREE, beakColor);
  const legMat = surface(THREE, "#475569");
  for (const lx of [-0.07, 0.07]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 5), legMat);
    leg.position.set(lx, 0.375, 0);
    group.add(leg);
  }
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 6), mat);
  body.position.set(0, 0.85, 0);
  body.rotation.x = 0.3;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.55, 6), mat);
  neck.position.set(0, 1.2, 0.12);
  neck.rotation.x = -0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat);
  head.position.set(0, 1.48, 0.08);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.35, 4), beakMat);
  beak.position.set(0, 1.48, 0.3);
  beak.rotation.x = Math.PI / 2;
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.18, 4), surface(THREE, "#1e293b"));
  crest.position.set(0, 1.52, -0.06);
  crest.rotation.x = -0.8;
  group.add(body, neck, head, beak, crest);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DFloatingDuck(THREE, headColor = "#15803d", bodyColor = "#78350f") {
  const group = new THREE.Group();
  const bodyMat = surface(THREE, bodyColor);
  const headMat = surface(THREE, headColor);
  const beakMat = surface(THREE, "#f59e0b");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), bodyMat);
  body.scale.set(1, 0.65, 1.5);
  body.position.set(0, 0.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), headMat);
  head.position.set(0, 0.28, 0.22);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.14), beakMat);
  beak.position.set(0, 0.26, 0.36);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), bodyMat);
  tail.position.set(0, 0.2, -0.36);
  tail.rotation.x = -0.7;
  group.add(body, head, beak, tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DPerchedBird(THREE, color = "#3b82f6", beakColor = "#f59e0b") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const beakMat = surface(THREE, beakColor);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat);
  body.scale.set(0.9, 1.1, 1.3);
  body.position.set(0, 0.14, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat);
  head.position.set(0, 0.25, 0.08);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), beakMat);
  beak.position.set(0, 0.24, 0.18);
  beak.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.22), mat);
  tail.position.set(0, 0.1, -0.18);
  tail.rotation.x = 0.5;
  const feet = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.08), surface(THREE, "#f59e0b"));
  feet.position.set(0, 0.02, 0);
  group.add(body, head, beak, tail, feet);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DSleepingCat(THREE, color = "#ea580c") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.09, 6, 12, Math.PI * 1.8), mat);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.09, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat);
  head.position.set(0.14, 0.1, 0.12);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), mat);
  earL.position.set(0.12, 0.2, 0.14);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), mat);
  earR.position.set(0.18, 0.19, 0.08);
  group.add(body, head, earL, earR);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DSittingCat(THREE, color = "#334155") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 8), mat);
  body.position.set(0, 0.225, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
  head.position.set(0, 0.48, 0.04);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat);
  earL.position.set(-0.07, 0.6, 0.03);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), mat);
  earR.position.set(0.07, 0.6, 0.03);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), mat);
  tail.position.set(0.12, 0.06, 0.05);
  tail.rotation.x = Math.PI / 2;
  tail.rotation.z = -0.4;
  group.add(body, head, earL, earR, tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DSittingDog(THREE, color = "#d97706") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const darkMat = surface(THREE, "#1e293b");
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 8), mat);
  body.position.set(0, 0.3, 0);
  body.rotation.x = -0.15;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.26), mat);
  head.position.set(0, 0.65, 0.12);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.16), darkMat);
  snout.position.set(0, 0.6, 0.28);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat);
  earL.position.set(-0.1, 0.78, 0.08);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 4), mat);
  earR.position.set(0.1, 0.78, 0.08);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.3, 5), mat);
  tail.position.set(0, 0.2, -0.22);
  tail.rotation.x = -0.8;
  group.add(body, head, snout, earL, earR, tail);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DLyingDog(THREE, color = "#f59e0b") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const darkMat = surface(THREE, "#1e293b");
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.75), mat);
  body.position.set(0, 0.18, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.26), mat);
  head.position.set(0, 0.34, 0.38);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), darkMat);
  snout.position.set(0, 0.28, 0.52);
  const paws = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.25), mat);
  paws.position.set(0, 0.05, 0.42);
  group.add(body, head, snout, paws);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DTurtle(THREE, shellColor = "#365314") {
  const group = new THREE.Group();
  const shellMat = surface(THREE, shellColor);
  const skinMat = surface(THREE, "#65a30d");
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), shellMat);
  shell.scale.set(1, 0.6, 1.3);
  shell.position.set(0, 0.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), skinMat);
  head.position.set(0, 0.14, 0.32);
  for (const [lx, lz] of [[-0.2, 0.15], [0.2, 0.15], [-0.18, -0.18], [0.18, -0.18]]) {
    const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.14), skinMat);
    flipper.position.set(lx, 0.04, lz);
    group.add(flipper);
  }
  group.add(shell, head);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

export function build3DSquirrel(THREE, color = "#c2410c") {
  const group = new THREE.Group();
  const mat = surface(THREE, color);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat);
  body.scale.set(0.9, 1.2, 1.0);
  body.position.set(0, 0.18, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
  head.position.set(0, 0.34, 0.08);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.05, 0.45, 6), mat);
  tail.position.set(0, 0.32, -0.18);
  tail.rotation.x = 0.8;
  const acorn = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), surface(THREE, "#78350f"));
  acorn.position.set(0, 0.22, 0.14);
  group.add(body, head, tail, acorn);
  group.traverse(o => { if (o.isMesh) o.layers.set(LAYER.far); });
  return group;
}

function finishAnimal(group, species, behavior, layer = LAYER.far) {
  group.name = `animal:${species}`;
  group.userData.species = species;
  group.userData.behavior = behavior;
  group.traverse(object => { if (object.isMesh) object.layers.set(layer); });
  return group;
}

/** Alert fox with a white chest, pointed ears, and a long tipped brush. */
export function build3DFox(THREE, color = "#ea580c", layer = LAYER.far) {
  const group = new THREE.Group();
  const fur = surface(THREE, color), dark = surface(THREE, "#3f2a1d"), white = surface(THREE, "#f8fafc");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), fur);
  body.scale.set(0.85, 0.7, 1.35); body.position.set(0, 0.29, -0.04);
  const chest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 6), white);
  chest.position.set(0, 0.35, 0.2); chest.rotation.x = -0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fur);
  head.position.set(0, 0.57, 0.24);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.25, 6), white);
  snout.position.set(0, 0.53, 0.43); snout.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dark);
  nose.position.set(0, 0.53, 0.56);
  for (const x of [-0.09, 0.09]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.18, 5), dark);
    ear.position.set(x, 0.76, 0.22); group.add(ear);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 5), fur);
    leg.position.set(x * 0.72, 0.15, 0.18); group.add(leg);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.055, 0.64, 7), fur);
  tail.position.set(0.08, 0.29, -0.38); tail.rotation.x = -1.05; tail.rotation.z = -0.18;
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), white);
  tailTip.position.set(0.12, 0.12, -0.68);
  group.add(body, chest, head, snout, nose, tail, tailTip);
  return finishAnimal(group, "fox", "alert-sit", layer);
}

/** Low foraging hedgehog; the faceted shell reads as quills without dense geometry. */
export function build3DHedgehog(THREE, color = "#57534e", layer = LAYER.far) {
  const group = new THREE.Group();
  const quills = surface(THREE, color), faceMat = surface(THREE, "#a16207"), dark = surface(THREE, "#1c1917");
  const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25), quills);
  shell.scale.set(1, 0.72, 1.3); shell.position.set(0, 0.2, -0.05);
  const face = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), faceMat);
  face.position.set(0, 0.15, 0.28); face.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), dark);
  nose.position.set(0, 0.15, 0.43);
  for (const x of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), dark);
    eye.position.set(x, 0.22, 0.3); group.add(eye);
  }
  group.add(shell, face, nose);
  return finishAnimal(group, "hedgehog", "foraging", layer);
}

/** Crouched pond frog with raised eyes and broad swimming feet. */
export function build3DFrog(THREE, color = "#4d7c0f", layer = LAYER.far) {
  const group = new THREE.Group();
  const skin = surface(THREE, color), eyeMat = surface(THREE, "#facc15"), pupilMat = surface(THREE, "#172554");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), skin);
  body.scale.set(1.2, 0.55, 1); body.position.set(0, 0.09, -0.02);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), skin);
  head.scale.set(1.18, 0.65, 0.9); head.position.set(0, 0.17, 0.12);
  for (const x of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat);
    eye.position.set(x, 0.26, 0.15);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), pupilMat);
    pupil.position.set(x, 0.27, 0.19);
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), skin);
    leg.scale.set(1.35, 0.34, 0.78); leg.position.set(x * 1.8, 0.055, -0.06);
    group.add(eye, pupil, leg);
  }
  group.add(body, head);
  return finishAnimal(group, "frog", "crouching", layer);
}

/** Floating swan with folded wings and an upright curved-neck silhouette. */
export function build3DSwan(THREE, color = "#f8fafc", layer = LAYER.far) {
  const group = new THREE.Group();
  const feather = surface(THREE, color), beakMat = surface(THREE, "#f97316"), dark = surface(THREE, "#111827");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 9, 7), feather);
  body.scale.set(0.9, 0.55, 1.5); body.position.set(0, 0.16, -0.02);
  for (const x of [-0.17, 0.17]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), feather);
    wing.scale.set(0.55, 0.3, 1.25); wing.position.set(x, 0.24, -0.05); group.add(wing);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.075, 0.5, 7), feather);
  neck.position.set(0, 0.45, 0.24); neck.rotation.x = -0.18;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), feather);
  head.position.set(0, 0.7, 0.29);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), beakMat);
  beak.position.set(0, 0.68, 0.42); beak.rotation.x = Math.PI / 2;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.03), dark);
  mask.position.set(0, 0.7, 0.37);
  group.add(body, neck, head, beak, mask);
  return finishAnimal(group, "swan", "floating", layer);
}

/** Urban raccoon rummaging on its haunches, with face mask and ringed tail. */
export function build3DRaccoon(THREE, color = "#64748b", layer = LAYER.far) {
  const group = new THREE.Group();
  const fur = surface(THREE, color), dark = surface(THREE, "#1f2937"), light = surface(THREE, "#cbd5e1");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), fur);
  body.scale.set(0.85, 1.15, 0.9); body.position.set(0, 0.28, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), light);
  head.position.set(0, 0.52, 0.12);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.075, 0.045), dark);
  mask.position.set(0, 0.54, 0.245);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), dark);
  snout.scale.set(0.75, 0.6, 1); snout.position.set(0, 0.47, 0.28);
  for (const x of [-0.09, 0.09]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 5), dark);
    ear.position.set(x, 0.68, 0.08);
    const paw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.24, 5), dark);
    paw.position.set(x * 0.7, 0.18, 0.14); group.add(ear, paw);
  }
  const tail = new THREE.Group();
  for (let segment = 0; segment < 5; segment += 1) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.075 - segment * 0.009, 0.085 - segment * 0.009, 0.13, 7), segment % 2 ? light : dark);
    ring.position.y = segment * 0.12; tail.add(ring);
  }
  tail.position.set(0.08, 0.11, -0.22); tail.rotation.x = -1.05; tail.rotation.z = -0.18;
  group.add(body, head, mask, snout, tail);
  return finishAnimal(group, "raccoon", "rummaging", layer);
}

/** Small bat with a real two-triangle wing silhouette instead of a bird recolour. */
export function build3DBat(THREE, color = "#312e81", layer = LAYER.far) {
  const group = new THREE.Group();
  const fur = surface(THREE, color), wingMat = surface(THREE, color, { side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), fur);
  body.scale.set(0.72, 1.3, 0.8); body.position.set(0, 0.22, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), fur);
  head.position.set(0, 0.36, 0.02);
  for (const x of [-0.045, 0.045]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 4), fur);
    ear.position.set(x, 0.46, 0.02); group.add(ear);
  }
  for (const side of [-1, 1]) {
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      0, 0.34, 0,
      side * 0.48, 0.27, 0,
      side * 0.35, 0.02, 0,
      side * 0.13, 0.14, 0,
    ]), 3));
    wingGeometry.setIndex([0, 1, 2, 0, 2, 3]);
    wingGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(wingGeometry, wingMat));
  }
  group.add(body, head);
  return finishAnimal(group, "bat", "gliding", layer);
}

function build3DSmallRodent(THREE, { color, species, tail, layer }) {
  const group = new THREE.Group();
  const fur = surface(THREE, color), pale = surface(THREE, "#f5d0a9"), dark = surface(THREE, "#1c1917");
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), fur);
  body.scale.set(0.9, 0.8, 1.25); body.position.set(0, 0.1, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), fur);
  head.position.set(0, 0.15, 0.13);
  for (const x of [-0.065, 0.065]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), pale);
    ear.scale.set(1, 0.45, 1); ear.position.set(x, 0.23, 0.1);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), dark);
    eye.position.set(x * 0.7, 0.18, 0.205); group.add(ear, eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), dark);
  nose.position.set(0, 0.14, 0.23);
  group.add(body, head, nose);
  if (tail) {
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.42, 5), pale);
    tailMesh.position.set(0.03, 0.095, -0.22); tailMesh.rotation.x = -1.18; tailMesh.rotation.z = -0.35; group.add(tailMesh);
  } else {
    for (const x of [-0.075, 0.075]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), pale);
      cheek.position.set(x, 0.12, 0.18); group.add(cheek);
    }
  }
  return finishAnimal(group, species, tail ? "scurrying" : "snacking", layer);
}

export function build3DRat(THREE, color = "#78716c", layer = LAYER.far) {
  return build3DSmallRodent(THREE, { color, species: "rat", tail: true, layer });
}

export function build3DHamster(THREE, color = "#d97706", layer = LAYER.far) {
  return build3DSmallRodent(THREE, { color, species: "hamster", tail: false, layer });
}
