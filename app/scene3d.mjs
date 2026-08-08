import { LAYER, WORLD } from "./world.mjs";

/**
 * Builds the eleven playable worlds as real 3D geometry. `THREE` is passed in so
 * this module never pulls the renderer into the server bundle.
 *
 * Every mesh is assigned to a depth bucket (`LAYER.far` / `LAYER.subject` /
 * `LAYER.near`) so a capture can blur each band by its own circle of confusion.
 */

/** A proper flock gives the wildlife scene multiple targets to track. */
export const BIRD_COUNT = 7;

const rand = seed => { let value = seed; return () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648; };

function surface(THREE, color, options = {}) { return new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: true, ...options }); }

function put(scene, object, layer, position, rotation) {
  object.layers.set(layer);
  if (position) object.position.set(position[0], position[1], position[2]);
  if (rotation) object.rotation.set(rotation[0], rotation[1], rotation[2]);
  scene.add(object);
  return object;
}

function block(THREE, scene, size, color, position, layer, { rotation, ...material } = {}) {
  return put(scene, new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), surface(THREE, color, material)), layer, position, rotation);
}

function slab(THREE, scene, width, depth, color, position, layer, { spin = 0, ...material } = {}) {
  return put(scene, new THREE.Mesh(new THREE.PlaneGeometry(width, depth), surface(THREE, color, { side: THREE.DoubleSide, ...material })), layer, position, [-Math.PI / 2, 0, spin]);
}

function peak(THREE, scene, radius, height, color, position, layer, segments = 5) {
  return put(scene, new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), surface(THREE, color)), layer, position);
}

function tree(THREE, scene, position, layer, scale = 1, leaf = "#43703f", trunk = "#5b422f") {
  put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.22 * scale, 1.5 * scale, 6), surface(THREE, trunk)), layer, [position[0], position[1] + 0.75 * scale, position[2]]);
  for (let tier = 0; tier < 3; tier += 1) {
    put(scene, new THREE.Mesh(new THREE.ConeGeometry((1.15 - tier * 0.28) * scale, (1.5 - tier * 0.22) * scale, 6), surface(THREE, leaf)), layer, [position[0], position[1] + (1.55 + tier * 0.78) * scale, position[2]]);
  }
}

/** Procedural facade texture: far cheaper than modelling every window. */
function facadeTexture(THREE, { base, frame, glass, lit = 0, columns = 6, rows = 12, seed = 7 }) {
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
function facadeBlock(THREE, scene, size, position, layer, texture, tint = "#ffffff", glow, repeat) {
  const material = new THREE.MeshLambertMaterial({ map: texture.clone(), color: new THREE.Color(tint) });
  material.map.needsUpdate = true;
  if (glow) { material.emissive = new THREE.Color(glow); material.emissiveMap = material.map; material.emissiveIntensity = 1.1; }
  material.map.repeat.set(...(repeat ?? [Math.max(1, Math.round(size[0] / 4)), Math.max(1, Math.round(size[1] / 4))]));
  return put(scene, new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material), layer, position);
}

function skyDome(THREE, scene, [top, bottom]) {
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
  return put(scene, dome, LAYER.far, [0, 0, 0]);
}

/**
 * Limb rotations per stance, in radians about the local X axis.
 * The figure faces local +Z, so a negative hip angle swings that leg forward.
 */
