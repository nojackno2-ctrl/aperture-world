import { ANCHORS } from "./motion.mjs";
import { LAYER, WORLD } from "./world.mjs";

/**
 * Builds the seven playable worlds as real 3D geometry. `THREE` is passed in so
 * this module never pulls the renderer into the server bundle.
 *
 * Every mesh is assigned to a depth bucket (`LAYER.far` / `LAYER.subject` /
 * `LAYER.near`) so a capture can blur each band by its own circle of confusion.
 */

/**
 * Q-version cutouts reused as camera-facing billboards inside the 3D world.
 * Chibi figures carry a head worth roughly 40% of their body, so they are sized
 * as child-height stand-ins; a realistic 1.8 m would fill the frame with face.
 */
export const SUBJECT_ART = {
  bird: { url: "/scenes/bird_subject.png", height: 1.4 },
  sports: { url: "/scenes/sports_subject.png", height: 1.5 },
  portrait: { url: "/scenes/portrait_subject.png", height: 1.5 },
  street: { url: "/scenes/street_subject.png", height: 1.3 },
  night: { url: "/scenes/night_subject.png", height: 1.35 },
};

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

function facadeBlock(THREE, scene, size, position, layer, texture, tint = "#ffffff", glow) {
  const material = new THREE.MeshLambertMaterial({ map: texture.clone(), color: new THREE.Color(tint) });
  material.map.needsUpdate = true;
  if (glow) { material.emissive = new THREE.Color(glow); material.emissiveMap = material.map; material.emissiveIntensity = 1.1; }
  material.map.repeat.set(Math.max(1, Math.round(size[0] / 4)), Math.max(1, Math.round(size[1] / 4)));
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

function billboard(THREE, scene, { url, texture, height }, tint = "#ffffff") {
  const material = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.08, color: new THREE.Color(tint), depthWrite: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, height), material);
  if (texture) {
    material.map = texture;
    material.needsUpdate = true;
    mesh.scale.set((height * (texture.image?.width || 256)) / (texture.image?.height || 256), 1, 1);
    put(scene, mesh, LAYER.subject, [0, height / 2, -6]);
  } else if (url) {
    mesh.visible = false;
    put(scene, mesh, LAYER.subject, [0, height / 2, -6]);
    new THREE.TextureLoader().load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex; material.needsUpdate = true;
      mesh.scale.set((height * tex.image.width) / tex.image.height, 1, 1);
      mesh.visible = true;
    });
  }
  return mesh;
}

