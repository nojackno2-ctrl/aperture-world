import { DEPTH_BANDS, DEPTH_LAYER_BASE, SUBJECT_LAYER, WORLD, depthBandFor } from "./world.mjs";
import { lighting, skyDome } from "./scene-kit.mjs";

/**
 * Assembles the eleven playable worlds as real 3D geometry. `THREE` is passed in
 * so this module never pulls the renderer into the server bundle.
 *
 * Every mesh is assigned to a depth bucket (`LAYER.far` / `LAYER.subject` /
 * `LAYER.near`) so a capture can blur each band by its own circle of confusion.
 *
 * Each scenario's own geometry and cast live in `./scenes/<key>.mjs`, so a
 * session downloads the world it is about to photograph and not the other ten.
 */

export { BIRD_COUNT } from "./scene-kit.mjs";

/**
 * One static `import()` per scenario. A computed specifier would collapse the
 * eleven worlds back into a single chunk, which is exactly what this avoids.
 */
const SCENE_LOADERS = {
  landscape: () => import("./scenes/landscape.mjs"),
  bird: () => import("./scenes/bird.mjs"),
  sports: () => import("./scenes/sports.mjs"),
  portrait: () => import("./scenes/portrait.mjs"),
  group: () => import("./scenes/group.mjs"),
  street: () => import("./scenes/street.mjs"),
  night: () => import("./scenes/night.mjs"),
  starry: () => import("./scenes/starry.mjs"),
  city_night: () => import("./scenes/city_night.mjs"),
  airport: () => import("./scenes/airport.mjs"),
  outdoor_portrait: () => import("./scenes/outdoor_portrait.mjs"),
};

/** @typedef {{terrain: Function, cast: Function}} SceneModule */

/** Resolves the module holding one scenario's geometry and subjects. */
export function loadSceneModule(key) {
  return (SCENE_LOADERS[key] ?? SCENE_LOADERS.landscape)();
}

/**
 * Warms the remaining worlds when the viewport grants background transfer.
 * The caller supplies a cancellation check for visibility, play state, and
 * connection policy so optional chunks never outrank the active scene.
 */
export async function prefetchOtherScenes(key, shouldContinue = () => true) {
  for (const other of Object.keys(SCENE_LOADERS)) {
    if (other !== key) {
      if (!shouldContinue()) return false;
      // Keep prefetch best-effort and sequential. Starting ten imports together
      // can crowd the active scene off a mobile radio precisely when the player
      // has just entered the camera.
      try {
        await SCENE_LOADERS[other]();
      } catch {
        return false;
      }
    }
  }
  return true;
}

/**
 * Assembles one scenario: geometry, lighting, sky, and its moving subjects.
 *
 * @param {typeof import("three")} THREE
 * @param {keyof typeof SCENE_LOADERS} key
 * @param {Function} mergeGeometries
 * @param {SceneModule} sceneModule the resolved `./scenes/<key>.mjs`
 * @returns {{scene: object, subjects: object[], shadows: object[], updaters: Function[], world: object}}
 */
export function buildScene(THREE, key, mergeGeometries, sceneModule) {
  const world = WORLD[key] ?? WORLD.landscape;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(world.fog[0]), world.fog[1]);
  skyDome(THREE, scene, world.sky);
  const sun = lighting(THREE, scene, world, key);
  const extra = sceneModule.terrain(THREE, scene) ?? {};

  const subjects = [], shadows = [];
  sceneModule.cast(THREE, scene, subjects, shadows);

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

  // Depth banding. Three buckets blurred a hedge ten metres out by exactly the
  // amount computed for a ridge two kilometres away, so stopping down changed
  // almost nothing on screen. Re-file every static mesh by its measured distance
  // from the tripod instead. This runs before the batcher below, whose signature
  // already keys on the layer mask, so a band still costs one draw call.
  //
  // An object whose bounding sphere dwarfs its own centre distance — the sky
  // dome, a ground slab, a valley floor — reaches through too many bands to
  // belong to any of them. Those stay on the focused plane, which is what they
  // effectively were before, rather than being blurred as if they sat at their
  // own centre. Genuine props are compact, and they are where the falloff shows.
  scene.updateMatrixWorld(true);
  const eye = new THREE.Vector3(0, world.cameraHeight, 0);
  const centre = new THREE.Vector3();
  const focusLayer = DEPTH_LAYER_BASE + depthBandFor(key, world.focus);
  const horizonLayer = DEPTH_LAYER_BASE + DEPTH_BANDS - 1;
  const occupied = new Set();
  scene.traverse(object => {
    if (object === scene) return;
    // Every light has to reach every band, or a band renders unlit. Scene-level
    // lanterns and neon were previously visible only to the layer they defaulted
    // onto, which left subjects in the night worlds lit differently in the photo
    // than in the viewfinder.
    if (object.isLight) {
      object.layers.enableAll();
      if (object.shadow) object.shadow.camera.layers.enableAll();
      return;
    }
    if (!object.isMesh && !object.isPoints && !object.isLine) return;
    if (isDynamic(object)) {
      object.layers.set(SUBJECT_LAYER);
      occupied.add(SUBJECT_LAYER);
      return;
    }
    let layer = focusLayer;
    if (object.userData.infinite || object.userData.isCelestial) layer = horizonLayer;
    else if (object.geometry) {
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const sphere = object.geometry.boundingSphere;
      if (sphere) {
        centre.copy(sphere.center).applyMatrix4(object.matrixWorld);
        const distance = centre.distanceTo(eye);
        if (sphere.radius * object.matrixWorld.getMaxScaleOnAxis() <= distance * 0.75) {
          layer = DEPTH_LAYER_BASE + depthBandFor(key, distance);
        }
      }
    }
    object.layers.set(layer);
    occupied.add(layer);
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

  // Only the bands that actually hold geometry. An empty band still costs a
  // clear and a full-resolution readback per exposure sample, for nothing.
  return { scene, subjects, shadows, sun, updaters: extra.updaters ?? [], world, layers: [...occupied] };
}