const HUMAN_POSES = {
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
function build3DHuman(THREE, options = {}) {
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

function build3DDeer(THREE, color = "#b45309") {
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

function build3DBird(THREE, color = "#475569") {
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

function build3DBunny(THREE, color = "#ffffff") {
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

function build3DDog(THREE, color = "#d97706") {
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

function build3DCat(THREE, color = "#ea580c") {
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

function build3DCar(THREE, color = "#dc2626", isTaxi = false) {
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

function build3DScooter(THREE, color = "#2563eb") {
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
function build3DAirplane(THREE, color = "#f8fafc", liveryColor = "#2563eb") {
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
function build3DAstronomer(THREE, coatColor = "#1e293b") {
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
function build3DModelPose(THREE, hairColor = "#78350f", dressColor = "#ec4899") {
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

function contactShadow(THREE, scene, radius, opacity = 0.24, layer = LAYER.far) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));
  mesh.raycast = () => {};
  return put(scene, mesh, layer, [0, 0.02, -6], [-Math.PI / 2, 0, 0]);
}

function lighting(THREE, scene, world, key) {
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

function cylinder(THREE, scene, radiusTop, radiusBottom, height, color, position, layer, { rotation, ...material } = {}, radialSegments = 8) {
  return put(scene, new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), surface(THREE, color, material)), layer, position, rotation);
}

function sphere(THREE, scene, radius, color, position, layer, { rotation, ...material } = {}, widthSegments = 10, heightSegments = 8) {
  return put(scene, new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, heightSegments), surface(THREE, color, material)), layer, position, rotation);
}

function fence(THREE, scene, [x1, z1], [x2, z2], height, color, layer, postSpacing = 2.5) {
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
function streetLamp(THREE, scene, [x, z], layer, { height = 6.2, pole = "#414954", glow = null, arm = 1.1 } = {}) {
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
function lightCone(THREE, scene, [x, y, z], layer, color = "#ffd68a", radius = 2.4, height = 5.6, opacity = 0.09) {
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 12, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  }));
  cone.raycast = () => {};
  return put(scene, cone, layer, [x, y - height / 2, z], [Math.PI, 0, 0]);
}

/** Emissive puddle / reflection decal. Never blocks autofocus. */
function glowDecal(THREE, scene, [x, y, z], layer, color = "#4fd1ff", radiusX = 1.6, radiusZ = 0.9, opacity = 0.32) {
  const decal = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity, depthWrite: false,
  }));
  decal.scale.set(radiusX, radiusZ, 1);
  decal.raycast = () => {};
  return put(scene, decal, layer, [x, y, z], [-Math.PI / 2, 0, 0]);
}

/** Park bench: slatted seat, back rest and two cast legs. */
function bench(THREE, scene, [x, z], layer, { spin = 0, seat = "#8b5a34", leg = "#4b5563" } = {}) {
  block(THREE, scene, [1.8, 0.09, 0.52], seat, [x, 0.45, z], layer, { rotation: [0, spin, 0] });
  block(THREE, scene, [1.8, 0.46, 0.09], seat, [x - Math.sin(spin) * 0.26, 0.72, z - Math.cos(spin) * 0.26], layer, { rotation: [0, spin, 0] });
  for (const offset of [-0.72, 0.72]) {
    block(THREE, scene, [0.1, 0.45, 0.46], leg, [x + Math.cos(spin) * offset, 0.22, z - Math.sin(spin) * offset], layer, { rotation: [0, spin, 0] });
  }
}

/** Clipped hedge run, used to frame plazas and garden terraces. */
function hedge(THREE, scene, [x1, z1], [x2, z2], layer, { height = 0.9, width = 0.8, color = "#3f6b39" } = {}) {
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  block(THREE, scene, [width, height, length], color, [(x1 + x2) / 2, height / 2, (z1 + z2) / 2], layer, { rotation: [0, Math.atan2(dx, dz), 0] });
}

/** Scattered wildflower or shrub cluster; cheap colour to break up flat ground. */
function flowerPatch(THREE, scene, [x, z], layer, next, { spread = 1.6, count = 9, colors = ["#f472b6", "#fbbf24", "#f8fafc", "#a78bfa"] } = {}) {
  for (let index = 0; index < count; index += 1) {
    const fx = x + (next() - 0.5) * spread, fz = z + (next() - 0.5) * spread;
    cylinder(THREE, scene, 0.012, 0.012, 0.22, "#4d7c3a", [fx, 0.11, fz], layer, {}, 4);
    sphere(THREE, scene, 0.055 + next() * 0.035, colors[Math.floor(next() * colors.length) % colors.length], [fx, 0.24, fz], layer, {}, 6, 5);
  }
}

/** Angular boulder, a cheap way to give shorelines and ridges some silhouette. */
function boulder(THREE, scene, [x, y, z], layer, radius, next, color = "#8d8578") {
  const rock = put(scene, new THREE.Mesh(new THREE.DodecahedronGeometry(radius), surface(THREE, color)), layer, [x, y, z], [next(), next() * 3, next()]);
  rock.scale.set(1, 0.7 + next() * 0.4, 1);
  return rock;
}

function build3DRestingDeer(THREE, color = "#b45309") {
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

function build3DGrazingDeer(THREE, color = "#92400e") {
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

function build3DStandingHeron(THREE, bodyColor = "#f8fafc", beakColor = "#f59e0b") {
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

function build3DFloatingDuck(THREE, headColor = "#15803d", bodyColor = "#78350f") {
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

function build3DPerchedBird(THREE, color = "#3b82f6", beakColor = "#f59e0b") {
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

function build3DSleepingCat(THREE, color = "#ea580c") {
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

function build3DSittingCat(THREE, color = "#334155") {
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

function build3DSittingDog(THREE, color = "#d97706") {
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

function build3DLyingDog(THREE, color = "#f59e0b") {
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

function build3DTurtle(THREE, shellColor = "#365314") {
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

function build3DSquirrel(THREE, color = "#c2410c") {
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

const BUILDERS = {
  landscape(THREE, scene) {
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

    // A camper by the tent gives the valley a sense of scale.
    const camper = build3DHuman(THREE, { pose: "stand", top: "#dc2626", bottom: "#1f2937", hair: "#3f2a1b", hat: "#0f766e", layer: LAYER.far, prop: "camera" });
    put(scene, camper, LAYER.far, [-6.2, 0.02, -20.4], [0, 2.5, 0]);
    contactShadow(THREE, scene, 0.32).position.set(-6.2, 0.02, -20.4);

    return {};
  },

  bird(THREE, scene) {
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

    return {};
  },

  sports(THREE, scene) {
    const stand = rand(17);
    slab(THREE, scene, 900, 900, "#4d8049", [0, -0.02, -60], LAYER.far);

    // A real athletics oval. Every band is a ring stretched twice as wide as it
    // is deep, which is also exactly the ellipse the runners' lane routes trace,
    // so an athlete always has concrete under both feet on the bends.
    // The tripod is up in the near grandstand, so the track sits far enough back
    // that looking down at it stays a comfortable angle.
    const TRACK_CENTRE = -32.5, LANE_WIDTH = 1.6, INNER_RADIUS = 11.2;
    const TRACK_EDGE = TRACK_CENTRE + INNER_RADIUS + LANE_WIDTH * 8 + 1.4;
    const ovalBand = (inner, outer, color, y, material = {}) => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), surface(THREE, color, { side: THREE.DoubleSide, ...material }));
      mesh.scale.set(2, 1, 1);
      return put(scene, mesh, LAYER.far, [0, y, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);
    };
    const ovalDisc = (radius, color, y, material = {}) => {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), surface(THREE, color, { side: THREE.DoubleSide, ...material }));
      mesh.scale.set(2, 1, 1);
      return put(scene, mesh, LAYER.far, [0, y, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);
    };
    ovalBand(INNER_RADIUS - 1.0, INNER_RADIUS + LANE_WIDTH * 8 + 1.4, "#c76a4b", 0.01);
    ovalDisc(INNER_RADIUS - 0.6, "#5b9350", 0.012);
    for (let line = 0; line <= 8; line += 1) {
      const r = INNER_RADIUS + line * LANE_WIDTH;
      ovalBand(r - 0.06, r + 0.06, "#f4f1e8", 0.03);
    }
    ovalBand(INNER_RADIUS - 1.0, INNER_RADIUS - 0.85, "#f8fafc", 0.03);
    // Football pitch inside the oval, with its own markings.
    ovalDisc(INNER_RADIUS - 2.6, "#4d8f45", 0.014);
    slab(THREE, scene, 0.24, 18, "#eef2e6", [0, 0.02, TRACK_CENTRE], LAYER.far);
    const centreCircle = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.05, 48), surface(THREE, "#eef2e6", { side: THREE.DoubleSide }));
    put(scene, centreCircle, LAYER.far, [0, 0.02, TRACK_CENTRE], [-Math.PI / 2, 0, 0]);

    // The near apex is where the field sweeps closest to the tripod, so nothing
    // tall is allowed to stand there: only paint. Staggered start marks per lane.
    for (let lane = 0; lane < 8; lane += 1) {
      const mz = TRACK_CENTRE + INNER_RADIUS + LANE_WIDTH * (lane + 0.5);
      slab(THREE, scene, 0.26, LANE_WIDTH * 0.9, "#f4f1e8", [1.0 + lane * 1.4, 0.04, mz], LAYER.far);
      slab(THREE, scene, 0.5, 0.5, "#f8fafc", [2.2 + lane * 1.4, 0.04, mz], LAYER.far);
    }

    // Finish line, gantry, sponsor banner and timing beams sit on the western
    // straight, off to the side, so nothing tall ever stands on the sight line
    // down the middle of the track.
    const finishX = -(INNER_RADIUS + LANE_WIDTH * 4) * 2;
    slab(THREE, scene, LANE_WIDTH * 16, 0.42, "#f8fafc", [finishX, 0.04, TRACK_CENTRE], LAYER.far);
    for (const gx of [finishX + 14.4, finishX - 14.4]) {
      cylinder(THREE, scene, 0.24, 0.3, 7.2, "#cbd5e1", [gx, 3.6, TRACK_CENTRE], LAYER.far, {}, 8);
      block(THREE, scene, [0.9, 0.16, 0.9], "#94a3b8", [gx, 0.08, TRACK_CENTRE], LAYER.far);
      block(THREE, scene, [0.3, 0.24, 0.24], "#0f172a", [gx > finishX ? gx - 0.5 : gx + 0.5, 1.15, TRACK_CENTRE], LAYER.far);
    }
    block(THREE, scene, [30.0, 0.5, 0.6], "#cbd5e1", [finishX, 7.1, TRACK_CENTRE], LAYER.far);
    block(THREE, scene, [27.6, 1.9, 0.22], "#dc2626", [finishX, 6.0, TRACK_CENTRE + 0.1], LAYER.far);
    block(THREE, scene, [22.8, 0.9, 0.06], "#f8fafc", [finishX, 6.0, TRACK_CENTRE + 0.25], LAYER.far);
    block(THREE, scene, [27.6, 0.34, 0.3], "#facc15", [finishX, 4.95, TRACK_CENTRE + 0.1], LAYER.far);
    const finishZ = TRACK_CENTRE;
    // Spare starting blocks stacked in the infield, out of everyone's way.
    for (let spare = 0; spare < 4; spare += 1) {
      block(THREE, scene, [1.1, 0.09, 0.42], "#e2e8f0", [-6 + spare * 1.4, 0.06 + spare * 0.02, TRACK_CENTRE - 7], LAYER.far);
      block(THREE, scene, [0.16, 0.3, 0.52], "#1d4ed8", [-6.3 + spare * 1.4, 0.2, TRACK_CENTRE - 7], LAYER.far, { rotation: [0, 0, 0.5] });
    }

    // Far grandstand across the track: rake, seat bands, tunnels, cantilever roof.
    {
      const standZ = TRACK_CENTRE - 34;
      for (let tier = 0; tier < 12; tier += 1) {
        const z = standZ - tier * 1.6;
        block(THREE, scene, [176, 1.0 + tier * 0.9, 1.6], "#5b6577", [0, (1.0 + tier * 0.9) / 2, z], LAYER.far);
        for (let bay = 0; bay < 22; bay += 1) {
          const roll = (bay + tier + Math.floor(stand() * 3)) % 5;
          const seatColor = roll < 2 ? "#dc2626" : roll < 4 ? "#1d4ed8" : "#f1f5f9";
          block(THREE, scene, [7.2, 0.34, 1.44], seatColor, [-84 + bay * 8, 1.05 + tier * 0.9, z], LAYER.far);
        }
      }
      for (const tunnelX of [-58, 0, 58]) block(THREE, scene, [4.4, 2.4, 3.2], "#334155", [tunnelX, 1.2, standZ - 1.1], LAYER.far);
      for (let column = 0; column < 9; column += 1) {
        cylinder(THREE, scene, 0.3, 0.36, 18, "#94a3b8", [-80 + column * 20, 9, standZ - 19.4], LAYER.far, {}, 6);
      }
      block(THREE, scene, [176, 0.7, 21], "#e2e8f0", [0, 18.0, standZ - 10], LAYER.far);
      block(THREE, scene, [176, 1.5, 1.4], "#cbd5e1", [0, 17.2, standZ + 0.6], LAYER.far);
    }

    // The near grandstand is the one the tripod stands in. Its rows RISE behind
    // the camera and FALL away in front of it, so the photographer looks over
    // the heads below instead of into the back of a seat: nothing this stand is
    // made of ever crosses the lens. There is deliberately no front railing.
    // A 35 degree rake, not a gentle one: at this angle the rows in front of the
    // tripod drop away faster than the lens can look down, so the seating below
    // never climbs into the frame.
    const STAND_FRONT = TRACK_EDGE, ROW_RISE = 0.9, ROW_DEPTH = 1.3, FRONT_ROW_Y = 1.0;
    for (let row = 0; row < 20; row += 1) {
      const rz = STAND_FRONT + row * ROW_DEPTH, ry = FRONT_ROW_Y + row * ROW_RISE;
      block(THREE, scene, [176, ry, ROW_DEPTH], "#5b6577", [0, ry / 2, rz + ROW_DEPTH / 2], LAYER.far);
      for (let bay = 0; bay < 22; bay += 1) {
        // The rows the camera itself occupies stay empty; seats there would be
        // level with the lens.
        if (row >= 4 && row <= 6 && Math.abs(-84 + bay * 8) < 12) continue;
        const roll = (bay + row + Math.floor(stand() * 3)) % 5;
        const seatColor = roll < 2 ? "#dc2626" : roll < 4 ? "#1d4ed8" : "#f1f5f9";
        block(THREE, scene, [7.2, 0.34, 1.16], seatColor, [-84 + bay * 8, ry + 0.17, rz + 0.7], LAYER.far);
      }
    }
    // Retaining wall from the front row down to the track apron, so the stand
    // meets the ground instead of ending in a floating lip.
    block(THREE, scene, [176, FRONT_ROW_Y, 0.6], "#4a5364", [0, FRONT_ROW_Y / 2, STAND_FRONT - 0.3], LAYER.far);
    // Spectators, but only out towards the wings where they cannot mask the track.
    for (let fan = 0; fan < 14; fan += 1) {
      const side = fan % 2 ? 1 : -1;
      const row = 1 + (fan % 5);
      const seated = build3DHuman(THREE, {
        pose: "sit", height: 1.44,
        top: ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc", "#c084fc", "#0ea5e9"][fan % 7],
        bottom: "#1f2937", hair: ["#1c1917", "#4a2e1b", "#7c2d12", "#111827", "#a16207"][fan % 5],
        skin: ["#f0c9a4", "#c68642", "#8d5524", "#e8b98a", "#f5d0a9", "#e0ac69"][fan % 6],
        layer: LAYER.far,
      });
      put(scene, seated, LAYER.far, [side * (16 + (fan % 6) * 7), FRONT_ROW_Y + row * ROW_RISE, STAND_FRONT + row * ROW_DEPTH + 0.5], [0, Math.PI, 0]);
    }
    // End stands closing the oval at both ends.
    for (const endX of [-62, 62]) {
      for (let tier = 0; tier < 8; tier += 1) {
        block(THREE, scene, [1.6, 1.0 + tier * 0.9, 62], endX < 0 ? "#586274" : "#5b6577", [endX + Math.sign(endX) * tier * 1.6, (1.0 + tier * 0.9) / 2, TRACK_CENTRE], LAYER.far);
        for (let bay = 0; bay < 8; bay += 1) {
          const seatColor = ((bay + tier) % 4) < 2 ? "#1d4ed8" : "#f1f5f9";
          block(THREE, scene, [1.44, 0.34, 6.6], seatColor, [endX + Math.sign(endX) * tier * 1.6, 1.05 + tier * 0.9, TRACK_CENTRE - 26 + bay * 7.4], LAYER.far);
        }
      }
    }

    // Floodlight towers at the four corners.
    for (const [fx, fz] of [[-72, -92], [72, -92], [-72, 30], [72, 30]]) {
      cylinder(THREE, scene, 0.6, 1.1, 38, "#64748b", [fx, 19, fz], LAYER.far, {}, 8);
      block(THREE, scene, [11, 5.5, 1.2], "#475569", [fx, 39.5, fz], LAYER.far);
      for (let lampRow = 0; lampRow < 3; lampRow += 1) {
        for (let lampColumn = 0; lampColumn < 7; lampColumn += 1) {
          block(THREE, scene, [1.2, 1.2, 0.24], "#fefce8", [fx - 4.5 + lampColumn * 1.5, 38.0 + lampRow * 1.6, fz + (fz > 0 ? -0.7 : 0.7)], LAYER.far, { emissive: new THREE.Color("#fff7cc"), emissiveIntensity: 1.4 });
        }
      }
    }

    // Jumbotron and scoreboard beyond the back straight.
    for (const sx of [-11, 11]) cylinder(THREE, scene, 0.7, 0.7, 26, "#374151", [sx, 13, -100], LAYER.far);
    block(THREE, scene, [26, 11, 1.4], "#1f2937", [0, 27, -100], LAYER.far);
    block(THREE, scene, [23.4, 8.6, 0.2], "#0f172a", [0, 27.6, -99.2], LAYER.far, { emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.9 });
    block(THREE, scene, [23.4, 1.1, 0.2], "#0f172a", [0, 22.6, -99.2], LAYER.far, { emissive: new THREE.Color("#facc15"), emissiveIntensity: 1.3 });

    // Flag line along the back of the arena.
    for (let flag = 0; flag < 18; flag += 1) {
      const fx = -68 + flag * 8;
      cylinder(THREE, scene, 0.07, 0.09, 9, "#e2e8f0", [fx, 4.5, -112], LAYER.far, {}, 5);
      block(THREE, scene, [1.7, 1.1, 0.06], ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc"][flag % 5], [fx + 0.9, 8.3, -112], LAYER.far);
    }

    // Trackside kit: team benches, a water station, hurdles and marker cones,
    // all inside the infield where they cannot trip anybody up.
    for (let seat = 0; seat < 5; seat += 1) bench(THREE, scene, [-22 + seat * 2.6, TRACK_CENTRE + 8.6], LAYER.far, { seat: "#1d4ed8", leg: "#334155" });
    block(THREE, scene, [1.5, 0.9, 0.7], "#0ea5e9", [22, 0.45, TRACK_CENTRE + 7.5], LAYER.far);
    block(THREE, scene, [1.3, 0.14, 0.5], "#e0f2fe", [22, 0.97, TRACK_CENTRE + 7.5], LAYER.far);
    for (let bottle = 0; bottle < 6; bottle += 1) cylinder(THREE, scene, 0.05, 0.05, 0.24, "#f8fafc", [21.5 + bottle * 0.2, 1.12, TRACK_CENTRE + 7.5], LAYER.far, {}, 6);
    for (let hurdle = 0; hurdle < 6; hurdle += 1) {
      const hx = -24 + hurdle * 2.4, hz = TRACK_CENTRE - 8.5;
      block(THREE, scene, [0.1, 0.06, 1.1], "#f8fafc", [hx, 0.85, hz], LAYER.far);
      block(THREE, scene, [0.06, 0.85, 0.06], "#334155", [hx, 0.42, hz - 0.5], LAYER.far);
      block(THREE, scene, [0.06, 0.85, 0.06], "#334155", [hx, 0.42, hz + 0.5], LAYER.far);
    }
    cylinder(THREE, scene, 3.2, 3.2, 0.08, "#94a3b8", [-34, 0.05, TRACK_CENTRE + 4], LAYER.far, {}, 16);
    for (let cone = 0; cone < 16; cone += 1) {
      // Offset so no cone parks itself exactly on the camera's sight line.
      const coneAngle = cone * Math.PI / 8 + 0.19;
      peak(THREE, scene, 0.16, 0.42, "#f97316", [Math.cos(coneAngle) * 19.6, 0.21, TRACK_CENTRE + Math.sin(coneAngle) * 9.8], LAYER.far, 5);
    }

    // Officials and a coach, standing where officials actually stand.
    const starter = build3DHuman(THREE, { pose: "stand", top: "#f8fafc", bottom: "#1f2937", hair: "#1c1917", hat: "#dc2626", layer: LAYER.far });
    put(scene, starter, LAYER.far, [-2.0, 0.02, TRACK_CENTRE - INNER_RADIUS + 2.4], [0, 3.0, 0]);
    contactShadow(THREE, scene, 0.32).position.set(-2.0, 0.03, TRACK_CENTRE - INNER_RADIUS + 2.4);
    const judge = build3DHuman(THREE, { pose: "stand", top: "#facc15", bottom: "#334155", hair: "#4a2e1b", glasses: true, layer: LAYER.far });
    put(scene, judge, LAYER.far, [finishX + 1.4, 0.02, TRACK_CENTRE + 3.0], [0, -1.5, 0]);
    contactShadow(THREE, scene, 0.32).position.set(finishX + 1.4, 0.03, TRACK_CENTRE + 3.0);
    const coach = build3DHuman(THREE, { pose: "stand", top: "#0f766e", bottom: "#1f2937", hair: "#111827", hat: "#0f172a", layer: LAYER.far });
    put(scene, coach, LAYER.far, [-9.0, 0.02, TRACK_CENTRE + 8.0], [0, 0.2, 0]);
    contactShadow(THREE, scene, 0.32).position.set(-9.0, 0.03, TRACK_CENTRE + 8.0);
    const photographer = build3DHuman(THREE, { pose: "stand", top: "#0f172a", bottom: "#1f2937", hair: "#111827", layer: LAYER.near, prop: "camera" });
    put(scene, photographer, LAYER.near, [-5.6, 0.02, -9.6], [0, 3.0, 0]);
    contactShadow(THREE, scene, 0.32, 0.24, LAYER.near).position.set(-5.6, 0.03, -9.6);

    // Static animals
    const mascotDog = build3DSittingDog(THREE, "#d97706");
    put(scene, mascotDog, LAYER.near, [5.4, 0.02, -9.4], [0, -0.5, 0]);
    contactShadow(THREE, scene, 0.35, 0.24, LAYER.near).position.set(5.4, 0.03, -9.4);

    const restingDog = build3DLyingDog(THREE, "#f59e0b");
    put(scene, restingDog, LAYER.far, [-14, 0.02, TRACK_CENTRE + 5], [0, 0.4, 0]);
    contactShadow(THREE, scene, 0.4).position.set(-14, 0.03, TRACK_CENTRE + 5);

    const pigeon1 = build3DPerchedBird(THREE, "#64748b");
    put(scene, pigeon1, LAYER.far, [finishX - 6, 7.35, finishZ], [0, 1.5, 0]);
    const pigeon2 = build3DPerchedBird(THREE, "#475569");
    put(scene, pigeon2, LAYER.far, [finishX + 7, 7.35, finishZ], [0, -1.5, 0]);
    for (let spectator = 0; spectator < 6; spectator += 1) {
      const fan = build3DHuman(THREE, {
        pose: "stand", height: 1.44,
        top: ["#dc2626", "#1d4ed8", "#facc15", "#16a34a", "#f8fafc", "#c084fc"][spectator],
        bottom: "#1f2937", hair: ["#1c1917", "#4a2e1b", "#7c2d12", "#111827", "#a16207", "#0f172a"][spectator],
        skin: ["#f0c9a4", "#c68642", "#8d5524", "#e8b98a", "#f5d0a9", "#e0ac69"][spectator],
        layer: LAYER.far,
      });
      put(scene, fan, LAYER.far, [-30 + spectator * 12, 1.92, TRACK_CENTRE - 35.6], [0, 0, 0]);
    }

    return {};
  },

  portrait(THREE, scene) {
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

    return {};
  },

  group(THREE, scene) {
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

    return {};
  },

  street(THREE, scene) {
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
  },

  night(THREE, scene) {
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

    return {
      updaters: [(elapsed) => {
        const drop = (elapsed * 16) % 6;
        rain.position.y = -drop; rainNear.position.y = -drop * 1.4;
      }],
    };
  },

  /** 08: 山上星空夜景 (Extreme pitch-black mountain starry sky with glowing Milky Way galactic core) */
  starry(THREE, scene) {
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

    return {};
  },

  /** 09: 山上城市夜景 (Mountain summit overlooking shimmering metropolis in distant valley) */
  city_night(THREE, scene) {
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
    const mountainFox = build3DSittingDog(THREE, "#ea580c");
    put(scene, mountainFox, LAYER.far, [6.6, 0.08, -5.6], [0, -0.6, 0]);
    contactShadow(THREE, scene, 0.35).position.set(6.6, 0.09, -5.6);

    return {};
  },

  /** 10: 機場飛機起降 (Airport runway tarmac, control tower, terminal & commercial jetliners) */
  airport(THREE, scene) {
    const field = rand(59);
    // Airfield: mown grass everywhere, concrete only where aircraft actually roll.
    slab(THREE, scene, 2600, 2600, "#5c7a4e", [0, 0, -400], LAYER.far);
    // Main Concrete Runway (1800m x 55m)
    slab(THREE, scene, 1800, 55, "#1e293b", [0, 0.02, -260], LAYER.far);
    slab(THREE, scene, 1800, 75, "#556070", [0, 0.015, -260], LAYER.far);
    // Grass infield between the spotters' fence and the runway strip.
    for (let tuft = 0; tuft < 90; tuft += 1) {
      block(THREE, scene, [1.6 + field() * 2.4, 0.22, 1.4 + field() * 2.0], field() > 0.5 ? "#4f6f43" : "#688a55", [-260 + field() * 520, 0.11, -25 - field() * 190], LAYER.far);
    }
    // Parallel taxiway, its apron, and the yellow taxi guidance lines.
    slab(THREE, scene, 1500, 26, "#39424f", [0, 0.02, -330], LAYER.far);
    slab(THREE, scene, 1500, 0.9, "#facc15", [0, 0.035, -330], LAYER.far);
    slab(THREE, scene, 620, 90, "#39424f", [285, 0.02, -450], LAYER.far);
    for (const linkX of [-500, -180, 180, 500]) {
      slab(THREE, scene, 26, 70, "#39424f", [linkX, 0.02, -295], LAYER.far);
      slab(THREE, scene, 0.9, 70, "#facc15", [linkX, 0.035, -295], LAYER.far);
      slab(THREE, scene, 26, 52, "#39424f", [linkX + 40, 0.02, -356], LAYER.far, { spin: 0.3 });
    }
    for (const gateX of [175, 235, 295, 355, 415]) {
      slab(THREE, scene, 0.9, 60, "#facc15", [gateX, 0.035, -428], LAYER.far);
      slab(THREE, scene, 24, 0.5, "#f8fafc", [gateX, 0.035, -440], LAYER.far);
    }
    // Service road for ground vehicles, kept clear of the movement area.
    slab(THREE, scene, 900, 8, "#3f4652", [0, 0.02, -120], LAYER.far);
    for (let dash = -430; dash <= 430; dash += 24) slab(THREE, scene, 8, 0.4, "#e2e8f0", [dash, 0.035, -120], LAYER.far);
    // Runway Centerline Dashes
    for (let dash = -800; dash <= 800; dash += 45) {
      slab(THREE, scene, 25, 2.2, "#ffffff", [dash, 0.03, -260], LAYER.far, { spin: Math.PI / 2 });
    }
    // Runway Threshold Piano Keys at both ends
    for (const endX of [-780, 780]) {
      for (let k = -20; k <= 20; k += 4.5) {
        slab(THREE, scene, 28, 2.0, "#ffffff", [endX, 0.03, -260 + k], LAYER.far);
      }
    }
    // Runway Edge Lights
    for (let lightX = -800; lightX <= 800; lightX += 60) {
      sphere(THREE, scene, 0.35, "#ffffff", [lightX, 0.25, -288], LAYER.far, { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.8 });
      sphere(THREE, scene, 0.35, "#ffffff", [lightX, 0.25, -232], LAYER.far, { emissive: new THREE.Color("#ffffff"), emissiveIntensity: 1.8 });
    }

    // Airport Passenger Terminal Building (Z = -450m)
    // The terminal sits off to one side. Squarely behind the runway it becomes a
    // wall of glass that fills every telephoto frame; from here the aircraft get
    // open sky behind them and the building still reads as the airport.
    facadeBlock(THREE, scene, [300, 21, 55], [285, 10.5, -520], LAYER.far, facadeTexture(THREE, { base: "#e2e8f0", frame: "#64748b", glass: "#0ea5e9", lit: 0.55, columns: 8, rows: 4, seed: 19 }), "#f1f5f9", null, [20, 2]);
    for (const jx of [175, 235, 295, 355, 415]) {
      block(THREE, scene, [6, 4, 30], "#cbd5e1", [jx, 8, -468], LAYER.far);
      cylinder(THREE, scene, 0.4, 0.4, 8, "#64748b", [jx, 4, -455], LAYER.far);
    }
    // Air Traffic Control (ATC) Tower
    cylinder(THREE, scene, 4.5, 6.0, 52, "#e2e8f0", [-240, 26, -420], LAYER.far, {}, 12);
    cylinder(THREE, scene, 8.5, 7.0, 8, "#0284c7", [-240, 52, -420], LAYER.far, { emissive: new THREE.Color("#0284c7"), emissiveIntensity: 0.8 }, 12);
    sphere(THREE, scene, 4.2, "#f8fafc", [-240, 58, -420], LAYER.far);

    // Perimeter Security Chain-Link Fence & Spotter Area (Z = -10m to -25m)
    fence(THREE, scene, [-35, -12], [35, -12], 2.2, "#64748b", LAYER.far, 3.0);
    // Warning placard, kept off the centre line so a 600 mm lens sees the runway.
    block(THREE, scene, [1.6, 0.8, 0.05], "#f59e0b", [-14, 1.6, -11.95], LAYER.far);

    // Raised spotter deck. The whole point of it is that the tripod ends up
    // above the perimeter fence, so the chain-link never crosses the frame at
    // any pitch. The runway side is open: railings run down the flanks and
    // across the back only, and the front edge carries no rail at all.
    block(THREE, scene, [13, 0.35, 13], "#94a3b8", [0, 4.22, 0], LAYER.far);
    block(THREE, scene, [13, 0.5, 0.5], "#78849a", [0, 4.15, -6.3], LAYER.far);
    for (const [lx, lz] of [[-5.8, -5.8], [5.8, -5.8], [-5.8, 5.8], [5.8, 5.8], [0, -5.8], [0, 5.8]]) {
      cylinder(THREE, scene, 0.22, 0.28, 4.05, "#64748b", [lx, 2.02, lz], LAYER.far, {}, 8);
    }
    for (const braceZ of [-5.8, 5.8]) block(THREE, scene, [11.6, 0.16, 0.16], "#64748b", [0, 2.2, braceZ], LAYER.far);
    for (const sideX of [-6.4, 6.4]) {
      // Flank railings stop level with the tripod and only run backwards, so no
      // part of them is ever in front of the lens however far it is yawed.
      for (let post = 0; post < 4; post += 1) cylinder(THREE, scene, 0.05, 0.05, 1.1, "#cbd5e1", [sideX, 4.95, 0.6 + post * 1.9], LAYER.far, {}, 6);
      block(THREE, scene, [0.07, 0.07, 6.1], "#cbd5e1", [sideX, 5.45, 3.4], LAYER.far);
      block(THREE, scene, [0.07, 0.07, 6.1], "#cbd5e1", [sideX, 4.9, 3.4], LAYER.far);
    }
    for (let post = 0; post < 7; post += 1) cylinder(THREE, scene, 0.05, 0.05, 1.1, "#cbd5e1", [-6.4 + post * 2.13, 4.95, 6.3], LAYER.far, {}, 6);
    block(THREE, scene, [13, 0.07, 0.07], "#cbd5e1", [0, 5.45, 6.3], LAYER.far);
    // Stair flight down off the back of the deck.
    for (let step = 0; step < 11; step += 1) {
      block(THREE, scene, [2.4, 0.14, 0.34], "#94a3b8", [0, 4.0 - step * 0.38, 6.9 + step * 0.36], LAYER.far);
    }
    // An information board and a seat at the back of the deck, behind the lens.
    block(THREE, scene, [2.4, 1.0, 0.09], "#e2e8f0", [3.6, 5.1, 5.9], LAYER.far, { rotation: [-0.45, 0, 0] });
    block(THREE, scene, [1.8, 0.09, 0.5], "#64748b", [-3.8, 4.85, 5.4], LAYER.far);
    for (const legX of [-4.6, -3.0]) block(THREE, scene, [0.1, 0.45, 0.45], "#475569", [legX, 4.62, 5.4], LAYER.far);

    // Airport Windsock on its mast, out by the runway where windsocks live.
    cylinder(THREE, scene, 0.06, 0.06, 4.5, "#e2e8f0", [-78, 2.25, -150], LAYER.far);
    cylinder(THREE, scene, 0.28, 0.14, 1.4, "#ea580c", [-77.4, 4.4, -150], LAYER.far, { rotation: [0, 0, Math.PI / 2] });

    // Approach light array leading up to the arrival threshold.
    for (let bar = 1; bar <= 14; bar += 1) {
      const bx = -800 - bar * 30;
      const barWidth = bar % 5 === 0 ? 22 : 9;
      cylinder(THREE, scene, 0.4, 0.6, 2.2 + bar * 0.55, "#475569", [bx, (2.2 + bar * 0.55) / 2, -260], LAYER.far, {}, 5);
      slab(THREE, scene, 1.6, barWidth, "#fefce8", [bx, 2.4 + bar * 0.55, -260], LAYER.far, { emissive: new THREE.Color("#fff7cc"), emissiveIntensity: 2.2 });
    }
    // Precision approach path indicator beside the touchdown zone.
    for (let papi = 0; papi < 4; papi += 1) {
      block(THREE, scene, [1.6, 1.1, 1.1], "#e2e8f0", [-700, 0.6, -300 - papi * 4], LAYER.far);
      block(THREE, scene, [0.2, 0.7, 0.7], papi < 2 ? "#ef4444" : "#f8fafc", [-700.9, 0.7, -300 - papi * 4], LAYER.far, { emissive: new THREE.Color(papi < 2 ? "#ef4444" : "#f8fafc"), emissiveIntensity: 2 });
    }
    // Glideslope antenna mast on the far side of the runway.
    cylinder(THREE, scene, 0.35, 0.5, 14, "#e2e8f0", [-690, 7, -212], LAYER.far, {}, 6);
    for (let dish = 0; dish < 3; dish += 1) block(THREE, scene, [0.4, 1.6, 2.6], "#f8fafc", [-690, 4 + dish * 4, -210], LAYER.far);
    block(THREE, scene, [8, 0.4, 8], "#94a3b8", [-690, 0.2, -212], LAYER.far);
    // Localiser array off the departure end.
    for (let element = 0; element < 12; element += 1) {
      cylinder(THREE, scene, 0.2, 0.24, 5, "#e2e8f0", [860, 2.5, -290 + element * 7], LAYER.far, {}, 5);
    }

    // Maintenance hangars along the western apron.
    for (const [hx, hz, hw] of [[-420, -430, 150], [-250, -430, 130]]) {
      block(THREE, scene, [hw, 34, 96], "#cbd5e1", [hx, 17, hz], LAYER.far);
      const roof = put(scene, new THREE.Mesh(new THREE.CylinderGeometry(52, 52, hw, 14, 1, false, 0, Math.PI), surface(THREE, "#94a3b8")), LAYER.far, [hx, 34, hz], [0, 0, Math.PI / 2]);
      roof.updateMatrix();
      block(THREE, scene, [hw * 0.8, 26, 1.2], "#64748b", [hx, 13, hz + 48.5], LAYER.far);
      for (let panel = 0; panel < 6; panel += 1) block(THREE, scene, [hw * 0.12, 24, 0.4], "#475569", [hx - hw * 0.35 + panel * hw * 0.14, 13, hz + 49.2], LAYER.far);
    }
    slab(THREE, scene, 420, 120, "#39424f", [-340, 0.02, -360], LAYER.far);

    // Rotating beacon tower beside the control tower.
    cylinder(THREE, scene, 0.6, 1.0, 26, "#e2e8f0", [-210, 13, -404], LAYER.far, {}, 8);
    block(THREE, scene, [3.4, 2.0, 1.6], "#334155", [-210, 27, -404], LAYER.far);
    block(THREE, scene, [1.2, 1.2, 0.3], "#4ade80", [-210, 27, -403.1], LAYER.far, { emissive: new THREE.Color("#4ade80"), emissiveIntensity: 3 });
    block(THREE, scene, [1.2, 1.2, 0.3], "#f8fafc", [-210, 27, -404.9], LAYER.far, { emissive: new THREE.Color("#f8fafc"), emissiveIntensity: 3 });

    // Radar and perimeter service kit.
    for (let post = 0; post < 22; post += 1) {
      cylinder(THREE, scene, 0.14, 0.18, 3.4, "#94a3b8", [-320 + post * 30, 1.7, -228], LAYER.far, {}, 5);
      sphere(THREE, scene, 0.22, "#f8fafc", [-320 + post * 30, 3.4, -228], LAYER.far, { emissive: new THREE.Color("#fef3c7"), emissiveIntensity: 1.4 }, 6, 5);
    }

    // Parked Commercial Jetliner at terminal gate (Z = -360m)
    const parkedPlane = build3DAirplane(THREE, "#ffffff", "#0284c7");
    put(scene, parkedPlane, LAYER.far, [235, 1.63, -430], [0, Math.PI / 2, 0]);

    // Ground handling around the parked jet: stairs, fuel bowser, belt loader, cones.
    block(THREE, scene, [4.4, 0.4, 2.4], "#e2e8f0", [225.0, 0.5, -423.0], LAYER.far);
    for (let stair = 0; stair < 9; stair += 1) block(THREE, scene, [0.6, 0.16, 2.2], "#cbd5e1", [227.4 + stair * 0.62, 0.9 + stair * 0.42, -423], LAYER.far);
    block(THREE, scene, [5.6, 0.9, 0.12], "#94a3b8", [228.5, 3.2, -421.9], LAYER.far, { rotation: [0, 0, 0.6] });
    for (const wheelX of [224.2, 231.6]) cylinder(THREE, scene, 0.35, 0.35, 0.3, "#1e293b", [wheelX, 0.32, -423], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 10);
    block(THREE, scene, [7.5, 1.8, 2.6], "#f8fafc", [245.0, 1.3, -422.0], LAYER.far);
    cylinder(THREE, scene, 1.3, 1.3, 6.2, "#e2e8f0", [246.5, 2.2, -422.0], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 12);
    block(THREE, scene, [2.4, 1.9, 2.4], "#0284c7", [240.4, 1.3, -422.0], LAYER.far);
    for (const [wx, wz] of [[241, -420.9], [241, -423.1], [247.5, -420.9], [247.5, -423.1]]) cylinder(THREE, scene, 0.45, 0.45, 0.4, "#1e293b", [wx, 0.45, wz], LAYER.far, { rotation: [0, 0, Math.PI / 2] }, 10);
    for (let cone = 0; cone < 10; cone += 1) {
      peak(THREE, scene, 0.24, 0.7, "#f97316", [223 + cone * 3.2, 0.35, -437], LAYER.far, 5);
    }
    for (let dolly = 0; dolly < 4; dolly += 1) {
      block(THREE, scene, [2.6, 0.5, 1.5], "#475569", [219 - dolly * 3.2, 0.55, -438], LAYER.far);
      block(THREE, scene, [2.2, 0.9, 1.3], "#cbd5e1", [219 - dolly * 3.2, 1.2, -438], LAYER.far);
    }

    // Ground crew, marshalling where ground crew actually stand.
    const marshaller = build3DHuman(THREE, { pose: "stand", top: "#facc15", bottom: "#1f2937", hair: "#1c1917", hat: "#f97316", layer: LAYER.far });
    put(scene, marshaller, LAYER.far, [221, 0.03, -442], [0, -1.5, 0]);
    const spotter = build3DHuman(THREE, { pose: "stand", top: "#0ea5e9", bottom: "#334155", hair: "#4a2e1b", hat: "#1d4ed8", layer: LAYER.near, prop: "camera" });
    put(scene, spotter, LAYER.near, [-4.4, 4.42, 4.6], [0, 0.4, 0]);
    contactShadow(THREE, scene, 0.3, 0.24, LAYER.near).position.set(-4.4, 4.43, 4.6);

    // Static wildlife
    const securityHawk = build3DPerchedBird(THREE, "#475569", "#f59e0b");
    put(scene, securityHawk, LAYER.far, [16.5, 2.25, -12], [0, -0.4, 0]);
    const runwayBunny = build3DBunny(THREE, "#d1d5db");
    put(scene, runwayBunny, LAYER.far, [-6.5, 0.02, -18], [0, 0.5, 0]);
    contactShadow(THREE, scene, 0.25).position.set(-6.5, 0.03, -18);

    return {};
  },

  /** 11: 室外人像 (Sunlit botanical garden terrace with lush wisteria pergola and bokeh fountain) */
  outdoor_portrait(THREE, scene) {
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

    return {};
  },
};

/**
 * Assembles one scenario: geometry, lighting, sky, and its billboard subjects.
 *
 * @param {typeof import("three")} THREE
 * @param {keyof typeof BUILDERS} key
 * @returns {{scene: object, subjects: object[], shadows: object[], updaters: Function[], world: object}}
 */
export function buildScene(THREE, key, mergeGeometries) {
  const world = WORLD[key] ?? WORLD.landscape;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(world.fog[0]), world.fog[1]);
  skyDome(THREE, scene, world.sky);
  const sun = lighting(THREE, scene, world, key);
  const extra = (BUILDERS[key] ?? BUILDERS.landscape)(THREE, scene) ?? {};

  const subjects = [], shadows = [];
  if (key === "landscape") {
    const deer1 = build3DDeer(THREE, "#b45309"); scene.add(deer1);
    const deer2 = build3DDeer(THREE, "#92400e"); scene.add(deer2);
    const eagle = build3DBird(THREE, "#3f3f46"); scene.add(eagle);
    const bunny = build3DBunny(THREE, "#ffffff"); scene.add(bunny);

    subjects.push(deer1, deer2, eagle, bunny);
    shadows.push(contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.2), contactShadow(THREE, scene, 0.3));
  } else if (key === "bird") {
    const colors = ["#475569", "#1e293b", "#0f172a", "#334155", "#475569", "#1e293b", "#3b82f6"];
    for (let index = 0; index < BIRD_COUNT; index += 1) {
      const bird = build3DBird(THREE, colors[index % colors.length]);
      scene.add(bird);
      subjects.push(bird);
      shadows.push(contactShadow(THREE, scene, 0.3));
    }
  } else if (key === "sports") {
    // Five sprinters, one per lane, each in a different club vest.
    const kit = [
      { top: "#f8fafc", bottom: "#1d4ed8", skin: "#f0c9a4", hair: "#2a1d14" },
      { top: "#ef4444", bottom: "#111827", skin: "#8d5524", hair: "#0f172a" },
      { top: "#3b82f6", bottom: "#1e293b", skin: "#e8b98a", hair: "#7c2d12" },
      { top: "#10b981", bottom: "#0f172a", skin: "#c68642", hair: "#1c1917" },
      { top: "#f59e0b", bottom: "#334155", skin: "#f5d0a9", hair: "#a16207" },
    ];
    for (let index = 0; index < 5; index += 1) {
      const runner = build3DHuman(THREE, { ...kit[index], pose: "run", height: 1.52, sleeves: false, bare: true, shoes: "#f8fafc" });
      scene.add(runner);
      subjects.push(runner);
      shadows.push(contactShadow(THREE, scene, 0.5));
    }
  } else if (key === "portrait") {
    const sitter = build3DHuman(THREE, { pose: "sit", skin: "#f0c9a4", hair: "#3f2a1b", top: "#be123c", bottom: "#1f2937", height: 1.52 });
    scene.add(sitter);
    subjects.push(sitter);
    shadows.push(contactShadow(THREE, scene, 0.42));

    const cat = build3DCat(THREE, "#ea580c"); scene.add(cat);
    subjects.push(cat);
    shadows.push(contactShadow(THREE, scene, 0.3));
  } else if (key === "group") {
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
  } else if (key === "street") {
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
  } else if (key === "night") {
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
  } else if (key === "starry") {
    const stargazer = build3DAstronomer(THREE, "#1e293b"); scene.add(stargazer);
    const meteor = build3DBird(THREE, "#93c5fd"); scene.add(meteor);

    subjects.push(stargazer, meteor);
    shadows.push(contactShadow(THREE, scene, 0.45), contactShadow(THREE, scene, 0.3));
  } else if (key === "city_night") {
    const car1 = build3DCar(THREE, "#fef08a"); scene.add(car1);
    const car2 = build3DCar(THREE, "#ef4444"); scene.add(car2);
    const drone = build3DBird(THREE, "#38bdf8"); scene.add(drone);

    subjects.push(car1, car2, drone);
    shadows.push(contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.5), contactShadow(THREE, scene, 0.3));
  } else if (key === "airport") {
    const plane1 = build3DAirplane(THREE, "#f8fafc", "#2563eb"); scene.add(plane1);
    const plane2 = build3DAirplane(THREE, "#ffffff", "#dc2626"); scene.add(plane2);
    const tug = build3DCar(THREE, "#f59e0b"); scene.add(tug);

    subjects.push(plane1, plane2, tug);
    shadows.push(contactShadow(THREE, scene, 1.2), contactShadow(THREE, scene, 1.2), contactShadow(THREE, scene, 0.5));
  } else if (key === "outdoor_portrait") {
    const model = build3DModelPose(THREE, "#78350f", "#ec4899"); scene.add(model);
    const butterfly = build3DBird(THREE, "#f472b6"); scene.add(butterfly);

    subjects.push(model, butterfly);
    shadows.push(contactShadow(THREE, scene, 0.42), contactShadow(THREE, scene, 0.2));
  }

  const batchSignature = object => {
    const material = object.isMesh ? object.material : null;
    if (!material || Array.isArray(material) || material.transparent || material.map || material.type === "ShaderMaterial" || object.children.length) return null;
    return [object.layers.mask, material.type, material.color?.getHexString(), material.emissive?.getHexString(), material.emissiveIntensity ?? 0, material.side, material.flatShading, material.opacity].join(":");
  };

  const mergeBatch = (meshes, destination, matrixForMesh) => {
    if (meshes.length < 2) return;
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(matrixForMesh(mesh)));
    const mergedGeometry = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!mergedGeometry) return;
    const retainedMaterial = meshes[0].material;
    const merged = new THREE.Mesh(mergedGeometry, retainedMaterial);
    merged.layers.mask = meshes[0].layers.mask;
    merged.matrixAutoUpdate = false;
    destination.add(merged);
    const disposedMaterials = new Set();
    for (const mesh of meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      if (mesh.material !== retainedMaterial && !disposedMaterials.has(mesh.material)) {
        disposedMaterials.add(mesh.material);
        mesh.material.dispose();
      }
    }
  };

  // A moving subject is animated as one rigid root. Merge equal-material leaf
  // meshes inside that root so a detailed person, animal or vehicle no longer
  // costs one colour part per draw in both the main and shadow passes. Geometry
  // remains bit-for-bit in the same root-local positions, so routes, AF and the
  // visible scene stay unchanged.
  if (mergeGeometries) {
    scene.updateMatrixWorld(true);
    for (const root of subjects) {
      if (!root.children.length) continue;
      const rootInverse = root.matrixWorld.clone().invert();
      const batches = new Map();
      root.traverse(object => {
        if (object === root || object.userData.animated) return;
        const signature = batchSignature(object);
        if (!signature) return;
        const batch = batches.get(signature) ?? [];
        batch.push(object);
        batches.set(signature, batch);
      });
      for (const meshes of batches.values()) {
        mergeBatch(meshes, root, mesh => rootInverse.clone().multiply(mesh.matrixWorld));
      }
    }
  }

  // Dynamic object hierarchy check so sub-meshes inside 3D animal/vehicle groups remain animated.
  const dynamicObjects = new Set([...subjects, ...shadows]);
  const isDynamic = obj => {
    let curr = obj;
    while (curr) {
      if (dynamicObjects.has(curr)) return true;
      curr = curr.parent;
    }
    return false;
  };
  scene.traverse(object => {
    if (object === scene || isDynamic(object) || object.userData.animated) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });

  // A detailed city or stadium can otherwise cost more than 100 draw calls.
  // Merge opaque static meshes that share a material into one GPU batch while
  // keeping their depth layer intact. Merged geometry still participates in AF
  // raycasting, unlike a decorative bitmap shortcut.
  if (mergeGeometries) {
    // Static props are authored as groups (a cabin, a bench, a bystander), so the
    // batcher walks into every group that is not driven by a route and collects
    // its leaf meshes by world matrix. Without that, a scene full of assembled
    // props would cost one draw call per plank.
    scene.updateMatrixWorld(true);
    const batches = new Map();
    const collect = parent => {
      for (const object of parent.children) {
        if (dynamicObjects.has(object) || object.userData.animated) continue;
        // Celestial bodies are metering emitters that must survive as themselves.
        if (object.userData.isCelestial || object.userData.lightSource || object === scene.userData.meteringEmitter) continue;
        const signature = batchSignature(object);
        if (signature) {
          const batch = batches.get(signature) ?? [];
          batch.push(object);
          batches.set(signature, batch);
        } else if (object.children.length) {
          collect(object);
        }
      }
    };
    collect(scene);
    for (const meshes of batches.values()) {
      mergeBatch(meshes, scene, mesh => mesh.matrixWorld);
    }
  }

  // Real Lambert surfaces receive and cast filtered directional shadows. Transparent
  // billboards, sky sprites, rain and contact-shadow decals stay out of the
  // shadow map so the effect remains clean and affordable at high refresh rates.
  scene.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.some(material => material?.isMeshLambertMaterial && !material.transparent)) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return { scene, subjects, shadows, sun, updaters: extra.updaters ?? [], world };
}