function characterTexture(THREE, { skin = "#ffe0bd", hair = "#4a2e1b", top = "#ef4444", bottom = "#1d4ed8", hat = null, glasses = false } = {}) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(128, 90, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(110, 88, 5, 0, Math.PI * 2); ctx.arc(146, 88, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(128, 98, 10, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(128, 80, 48, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(80, 80, 16, 28); ctx.fillRect(160, 80, 16, 28);
  if (glasses) {
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 3;
    ctx.strokeRect(98, 80, 22, 16); ctx.strokeRect(136, 80, 22, 16);
    ctx.beginPath(); ctx.moveTo(120, 88); ctx.lineTo(136, 88); ctx.stroke();
  }
  if (hat) {
    ctx.fillStyle = hat; ctx.beginPath(); ctx.ellipse(128, 46, 54, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(96, 22, 64, 26);
  }
  ctx.fillStyle = top; ctx.fillRect(100, 138, 56, 55);
  ctx.fillStyle = bottom; ctx.fillRect(104, 193, 20, 48); ctx.fillRect(132, 193, 20, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function animalTexture(THREE, type, { color = "#d97706" } = {}) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  if (type === "deer") {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(128, 140, 58, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(172, 90, 18, 32, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(186, 70, 20, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(85, 160); ctx.lineTo(85, 230); ctx.moveTo(150, 160); ctx.lineTo(150, 230); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = "#78350f";
    ctx.beginPath(); ctx.moveTo(182, 52); ctx.lineTo(178, 25); ctx.lineTo(168, 15); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(110, 130, 4, 0, Math.PI*2); ctx.arc(130, 145, 5, 0, Math.PI*2); ctx.fill();
  } else if (type === "dog") {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(120, 150, 45, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(165, 115, 25, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(90, 175); ctx.lineTo(90, 220); ctx.moveTo(145, 175); ctx.lineTo(145, 220); ctx.stroke();
  } else if (type === "cat") {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(128, 160, 35, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(128, 115, 22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(112, 100); ctx.lineTo(105, 80); ctx.lineTo(120, 95); ctx.fill();
    ctx.beginPath(); ctx.moveTo(144, 100); ctx.lineTo(151, 80); ctx.lineTo(136, 95); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(85, 150, 25, 0.5 * Math.PI, 1.5 * Math.PI); ctx.stroke();
  } else if (type === "rabbit") {
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(128, 160, 30, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(128, 120, 20, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(118, 75, 8, 30, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(138, 75, 8, 30, 0.1, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(128, 135, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(155, 120, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(120, 105, 28, 12, -0.6, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function vehicleTexture(THREE, type, { color = "#dc2626" } = {}) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = color; ctx.fillRect(40, 120, 176, 60);
  ctx.fillRect(75, 75, 106, 50);
  ctx.fillStyle = "#bae6fd"; ctx.fillRect(85, 85, 40, 32); ctx.fillRect(133, 85, 40, 32);
  ctx.fillStyle = "#1e293b";
  ctx.beginPath(); ctx.arc(75, 180, 20, 0, Math.PI * 2); ctx.arc(181, 180, 20, 0, Math.PI * 2); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

function contactShadow(THREE, scene, radius, opacity = 0.24) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));
  mesh.raycast = () => {};
  return put(scene, mesh, LAYER.subject, [0, 0.02, -6], [-Math.PI / 2, 0, 0]);
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
  if (key !== "night") {
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

const BUILDERS = {
  landscape(THREE, scene) {
    slab(THREE, scene, 2400, 2400, "#67954f", [0, 0, -300], LAYER.far);
    const ridge = rand(31);
    for (let index = 0; index < 18; index += 1) {
      const x = -760 + index * 88 + ridge() * 40, z = -520 - ridge() * 260, radius = 80 + ridge() * 90, height = 150 + ridge() * 190;
      peak(THREE, scene, radius, height, index % 2 ? "#5f7f9e" : "#6d8aa6", [x, 0, z], LAYER.far, 5);
      peak(THREE, scene, radius * 0.34, height * 0.3, "#eef3f7", [x, height * 0.36, z], LAYER.far, 5);
    }
    // A clear corridor down the middle: hills and groves stay off the sight line.
    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 ? 1 : -1;
      peak(THREE, scene, 40 + ridge() * 34, 60 + ridge() * 70, "#5b8a4e", [side * (70 + ridge() * 140), 0, -180 - ridge() * 150], LAYER.far, 5);
    }
    put(scene, new THREE.Mesh(new THREE.CircleGeometry(140, 44), surface(THREE, "#9fd0e2", { emissive: new THREE.Color("#3a7590"), emissiveIntensity: 0.4 })), LAYER.far, [0, 0.04, -130], [-Math.PI / 2, 0, 0]);
    const grove = rand(97);
    for (let index = 0; index < 30; index += 1) {
      const side = index % 2 ? 1 : -1;
      tree(THREE, scene, [side * (16 + grove() * 86), 0, -34 - grove() * 96], LAYER.far, 1.8 + grove() * 2.4, index % 3 ? "#3f6b3c" : "#547f3f");
    }
    for (let index = 0; index < 34; index += 1) block(THREE, scene, [0.6 + grove() * 0.7, 0.22 + grove() * 0.34, 0.6], "#6d9a4d", [-13 + grove() * 26, 0.16, -4.2 - grove() * 3.6], LAYER.near, { rotation: [0, grove() * 3, 0] });
    for (let index = 0; index < 5; index += 1) put(scene, new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + grove() * 0.16), surface(THREE, "#a49d8d")), LAYER.near, [-9 + grove() * 18, 0.12, -5.4 - grove() * 2.4], [grove(), grove(), grove()]);
    for (let index = 0; index < 24; index += 1) put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.5 + grove() * 0.7, 7, 5), surface(THREE, index % 4 ? "#4f7f42" : "#5f8f46")), LAYER.far, [-40 + grove() * 80, 0.3, -12 - grove() * 34], null);

    // Alpine Wooden Cabin nestled by pine grove
    block(THREE, scene, [5.5, 3.2, 4.2], "#735238", [-18, 1.6, -55], LAYER.far);
    peak(THREE, scene, 3.8, 2.0, "#422e1f", [-18, 4.2, -55], LAYER.far, 4);
    block(THREE, scene, [0.8, 1.6, 0.2], "#362215", [-18, 0.8, -52.85], LAYER.far);
    block(THREE, scene, [1.1, 1.0, 0.1], "#ffdf85", [-16.2, 2.0, -52.85], LAYER.far, { emissive: new THREE.Color("#ffaa33"), emissiveIntensity: 1.4 });
    cylinder(THREE, scene, 0.25, 0.25, 1.8, "#4a4a4a", [-19.8, 4.4, -55], LAYER.far);

    // Wooden Pier extending into lake
    block(THREE, scene, [2.2, 0.2, 10], "#826143", [8, 0.2, -52], LAYER.far);
    fence(THREE, scene, [6.9, -47], [6.9, -57], 1.1, "#5e452e", LAYER.far);
    fence(THREE, scene, [9.1, -47], [9.1, -57], 1.1, "#5e452e", LAYER.far);
    for (const z of [-48, -52, -56]) {
      cylinder(THREE, scene, 0.18, 0.18, 1.8, "#4a3522", [7, -0.7, z], LAYER.far);
      cylinder(THREE, scene, 0.18, 0.18, 1.8, "#4a3522", [9, -0.7, z], LAYER.far);
    }

    // Split-Rail Fence along trail
    fence(THREE, scene, [-16, -14], [-8, -20], 0.95, "#6b4f35", LAYER.far);
    fence(THREE, scene, [8, -18], [18, -26], 0.95, "#6b4f35", LAYER.far);

    // Wildflower fields on foreground slopes
    const flowerColors = ["#facc15", "#f472b6", "#c084fc", "#ffffff", "#fb923c"];
    for (let index = 0; index < 32; index += 1) {
      const fx = -22 + grove() * 44, fz = -10 - grove() * 25;
      peak(THREE, scene, 0.12, 0.25, flowerColors[index % flowerColors.length], [fx, 0.15, fz], LAYER.far, 4);
    }
    for (let index = 0; index < 18; index += 1) {
      const fx = -10 + grove() * 20, fz = -3.5 - grove() * 3.5;
      peak(THREE, scene, 0.08, 0.18, flowerColors[(index * 2) % flowerColors.length], [fx, 0.1, fz], LAYER.near, 4);
    }

    // Campsite
    peak(THREE, scene, 1.5, 1.3, "#ea580c", [-7, 0.65, -22], LAYER.far, 3);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      sphere(THREE, scene, 0.12, "#64748b", [-5 + Math.cos(angle) * 0.5, 0.08, -21 + Math.sin(angle) * 0.5], LAYER.far);
    }
    block(THREE, scene, [0.5, 0.12, 0.12], "#f97316", [-5, 0.08, -21], LAYER.far, { emissive: new THREE.Color("#ff6600"), emissiveIntensity: 1.8 });
    cylinder(THREE, scene, 0.18, 0.18, 0.8, "#543820", [-5.8, 0.15, -20.2], LAYER.far, { rotation: [Math.PI / 2, 0, 0.4] });

    return {};
  },

  bird(THREE, scene) {
    slab(THREE, scene, 1600, 1600, "#6fa2b8", [0, 0, -240], LAYER.far, { emissive: new THREE.Color("#2b5568"), emissiveIntensity: 0.34 });
    const marsh = rand(53);
    for (let index = 0; index < 12; index += 1) peak(THREE, scene, 90 + marsh() * 70, 46 + marsh() * 60, "#87a8b6", [-520 + index * 96, 0, -430 - marsh() * 190], LAYER.far, 5);
    for (let index = 0; index < 30; index += 1) block(THREE, scene, [2.4 + marsh() * 5, 0.35, 2 + marsh() * 4], "#6b9059", [-70 + marsh() * 140, 0.16, -46 - marsh() * 110], LAYER.far);
    // Reeds line the banks so the flight corridor overhead stays open.
    for (let index = 0; index < 54; index += 1) {
      const side = index % 2 ? 1 : -1, x = side * (11 + marsh() * 26), z = -14 - marsh() * 58;
      put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.6 + marsh() * 1.5, 4), surface(THREE, marsh() > 0.5 ? "#8fae57" : "#a2b964")), LAYER.far, [x, 0.9, z], [0, 0, (marsh() - 0.5) * 0.4]);
    }
    for (let index = 0; index < 40; index += 1) {
      const side = index % 2 ? 1 : -1, x = side * (2.2 + marsh() * 8), z = -2.6 - marsh() * 4.4;
      put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.1, 1.9 + marsh() * 1.3, 4), surface(THREE, "#93b45c")), LAYER.near, [x, 1, z], [0, 0, (marsh() - 0.5) * 0.5]);
    }
    for (let index = 0; index < 10; index += 1) tree(THREE, scene, [(index % 2 ? 1 : -1) * (26 + marsh() * 58), 0, -54 - marsh() * 44], LAYER.far, 2 + marsh() * 1.6, "#57874f");
    for (let index = 0; index < 7; index += 1) put(scene, new THREE.Mesh(new THREE.SphereGeometry(3 + marsh() * 5, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff"), transparent: true, opacity: 0.5 })), LAYER.far, [-90 + marsh() * 180, 40 + marsh() * 26, -180 - marsh() * 160]);

    // Bird Watching Observatory Tower
    for (const [px, pz] of [[12, -26], [16, -26], [12, -30], [16, -30]]) {
      cylinder(THREE, scene, 0.18, 0.18, 6.5, "#574233", [px, 3.25, pz], LAYER.far);
    }
    block(THREE, scene, [4.8, 0.3, 4.8], "#6e5543", [14, 6.2, -28], LAYER.far);
    fence(THREE, scene, [11.8, -30.2], [16.2, -30.2], 7.2, "#574233", LAYER.far);
    peak(THREE, scene, 3.4, 2.0, "#3d2c20", [14, 8.2, -28], LAYER.far, 4);
    block(THREE, scene, [0.4, 6.2, 0.1], "#453326", [11.8, 3.1, -25.8], LAYER.far, { rotation: [0.15, 0, 0] });

    // Raised Wooden Boardwalk over water
    block(THREE, scene, [2.0, 0.25, 26], "#735a46", [-16, 0.6, -26], LAYER.far, { rotation: [0, -0.22, 0] });
    fence(THREE, scene, [-17, -14], [-11, -38], 1.5, "#544131", LAYER.far);
    for (let bz = -14; bz >= -38; bz -= 6) {
      const bx = -16 + (bz + 26) * Math.sin(-0.22);
      cylinder(THREE, scene, 0.14, 0.14, 1.4, "#403124", [bx, 0.3, bz], LAYER.far);
    }

    // Floating Water Lilies & Lotus Flowers
    for (let index = 0; index < 22; index += 1) {
      const lx = -25 + marsh() * 50, lz = -12 - marsh() * 32;
      put(scene, new THREE.Mesh(new THREE.CircleGeometry(0.4 + marsh() * 0.3, 8), surface(THREE, "#3b6b41")), LAYER.far, [lx, 0.03, lz], [-Math.PI / 2, 0, 0]);
      if (index % 3 === 0) sphere(THREE, scene, 0.14, index % 6 === 0 ? "#f472b6" : "#ffffff", [lx, 0.12, lz], LAYER.far);
    }

    // Driftwood stumps & Buoy markers
    cylinder(THREE, scene, 0.22, 0.35, 1.6, "#47362b", [-6, 0.55, -18], LAYER.far, { rotation: [0.3, 0.2, 0] });
    cylinder(THREE, scene, 0.18, 0.3, 1.8, "#3d2e24", [8, 0.65, -22], LAYER.far, { rotation: [-0.2, 0.4, 0] });
    cylinder(THREE, scene, 0.24, 0.3, 0.8, "#ef4444", [-2, 0.35, -16], LAYER.far);
    sphere(THREE, scene, 0.2, "#ffffff", [-2, 0.85, -16], LAYER.far);
    cylinder(THREE, scene, 0.24, 0.3, 0.8, "#ef4444", [3, 0.35, -24], LAYER.far);
    sphere(THREE, scene, 0.2, "#ffffff", [3, 0.85, -24], LAYER.far);

    return {};
  },

  sports(THREE, scene) {
    slab(THREE, scene, 700, 700, "#4d8049", [0, -0.02, -60], LAYER.far);
    slab(THREE, scene, 130, 64, "#c76a4b", [0, 0.01, -24], LAYER.far);
    slab(THREE, scene, 96, 34, "#5b9350", [0, 0.02, -24], LAYER.far);
    for (let lane = 0; lane < 8; lane += 1) {
      slab(THREE, scene, 130, 0.14, "#f4f1e8", [0, 0.03, -40 + lane * 1.3], LAYER.far);
      slab(THREE, scene, 130, 0.14, "#f4f1e8", [0, 0.03, -8 - lane * 1.3], LAYER.far);
    }
    slab(THREE, scene, 0.5, 12, "#f4f1e8", [0, 0.04, -18], LAYER.far, { spin: Math.PI / 2 });
    const stand = rand(17);
    block(THREE, scene, [140, 13, 3], "#5b6577", [0, 6.5, -76], LAYER.far);
    for (let tier = 0; tier < 7; tier += 1) {
      block(THREE, scene, [140, 1.5, 2.8], tier % 2 ? "#525d6e" : "#5e6b7e", [0, 0.75 + tier * 1.5, -60 - tier * 2.4], LAYER.far);
      for (let seat = 0; seat < 28; seat += 1) block(THREE, scene, [3.6, 0.72, 1.6], stand() > 0.5 ? "#e0714c" : "#ecdfc0", [-66 + seat * 5, 1.75 + tier * 1.5, -59 - tier * 2.4], LAYER.far);
    }
    for (const side of [-1, 1]) {
      block(THREE, scene, [1, 26, 1], "#9aa2ab", [side * 54, 13, -74], LAYER.far);
      block(THREE, scene, [12, 2.6, 1], "#f6f8f8", [side * 54, 26, -74], LAYER.far, { emissive: new THREE.Color("#fff6dd"), emissiveIntensity: 1 });
      for (let flag = 0; flag < 5; flag += 1) block(THREE, scene, [0.9, 0.6, 0.05], flag % 2 ? "#e0714c" : "#4f8fd0", [side * (20 + flag * 5), 4.4, -52], LAYER.far);
    }
    for (let index = 0; index < 6; index += 1) block(THREE, scene, [1.4, 0.9, 0.6], "#dbd5c3", [-9 + index * 3.6, 0.45, -5.4], LAYER.near);
    block(THREE, scene, [40, 0.16, 0.5], "#f4f1e8", [0, 0.05, -6.2], LAYER.near);

    // Stadium Electronic Jumbotron Scoreboard
    for (const sx of [-14, 14]) cylinder(THREE, scene, 0.45, 0.45, 18, "#374151", [sx, 9, -62], LAYER.far);
    block(THREE, scene, [28, 9, 1.2], "#1f2937", [0, 15, -62], LAYER.far);
    block(THREE, scene, [25, 7, 0.2], "#0f172a", [0, 15, -61.3], LAYER.far, { emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.9 });
    block(THREE, scene, [20, 1.5, 0.1], "#f59e0b", [0, 17.5, -61.2], LAYER.far, { emissive: new THREE.Color("#fbbf24"), emissiveIntensity: 1.5 });

    // High Jump Equipment in inner field
    block(THREE, scene, [5.0, 0.8, 3.5], "#2563eb", [-15, 0.4, -20], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 2.5, "#9ca3af", [-17.4, 1.25, -20], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 2.5, "#9ca3af", [-12.6, 1.25, -20], LAYER.far);
    block(THREE, scene, [5.2, 0.06, 0.06], "#f59e0b", [-15, 2.2, -20], LAYER.far);

    // Sprint Hurdles on Lane 7
    for (let h = 0; h < 5; h += 1) {
      block(THREE, scene, [1.1, 0.75, 0.08], "#e5e7eb", [11.5, 0.38, -10 - h * 5], LAYER.far);
      block(THREE, scene, [1.1, 0.14, 0.1], "#dc2626", [11.5, 0.75, -10 - h * 5], LAYER.far);
    }

    // Press Photographer Station near finish line
    block(THREE, scene, [2.5, 0.75, 0.8], "#4b5563", [-8, 0.38, -6.5], LAYER.near);
    cylinder(THREE, scene, 0.04, 0.04, 1.2, "#1f2937", [-6.8, 0.6, -6.2], LAYER.near, { rotation: [0.2, 0, 0.1] });
    block(THREE, scene, [0.3, 0.2, 0.22], "#111827", [-6.8, 1.25, -6.2], LAYER.near);
    cylinder(THREE, scene, 0.08, 0.1, 0.4, "#374151", [-6.8, 1.25, -5.9], LAYER.near, { rotation: [Math.PI / 2, 0, 0] });

    // Athlete Refreshment Canopy Tent
    block(THREE, scene, [3.5, 0.1, 2.6], "#ffffff", [8, 2.2, -6.5], LAYER.near);
    for (const [tx, tz] of [[6.3, -7.7], [9.7, -7.7], [6.3, -5.3], [9.7, -5.3]]) cylinder(THREE, scene, 0.05, 0.05, 2.2, "#9ca3af", [tx, 1.1, tz], LAYER.near);
    block(THREE, scene, [2.6, 0.75, 0.7], "#f3f4f6", [8, 0.38, -6.5], LAYER.near);
    for (let c = 0; c < 6; c += 1) cylinder(THREE, scene, 0.04, 0.03, 0.12, "#2563eb", [7.0 + c * 0.4, 0.81, -6.5], LAYER.near);

    // Grand Entrance Archway
    block(THREE, scene, [2.2, 7.0, 2.2], "#374151", [-28, 3.5, -28], LAYER.far);
    block(THREE, scene, [2.2, 7.0, 2.2], "#374151", [-28, 3.5, -12], LAYER.far);
    block(THREE, scene, [2.2, 1.5, 18], "#e11d48", [-28, 7.0, -20], LAYER.far, { emissive: new THREE.Color("#be123c"), emissiveIntensity: 0.6 });

    return {};
  },

  portrait(THREE, scene) {
    // At 85 mm from 4.2 m the frame is barely 1.8 m wide, so everything that
    // matters is packed onto the back wall directly behind the subject.
    slab(THREE, scene, 12, 12, "#946a44", [0, 0, -4], LAYER.far);
    slab(THREE, scene, 12, 12, "#e6dfd0", [0, 3.1, -4], LAYER.far);
    slab(THREE, scene, 4.6, 3.4, "#b9836a", [0, 0.02, -4.6], LAYER.far);
    block(THREE, scene, [12, 3.1, 0.2], "#e3d8c2", [0, 1.55, -6.6], LAYER.far);
    block(THREE, scene, [12, 0.9, 0.26], "#cbbda2", [0, 0.45, -6.55], LAYER.far);
    block(THREE, scene, [0.2, 3.1, 8], "#dacfb8", [-3.2, 1.55, -4], LAYER.far);
    block(THREE, scene, [0.2, 3.1, 8], "#dacfb8", [3.2, 1.55, -4], LAYER.far);
    block(THREE, scene, [1.15, 1.95, 0.1], "#fff6e2", [-1.05, 1.62, -6.5], LAYER.far, { emissive: new THREE.Color("#fff3d6"), emissiveIntensity: 1.9 });
    for (const offset of [-0.38, 0.38]) block(THREE, scene, [0.07, 2, 0.14], "#9c8a6e", [-1.05 + offset, 1.62, -6.42], LAYER.far);
    block(THREE, scene, [1.2, 0.09, 0.14], "#9c8a6e", [-1.05, 1.62, -6.42], LAYER.far);
    for (const side of [-1, 1]) block(THREE, scene, [0.4, 2.35, 0.12], "#c98f7a", [-1.05 + side * 0.8, 1.5, -6.38], LAYER.far);
    block(THREE, scene, [0.85, 1.1, 0.07], "#8b6f4e", [1.05, 1.9, -6.46], LAYER.far);
    block(THREE, scene, [0.72, 0.95, 0.02], "#f0e7d2", [1.05, 1.9, -6.41], LAYER.far);
    block(THREE, scene, [1.2, 0.06, 0.4], "#7d5b3d", [1.75, 1.15, -6.3], LAYER.far);
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.19, 0.4, 8), surface(THREE, "#c98a5e")), LAYER.far, [-2.55, 0.2, -5.4], null);
    for (let leaf = 0; leaf < 9; leaf += 1) put(scene, new THREE.Mesh(new THREE.ConeGeometry(0.15, 1, 4), surface(THREE, "#568a4c")), LAYER.far, [-2.55 + Math.cos(leaf) * 0.18, 0.85, -5.4 + Math.sin(leaf) * 0.18], [Math.cos(leaf) * 0.4, leaf, Math.sin(leaf) * 0.4]);
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.3, 12), surface(THREE, "#f2e2bd", { emissive: new THREE.Color("#ffdf9e"), emissiveIntensity: 1.4 })), LAYER.far, [1.75, 1.33, -6.3], null);

    // Foreground curtain moved to frame edge so the view in front of the camera is unobstructed.
    block(THREE, scene, [0.14, 2.6, 0.08], "#b07a63", [-2.8, 1.3, -1.4], LAYER.near);
    put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), surface(THREE, "#d98f63")), LAYER.near, [-2.6, 1.02, -1.5], null);

    // Cozy Armchair & Pillow (positioned tightly behind sitter to left)
    block(THREE, scene, [0.8, 0.35, 0.8], "#7c3aed", [-1.15, 0.25, -4.6], LAYER.far, { rotation: [0, 0.3, 0] });
    block(THREE, scene, [0.8, 0.75, 0.16], "#6d28d9", [-1.15, 0.7, -4.95], LAYER.far, { rotation: [-0.1, 0.3, 0] });
    block(THREE, scene, [0.18, 0.45, 0.75], "#5b21b6", [-1.5, 0.45, -4.6], LAYER.far, { rotation: [0, 0.3, 0] });
    block(THREE, scene, [0.18, 0.45, 0.75], "#5b21b6", [-0.8, 0.45, -4.6], LAYER.far, { rotation: [0, 0.3, 0] });
    block(THREE, scene, [0.3, 0.3, 0.12], "#f59e0b", [-1.15, 0.55, -4.8], LAYER.far, { rotation: [0.1, 0.3, 0.2] });

    // Floor Standing Lamp
    cylinder(THREE, scene, 0.03, 0.03, 1.7, "#d97706", [-1.75, 0.85, -4.5], LAYER.far);
    cylinder(THREE, scene, 0.2, 0.35, 0.4, "#fffbebf0", [-1.75, 1.7, -4.5], LAYER.far, { emissive: new THREE.Color("#fef3c7"), emissiveIntensity: 1.5 });

    // Wall Bookshelf & Books on right back wall
    block(THREE, scene, [1.2, 0.05, 0.25], "#78350f", [1.15, 2.0, -6.3], LAYER.far);
    block(THREE, scene, [1.2, 0.05, 0.25], "#78350f", [1.15, 1.35, -6.3], LAYER.far);
    const bookColors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
    for (let b = 0; b < 5; b += 1) {
      block(THREE, scene, [0.08, 0.28 + (b % 3) * 0.04, 0.2], bookColors[b], [0.75 + b * 0.12, 2.15, -6.3], LAYER.far);
    }
    cylinder(THREE, scene, 0.07, 0.05, 0.22, "#38bdf8", [1.5, 1.48, -6.3], LAYER.far);

    // Tea Table & Tea Set to right of sitter
    cylinder(THREE, scene, 0.36, 0.36, 0.04, "#92400e", [0.75, 0.42, -4.5], LAYER.far);
    cylinder(THREE, scene, 0.04, 0.04, 0.4, "#78350f", [0.75, 0.2, -4.5], LAYER.far);
    sphere(THREE, scene, 0.08, "#f3f4f6", [0.7, 0.5, -4.5], LAYER.far);
    cylinder(THREE, scene, 0.05, 0.04, 0.05, "#ffffff", [0.88, 0.47, -4.45], LAYER.far);

    // Monstera Plant in corner
    cylinder(THREE, scene, 0.22, 0.16, 0.4, "#b45309", [1.65, 0.2, -5.2], LAYER.far);
    for (let l = 0; l < 5; l += 1) put(scene, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 4), surface(THREE, "#15803d")), LAYER.far, [1.65 + Math.cos(l * 1.2) * 0.18, 0.55 + l * 0.1, -5.2 + Math.sin(l * 1.2) * 0.18], [Math.cos(l) * 0.4, l, Math.sin(l) * 0.4]);

    // Vintage Wall Clock & Wainscoting Panel Strips
    cylinder(THREE, scene, 0.22, 0.22, 0.04, "#78350f", [0.6, 2.1, -6.38], LAYER.far, { rotation: [Math.PI / 2, 0, 0] });
    cylinder(THREE, scene, 0.19, 0.19, 0.05, "#fef3c7", [0.6, 2.1, -6.37], LAYER.far, { rotation: [Math.PI / 2, 0, 0] });
    for (let p = -5; p <= 5; p += 1) block(THREE, scene, [0.04, 0.9, 0.05], "#a16207", [p * 1.1, 0.45, -6.48], LAYER.far);

    return {};
  },

  group(THREE, scene) {
    slab(THREE, scene, 400, 400, "#b7b09c", [0, 0, -40], LAYER.far);
    slab(THREE, scene, 24, 18, "#cec6ae", [0, 0.02, -8], LAYER.far);
    const park = rand(61);
    for (let index = 0; index < 16; index += 1) tree(THREE, scene, [(index % 2 ? 1 : -1) * (6 + park() * 22), 0, -13 - park() * 26], LAYER.far, 1.5 + park() * 1.5, "#4f7d41");
    for (let index = 0; index < 6; index += 1) facadeBlock(THREE, scene, [12 + park() * 8, 18 + park() * 16, 12], [-60 + index * 24, 12, -74 - park() * 26], LAYER.far, facadeTexture(THREE, { base: "#bdb49f", frame: "#8d8676", glass: "#dde5e8", lit: 0.25, seed: 3 + index }));
    block(THREE, scene, [5.2, 0.18, 0.5], "#8d7a5e", [-0.2, 0.46, -9.4], LAYER.far);
    for (const x of [-2.4, 2]) block(THREE, scene, [0.18, 0.46, 0.5], "#6f6250", [x, 0.23, -9.4], LAYER.far);
    for (let index = 0; index < 14; index += 1) put(scene, new THREE.Mesh(new THREE.SphereGeometry(0.1 + park() * 0.08, 7, 5), surface(THREE, index % 3 === 0 ? "#d76f6c" : index % 3 === 1 ? "#e0b45c" : "#7fb46a")), LAYER.near, [-4.2 + index * 0.62, 0.16, -3.6 - park() * 0.7], null);

    // Park Fountain (positioned directly behind group for magnificent bokeh)
    cylinder(THREE, scene, 2.2, 2.4, 0.5, "#9ca3af", [0, 0.25, -16], LAYER.far);
    cylinder(THREE, scene, 2.0, 2.0, 0.4, "#38bdf8", [0, 0.28, -16], LAYER.far, { emissive: new THREE.Color("#0284c7"), emissiveIntensity: 0.4 });
    cylinder(THREE, scene, 0.4, 0.5, 1.2, "#9ca3af", [0, 0.85, -16], LAYER.far);
    cylinder(THREE, scene, 1.0, 1.1, 0.3, "#9ca3af", [0, 1.45, -16], LAYER.far);
    sphere(THREE, scene, 0.55, "#e0f2fe", [0, 1.8, -16], LAYER.far, { emissive: new THREE.Color("#7dd3fc"), emissiveIntensity: 0.6 }, 10, 6);

    // Twin-head Ornate Street Lamps (framing group left & right)
    for (const lx of [-4.5, 4.5]) {
      cylinder(THREE, scene, 0.08, 0.12, 3.8, "#374151", [lx, 1.9, -11], LAYER.far);
      block(THREE, scene, [1.2, 0.08, 0.08], "#374151", [lx, 3.7, -11], LAYER.far);
      sphere(THREE, scene, 0.2, "#fef08a", [lx - 0.5, 3.7, -11], LAYER.far, { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 1.3 });
      sphere(THREE, scene, 0.2, "#fef08a", [lx + 0.5, 3.7, -11], LAYER.far, { emissive: new THREE.Color("#fef08a"), emissiveIntensity: 1.3 });
    }

    // Leaning City Bicycle
    cylinder(THREE, scene, 0.35, 0.35, 0.04, "#1f2937", [-2.2, 0.35, -9.2], LAYER.far, { rotation: [0, 0.3, Math.PI / 2] });
    cylinder(THREE, scene, 0.35, 0.35, 0.04, "#1f2937", [-1.2, 0.35, -9.2], LAYER.far, { rotation: [0, 0.3, Math.PI / 2] });
    block(THREE, scene, [1.0, 0.05, 0.05], "#ef4444", [-1.7, 0.45, -9.2], LAYER.far, { rotation: [0.2, 0.3, 0.3] });

    // Picnic Table with Umbrella
    block(THREE, scene, [2.2, 0.1, 1.2], "#854d0e", [5.5, 0.75, -15], LAYER.far);
    for (const [px, pz] of [[4.6, -15.4], [6.4, -15.4], [4.6, -14.6], [6.4, -14.6]]) cylinder(THREE, scene, 0.06, 0.06, 0.75, "#713f12", [px, 0.375, pz], LAYER.far);
    block(THREE, scene, [2.2, 0.08, 0.35], "#854d0e", [5.5, 0.42, -15.9], LAYER.far);
    block(THREE, scene, [2.2, 0.08, 0.35], "#854d0e", [5.5, 0.42, -14.1], LAYER.far);
    cylinder(THREE, scene, 0.04, 0.04, 2.6, "#e5e7eb", [5.5, 1.3, -15], LAYER.far);
    peak(THREE, scene, 1.8, 0.6, "#0284c7", [5.5, 2.6, -15], LAYER.far, 8);

    // Park Map Kiosk
    block(THREE, scene, [1.4, 1.0, 0.1], "#b45309", [-5.5, 1.2, -14], LAYER.far);
    block(THREE, scene, [1.2, 0.8, 0.02], "#fef08a", [-5.5, 1.2, -13.94], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 1.2, "#78350f", [-6.0, 0.6, -14], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 1.2, "#78350f", [-5.0, 0.6, -14], LAYER.far);

    // Low Stone Flowerbed Borders
    block(THREE, scene, [5.6, 0.12, 0.2], "#9ca3af", [-0.2, 0.06, -3.2], LAYER.near);
    block(THREE, scene, [5.6, 0.12, 0.2], "#9ca3af", [-0.2, 0.06, -4.8], LAYER.near);

    return {};
  },

  street(THREE, scene) {
    slab(THREE, scene, 600, 600, "#3c3f44", [0, 0, -80], LAYER.far);
    slab(THREE, scene, 11, 300, "#4a4e54", [0, 0.01, -80], LAYER.far);
    for (let stripe = 0; stripe < 26; stripe += 1) slab(THREE, scene, 0.35, 2.4, "#e5e2d6", [0, 0.03, -6 - stripe * 6], LAYER.far);
    for (const side of [-1, 1]) {
      block(THREE, scene, [9, 0.24, 300], "#8d8b84", [side * 10, 0.12, -80], LAYER.far);
      const city = rand(side > 0 ? 23 : 71);
      for (let index = 0; index < 12; index += 1) {
        const depth = -10 - index * 13 - city() * 5, height = 12 + city() * 22;
        facadeBlock(THREE, scene, [9 + city() * 4, height, 11], [side * (16 + city() * 3), height / 2, depth], LAYER.far, facadeTexture(THREE, { base: index % 2 ? "#b0a091" : "#95958f", frame: "#6f6b63", glass: "#d9e4e8", lit: 0.2, seed: index + (side > 0 ? 5 : 40) }));
        block(THREE, scene, [7, 0.35, 2.6], side > 0 ? "#c2624a" : "#4f7f8c", [side * 11.6, 3.4, depth + 3], LAYER.far);
      }
      for (let index = 0; index < 8; index += 1) {
        block(THREE, scene, [0.22, 5.4, 0.22], "#4c5157", [side * 6.4, 2.7, -12 - index * 17], LAYER.far);
        block(THREE, scene, [1.5, 0.3, 0.4], "#dfe3e0", [side * 5.9, 5.4, -12 - index * 17], LAYER.far, { emissive: new THREE.Color("#fff2cf"), emissiveIntensity: 0.5 });
      }
    }
    block(THREE, scene, [1.9, 1.3, 4.4], "#c0563f", [-3.4, 0.85, -24], LAYER.far);
    block(THREE, scene, [1.7, 0.8, 2], "#2c3138", [-3.4, 1.75, -24.4], LAYER.far);
    block(THREE, scene, [1.9, 1.3, 4.4], "#3f6f9c", [3.4, 0.85, -38], LAYER.far);
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1, 8), surface(THREE, "#5a5f65")), LAYER.near, [-5.2, 0.5, -3.2], null);
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1, 8), surface(THREE, "#5a5f65")), LAYER.near, [5.2, 0.5, -3.6], null);
    block(THREE, scene, [1.4, 1.1, 0.9], "#4b7f66", [6.4, 0.55, -2.9], LAYER.near);

    // Bus Stop Shelter (placed cleanly on left sidewalk)
    block(THREE, scene, [3.0, 2.2, 0.08], "#e0f2fe", [-7.2, 1.1, -11], LAYER.far, { opacity: 0.6, transparent: true });
    block(THREE, scene, [3.2, 0.15, 1.3], "#374151", [-7.2, 2.2, -10.4], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 2.2, "#4b5563", [-8.6, 1.1, -11], LAYER.far);
    cylinder(THREE, scene, 0.06, 0.06, 2.2, "#4b5563", [-5.8, 1.1, -11], LAYER.far);
    block(THREE, scene, [2.2, 0.08, 0.4], "#9a3412", [-7.2, 0.45, -10.8], LAYER.far);
    cylinder(THREE, scene, 0.04, 0.04, 2.4, "#2563eb", [-5.2, 1.2, -10], LAYER.far);
    cylinder(THREE, scene, 0.25, 0.25, 0.05, "#ffffff", [-5.2, 2.4, -10], LAYER.far, { rotation: [Math.PI / 2, 0, 0] });

    // Traffic Light & Pedestrian Signal Pole
    cylinder(THREE, scene, 0.08, 0.1, 5.5, "#374151", [5.2, 2.75, -20], LAYER.far);
    block(THREE, scene, [3.5, 0.08, 0.08], "#374151", [3.6, 5.3, -20], LAYER.far);
    block(THREE, scene, [0.3, 0.9, 0.3], "#1f2937", [2.6, 5.1, -20], LAYER.far);
    sphere(THREE, scene, 0.08, "#ef4444", [2.6, 5.35, -19.84], LAYER.far, { emissive: new THREE.Color("#ef4444"), emissiveIntensity: 1.5 });
    sphere(THREE, scene, 0.08, "#eab308", [2.6, 5.1, -19.84], LAYER.far, { emissive: new THREE.Color("#eab308"), emissiveIntensity: 1.5 });
    sphere(THREE, scene, 0.08, "#22c55e", [2.6, 4.85, -19.84], LAYER.far, { emissive: new THREE.Color("#22c55e"), emissiveIntensity: 1.5 });

    // Outdoor Bistro Cafe Setup on left sidewalk outside building facade
    cylinder(THREE, scene, 0.4, 0.4, 0.04, "#d1d5db", [-7.8, 0.72, -18], LAYER.far);
    cylinder(THREE, scene, 0.04, 0.04, 0.7, "#4b5563", [-7.8, 0.35, -18], LAYER.far);
    block(THREE, scene, [0.35, 0.4, 0.35], "#ef4444", [-8.4, 0.2, -18], LAYER.far);
    block(THREE, scene, [0.35, 0.4, 0.35], "#ef4444", [-7.2, 0.2, -18], LAYER.far);
    cylinder(THREE, scene, 0.04, 0.04, 2.5, "#ffffff", [-7.8, 1.25, -18], LAYER.far);
    peak(THREE, scene, 1.5, 0.5, "#dc2626", [-7.8, 2.5, -18], LAYER.far, 6);

    // Drink Vending Machine against right building wall facade (x=8.5)
    block(THREE, scene, [1.1, 2.0, 0.8], "#2563eb", [8.5, 1.0, -15], LAYER.far);
    block(THREE, scene, [0.9, 1.0, 0.05], "#93c5fd", [8.5, 1.2, -14.58], LAYER.far, { emissive: new THREE.Color("#60a5fa"), emissiveIntensity: 1.2 });
    block(THREE, scene, [0.4, 0.3, 0.05], "#1e293b", [8.5, 0.35, -14.58], LAYER.far);

    // Street Newsstand Kiosk on left sidewalk (x=-7.8)
    block(THREE, scene, [2.0, 2.0, 1.4], "#15803d", [-7.8, 1.0, -28], LAYER.far);
    block(THREE, scene, [2.3, 0.15, 1.6], "#f59e0b", [-7.8, 2.0, -27.9], LAYER.far);
    block(THREE, scene, [1.8, 0.8, 0.2], "#fef08a", [-7.8, 0.4, -27.2], LAYER.far);

    // Parking Meters & Bicycle Rack at curb lines
    cylinder(THREE, scene, 0.04, 0.04, 1.1, "#6b7280", [-5.2, 0.55, -7], LAYER.far);
    block(THREE, scene, [0.2, 0.25, 0.12], "#374151", [-5.2, 1.1, -7], LAYER.far);
    block(THREE, scene, [1.8, 0.6, 0.08], "#4b5563", [5.2, 0.3, -8], LAYER.far);
    cylinder(THREE, scene, 0.3, 0.3, 0.04, "#1f2937", [5.2, 0.3, -8], LAYER.far, { rotation: [0, 0, Math.PI / 2] });

    return {};
  },

  night(THREE, scene) {
    slab(THREE, scene, 600, 600, "#14161d", [0, 0, -80], LAYER.far);
    slab(THREE, scene, 12, 260, "#1b1f2a", [0, 0.01, -70], LAYER.far, { emissive: new THREE.Color("#2a2440"), emissiveIntensity: 0.5 });
    const city = rand(89);
    const neon = ["#ff5d8f", "#4fd1ff", "#ffc94f", "#9d7bff", "#4fffa8"];
    for (const side of [-1, 1]) {
      for (let index = 0; index < 13; index += 1) {
        const depth = -8 - index * 12 - city() * 4, height = 16 + city() * 30;
        facadeBlock(THREE, scene, [9 + city() * 4, height, 11], [side * (15 + city() * 3), height / 2, depth], LAYER.far, facadeTexture(THREE, { base: "#0d0f16", frame: "#191d28", glass: "#ffd489", lit: 0.5, seed: index * 3 + (side > 0 ? 2 : 30) }), "#c8ccd8", "#7d5c2a");
        const color = neon[Math.floor(city() * neon.length) % neon.length];
        block(THREE, scene, [0.4, 3.6 + city() * 2.4, 0.4], color, [side * 10.2, 5 + city() * 7, depth + 2], LAYER.far, { emissive: new THREE.Color(color), emissiveIntensity: 2.4 });
        block(THREE, scene, [3.6, 0.7, 0.3], color, [side * 12, 8 + city() * 6, depth - 1], LAYER.far, { emissive: new THREE.Color(color), emissiveIntensity: 2.1 });
        put(scene, new THREE.Mesh(new THREE.PlaneGeometry(1.6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.16, depthWrite: false })), LAYER.far, [side * 4.6, 0.05, depth + 6], [-Math.PI / 2, 0, 0]);
      }
    }
    for (const [x, z, color] of [[-6, -18, "#ff5d8f"], [6, -26, "#4fd1ff"]]) {
      const lamp = new THREE.PointLight(new THREE.Color(color), 26, 34, 2);
      lamp.position.set(x, 6, z); lamp.layers.enableAll(); scene.add(lamp);
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 18, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#cdd6ff") }));
    moon.userData.isCelestial = true;
    // The moon is a celestial object: an AF frame over it means infinity.
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

    block(THREE, scene, [1.3, 1, 0.8], "#2a3040", [5.6, 0.5, -3.1], LAYER.near);
    put(scene, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.1, 8), surface(THREE, "#252b38")), LAYER.near, [-5.4, 0.55, -3.4], null);

    // Rising Manhole Steam in street
    cylinder(THREE, scene, 0.45, 0.45, 0.04, "#374151", [0, 0.02, -10], LAYER.far);
    cylinder(THREE, scene, 0.4, 0.8, 2.5, "#e2e8f0", [0, 1.25, -10], LAYER.far, { opacity: 0.18, transparent: true, emissive: new THREE.Color("#38bdf8"), emissiveIntensity: 0.4 });

    // Japanese Ramen Shop Storefront (on left sidewalk facade niche x=-8.5)
    block(THREE, scene, [3.6, 2.5, 0.8], "#1c1917", [-8.5, 1.25, -11.5], LAYER.far);
    sphere(THREE, scene, 0.25, "#ef4444", [-7.2, 2.1, -11.0], LAYER.far, { emissive: new THREE.Color("#ff2222"), emissiveIntensity: 2.8 });
    sphere(THREE, scene, 0.25, "#ef4444", [-9.8, 2.1, -11.0], LAYER.far, { emissive: new THREE.Color("#ff2222"), emissiveIntensity: 2.8 });
    block(THREE, scene, [2.0, 0.6, 0.04], "#991b1b", [-8.5, 1.85, -11.08], LAYER.far, { emissive: new THREE.Color("#7f1d1d"), emissiveIntensity: 0.8 });

    // Concrete Utility Pole & Overhead Cables
    cylinder(THREE, scene, 0.12, 0.15, 9.0, "#292524", [5.2, 4.5, -13], LAYER.far);
    block(THREE, scene, [1.8, 0.1, 0.1], "#44403c", [5.2, 8.2, -13], LAYER.far);
    for (let c = 0; c < 3; c += 1) {
      block(THREE, scene, [14, 0.02, 0.02], "#1c1917", [0, 8.0 + c * 0.3, -13], LAYER.far);
    }

    // Glowing ATM Kiosk & Vending Machine against right facade wall (x=8.2)
    block(THREE, scene, [1.0, 2.1, 0.8], "#0284c7", [8.2, 1.05, -16], LAYER.far);
    block(THREE, scene, [0.8, 0.7, 0.05], "#38bdf8", [8.2, 1.4, -15.58], LAYER.far, { emissive: new THREE.Color("#00e5ff"), emissiveIntensity: 2.2 });
    block(THREE, scene, [1.1, 2.0, 0.8], "#dc2626", [8.2, 1.0, -21], LAYER.far);
    block(THREE, scene, [0.9, 1.0, 0.05], "#fef08a", [8.2, 1.2, -20.58], LAYER.far, { emissive: new THREE.Color("#ffee00"), emissiveIntensity: 2.0 });

    // Rooftop Structural Neon & Directional Arrow
    block(THREE, scene, [6, 4, 0.2], "#334155", [-12, 18, -25], LAYER.far);
    block(THREE, scene, [5.4, 3.4, 0.1], "#a855f7", [-12, 18, -24.9], LAYER.far, { emissive: new THREE.Color("#d8b4fe"), emissiveIntensity: 2.6 });
    peak(THREE, scene, 0.8, 1.5, "#22c55e", [8.2, 5.5, -10], LAYER.far, 3);

    // Illuminated Bus Shelter & Puddle Reflection (left sidewalk x=-7.0)
    block(THREE, scene, [3.0, 2.2, 1.2], "#1e293b", [-7.0, 1.1, -7.5], LAYER.far);
    block(THREE, scene, [1.0, 1.8, 0.05], "#f43f5e", [-8.2, 1.1, -6.88], LAYER.far, { emissive: new THREE.Color("#fb7185"), emissiveIntensity: 2.2 });
    put(scene, new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fb7185"), transparent: true, opacity: 0.25, depthWrite: false })), LAYER.far, [-7.0, 0.03, -7.5], [-Math.PI / 2, 0, 0]);

    return {
      updaters: [(elapsed) => {
        const drop = (elapsed * 16) % 6;
        rain.position.y = -drop; rainNear.position.y = -drop * 1.4;
      }],
    };
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
    const colors = ["#ffffff", "#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
    for (let index = 0; index < 5; index += 1) {
      const mesh = billboard(THREE, scene, { ...SUBJECT_ART.sports, height: 1.5 }, colors[index]);
      subjects.push(mesh);
      shadows.push(contactShadow(THREE, scene, 0.5));
    }
  } else if (key === "portrait") {
    const sitter = billboard(THREE, scene, { ...SUBJECT_ART.portrait, height: 1.5 });
    subjects.push(sitter);
    shadows.push(contactShadow(THREE, scene, 0.42));

    const cat = build3DCat(THREE, "#ea580c"); scene.add(cat);
    subjects.push(cat);
    shadows.push(contactShadow(THREE, scene, 0.3));
  } else if (key === "group") {
    const groupMembers = [
      characterTexture(THREE, { skin: "#ffe0bd", hair: "#4a2e1b", top: "#ef4444", bottom: "#1d4ed8", hat: "#dc2626" }),
      characterTexture(THREE, { skin: "#fde047", hair: "#0f172a", top: "#10b981", bottom: "#334155", glasses: true }),
      characterTexture(THREE, { skin: "#fed7aa", hair: "#d97706", top: "#8b5cf6", bottom: "#1e293b" }),
      characterTexture(THREE, { skin: "#ffedd5", hair: "#2563eb", top: "#f59e0b", bottom: "#475569", hat: "#0284c7" }),
      characterTexture(THREE, { skin: "#fecdd3", hair: "#b91c1c", top: "#ec4899", bottom: "#0f172a", glasses: true }),
      characterTexture(THREE, { skin: "#e0e7ff", hair: "#047857", top: "#2563eb", bottom: "#1f2937" }),
      characterTexture(THREE, { skin: "#fef08a", hair: "#6b21a8", top: "#059669", bottom: "#451a03", hat: "#d97706" }),
    ];
    for (const [index, texture] of groupMembers.entries()) {
      const mesh = billboard(THREE, scene, { texture, height: 1.5 + (index % 3) * 0.06 });
      subjects.push(mesh);
      shadows.push(contactShadow(THREE, scene, 0.45));
    }
  } else if (key === "street") {
    const ped1 = billboard(THREE, scene, { ...SUBJECT_ART.street, height: 1.3 });
    const ped2 = billboard(THREE, scene, { texture: characterTexture(THREE, { skin: "#fed7aa", hair: "#1e293b", top: "#06b6d4", bottom: "#334155" }), height: 1.35 });
    const car = build3DCar(THREE, "#dc2626"); scene.add(car);
    const scooter = build3DScooter(THREE, "#2563eb"); scene.add(scooter);
    const dog = build3DDog(THREE, "#d97706"); scene.add(dog);
    const pigeons = build3DBird(THREE, "#64748b"); scene.add(pigeons);

    subjects.push(ped1, ped2, car, scooter, dog, pigeons);
    for (let i = 0; i < 6; i += 1) shadows.push(contactShadow(THREE, scene, 0.5));
  } else if (key === "night") {
    const ped1 = billboard(THREE, scene, { ...SUBJECT_ART.night, height: 1.35 }, "#b9bed6");
    const ped2 = billboard(THREE, scene, { texture: characterTexture(THREE, { skin: "#fcd34d", hair: "#475569", top: "#a855f7", bottom: "#1e1b4b" }), height: 1.3 }, "#b9bed6");
    const taxi = build3DCar(THREE, "#eab308", true); scene.add(taxi);
    const scooter = build3DScooter(THREE, "#06b6d4"); scene.add(scooter);
    const cat = build3DCat(THREE, "#1e1b4b"); scene.add(cat);
    const owl = build3DBird(THREE, "#38bdf8"); scene.add(owl);

    subjects.push(ped1, ped2, taxi, scooter, cat, owl);
    for (let i = 0; i < 6; i += 1) shadows.push(contactShadow(THREE, scene, 0.5));
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
    const batches = new Map();
    for (const object of [...scene.children]) {
      if (!object.isMesh || dynamicObjects.has(object) || object.userData.animated) continue;
      const material = object.material;
      if (Array.isArray(material) || material.transparent || material.map || material.type === "ShaderMaterial") continue;
      const signature = [object.layers.mask, material.type, material.color?.getHexString(), material.emissive?.getHexString(), material.emissiveIntensity ?? 0, material.side, material.flatShading, material.opacity].join(":");
      const batch = batches.get(signature) ?? [];
      batch.push(object);
      batches.set(signature, batch);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrix));
      const mergedGeometry = mergeGeometries(geometries, false);
      for (const geometry of geometries) geometry.dispose();
      if (!mergedGeometry) continue;
      const merged = new THREE.Mesh(mergedGeometry, meshes[0].material);
      merged.layers.mask = meshes[0].layers.mask;
      merged.matrixAutoUpdate = false;
      scene.add(merged);
      for (const [index, mesh] of meshes.entries()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (index) mesh.material.dispose();
      }
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
