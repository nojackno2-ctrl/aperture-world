"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { DirectionalLight, Intersection, Material, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { exposureSamples, subjectPath } from "./motion.mjs";
import { trajectoryDistance, verticalFieldOfView } from "./optics.mjs";
import { captureSampleCount, cappedPixelRatio, nextPixelRatio, photoOutputSize, refreshTargetFps, shouldPrefetchScenes } from "./performance.mjs";
import { buildScene, loadSceneModule, prefetchOtherScenes } from "./scene3d.mjs";
import { disposeObjectTree } from "./three-lifecycle";
import { LAYER, WORLD, depthBlurPlan, viewMeterAdjustment } from "./world.mjs";

type SceneKey = keyof typeof WORLD;
/** Every scenario module exposes the same pair; the reference is type-only. */
type SceneModule = typeof import("./scenes/landscape.mjs");
type ThreeRuntime = typeof import("./three-runtime");
type ShadowMesh = Mesh & { material: MeshBasicMaterial };
type BuiltWorld = { key: SceneKey; scene: Scene; subjects: Object3D[]; shadows: ShadowMesh[]; sun: DirectionalLight; updaters: ((elapsed: number) => void)[]; world: { cameraHeight: number; pitch: number } };
/** What the AF frame is sitting on, and how far the subject itself now stands. */
export type FocusReading = { focusM: number; subjectM: number };
export type LightReading = { ev: number };
type Engine = {
  THREE: ThreeRuntime; renderer: WebGLRenderer; camera: PerspectiveCamera; built: BuiltWorld | null; sceneKey: SceneKey | null; elapsed: number; epoch: number; focus: FocusReading; probedAt: number;
  pixelRatio: number; maximumPixelRatio: number; projectionKey: string; scratch: ScratchPool; captureMaterials: Material[];
  aimCamera: (focalOverride?: number) => void; poseSubjects: (seconds: number) => void; castCenter: (x: number, y: number) => Intersection[]; probeFocus: (hits?: Intersection[]) => FocusReading; probeLight: (hits?: Intersection[]) => LightReading; mount: (key: SceneKey, sceneModule: SceneModule) => void; select: (key: SceneKey) => void; warmScenes: () => void; wake: () => void; teardown: () => void;
};
export type CaptureRequest = { focalMm: number; fNumber: number; shutterSeconds: number; brightness: number; noise: number; shakePx: number; lookTrajectory?: { yaw: number; pitch: number }[] };
// Full-size pixels are handed back as a promise for the raw Blob (encoded off
// the main thread by toBlob) so a 2000-shot library never holds 2000 base64
// strings on the JS heap. The caller owns the Blob and mints object URLs from
// it only when actually displaying a photo, so nothing here ties a URL's
// lifetime to this component. The thumbnail is small enough to stay a plain string.
export type CaptureResult = FocusReading & { width: number; height: number; thumb: string; image: Promise<Blob | null> };
export type ViewportHandle = { setLook: (look: { yaw: number; pitch: number }) => void; capture: (request: CaptureRequest) => CaptureResult | null };
type Props = { scene: SceneKey; focal: number; aimX: number; aimY: number; frozen?: boolean; onFocus?: (reading: FocusReading) => void; onLight?: (reading: LightReading) => void; onReady?: () => void };

const BUCKETS = [LAYER.far, LAYER.subject, LAYER.near] as const;
/** Nothing solid under the AF frame: the lens racks past the sky dome, to infinity. */
const INFINITY_FOCUS_M = 4000;
/** Re-reading the AF frame every frame is wasted work; the world moves slower than that. */
const FOCUS_PROBE_MS = 110;
const PERFORMANCE_SAMPLE_MS = 1000;
const LIGHT_METER_MS = 160;
const MOTION_PROBE_SEGMENTS = 8;
/** A reflected-light meter uses the same third-stop ladder as the camera controls; finer readings cannot change a setting. */
const METER_STEP_EV = 1 / 3;
const DEG2RAD = Math.PI / 180;

type Scratch = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
/** Surfaces a capture rewrites from scratch every time, so they can outlive one shot. */
type ScratchPool = { layers: (Scratch | null)[]; composite: Scratch | null; thumb: Scratch | null; noise: { tile: Scratch; image: ImageData } | null };

function scratchCanvas(width: number, height: number): Scratch {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  return { canvas, context: canvas.getContext("2d") as CanvasRenderingContext2D };
}

/**
 * A Hi+ burst fires thirty captures a second, and each one used to allocate five
 * full-resolution canvases. The intermediate surfaces are fully overwritten by
 * the next shot anyway, so they are kept and cleared instead of reallocated.
 * Only the canvas handed to `toBlob` is still allocated per capture, so an
 * in-flight encode can never be looking at a surface the next shot is painting.
 */
function reuseScratch(slot: Scratch | null, width: number, height: number): Scratch {
  if (!slot || slot.canvas.width !== width || slot.canvas.height !== height) return scratchCanvas(width, height);
  slot.context.clearRect(0, 0, width, height);
  return slot;
}

function noisePattern(pool: ScratchPool, context: CanvasRenderingContext2D, seed: number) {
  const tile = pool.noise?.tile ?? scratchCanvas(96, 96);
  const image = pool.noise?.image ?? tile.context.createImageData(96, 96);
  pool.noise = { tile, image };
  let value = seed;
  const data32 = new Uint32Array(image.data.buffer);
  for (let index = 0; index < data32.length; index += 1) {
    value = (value * 1103515245 + 12345) % 2147483648;
    const grain = (96 + (value / 2147483648) * 128) | 0;
    data32[index] = 0xff000000 | (grain << 16) | (grain << 8) | grain;
  }
  tile.context.putImageData(image, 0, 0);
  return context.createPattern(tile.canvas, "repeat");
}

function firstMaterial(material: Material | Material[] | undefined) {
  return Array.isArray(material) ? material[0] : material;
}

function collectMaterials(root: Object3D) {
  const materials = new Set<Material>();
  root.traverse(object => {
    const material = (object as Object3D & { material?: Material | Material[] }).material;
    if (Array.isArray(material)) material.forEach(item => materials.add(item));
    else if (material) materials.add(material);
  });
  return [...materials];
}

const Viewport3D = forwardRef<ViewportHandle, Props>(function Viewport3D({ scene, focal, aimX, aimY, frozen = false, onFocus, onLight, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const viewRef = useRef({ focal, yaw: 0, pitch: 0, scene, frozen, aimX, aimY });
  // React owns camera settings and lifecycle flags; the imperative setLook path
  // owns yaw/pitch so parent renders can never snap a live pan back to stale props.
  viewRef.current = { ...viewRef.current, focal, scene, frozen, aimX, aimY };
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;
  const lightRef = useRef(onLight);
  lightRef.current = onLight;

  useEffect(() => {
    let disposed = false, frame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    void (async () => {
      const [THREE, geometryUtils] = await Promise.all([import("./three-runtime"), import("three/addons/utils/BufferGeometryUtils.js")]);
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
      camera.rotation.order = "YXZ";
      const noop = () => {};
      const engine: Engine = { THREE, renderer, camera, built: null, sceneKey: null, elapsed: 0, epoch: performance.now(), focus: { focusM: 0, subjectM: 0 }, probedAt: 0, pixelRatio: 1, maximumPixelRatio: 1, projectionKey: "", scratch: { layers: [], composite: null, thumb: null, noise: null }, captureMaterials: [], aimCamera: noop, poseSubjects: noop, castCenter: () => [], probeFocus: () => ({ focusM: INFINITY_FOCUS_M, subjectM: 0 }), probeLight: () => ({ ev: 0 }), mount: noop, select: noop, warmScenes: noop, wake: noop, teardown: noop };
      engineRef.current = engine;

      const graphics = renderer.getContext();
      const debugRenderer = graphics.getExtension("WEBGL_debug_renderer_info");
      const rendererName = String(debugRenderer ? graphics.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL) : graphics.getParameter(graphics.RENDERER));
      const hardwareAccelerated = !/swiftshader|llvmpipe|software|microsoft basic render/i.test(rendererName);
      canvas.dataset.gpu = hardwareAccelerated ? "hardware" : "software";
      canvas.dataset.renderer = rendererName;
      canvas.dataset.webgl = renderer.capabilities.isWebGL2 ? "2" : "1";

      const raycaster = new THREE.Raycaster();
      raycaster.layers.enableAll();
      // Rain streaks and point clouds are atmosphere, not autofocus targets.
      raycaster.params.Line.threshold = 0;
      raycaster.params.Points.threshold = 0;
      const afPoint = new THREE.Vector2();
      const meterPoint = new THREE.Vector2();
      const forward = new THREE.Vector3();
      const emitterPosition = new THREE.Vector3();
      const toEmitter = new THREE.Vector3();
      const surfaceNormal = new THREE.Vector3();
      let subjectRoots = new Set<Object3D>();

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
        engine.maximumPixelRatio = cappedPixelRatio(window.devicePixelRatio || 1, width, height);
        if (!engine.pixelRatio || engine.pixelRatio > engine.maximumPixelRatio) engine.pixelRatio = engine.maximumPixelRatio;
        renderer.setPixelRatio(engine.pixelRatio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        engine.projectionKey = "";
        engine.aimCamera();
        engine.wake();
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      let lastFrameAt = 0, sampleStartedAt = 0, sampledFrames = 0, fastestFrameMs = Number.POSITIVE_INFINITY, stableWindows = 0, lastLightAt = 0, lastLightEv = Number.NaN;
      const scheduleFrame = () => {
        if (!disposed && !frame) frame = window.requestAnimationFrame(loop);
      };
      const loop = (now: number) => {
        frame = 0;
        if (!engine.built) return;
        if (document.hidden) { lastFrameAt = now; sampleStartedAt = now; sampledFrames = 0; return; }
        if (lastFrameAt) {
          const frameMs = now - lastFrameAt;
          if (frameMs >= 4 && frameMs <= 40) fastestFrameMs = Math.min(fastestFrameMs, frameMs);
        }
        lastFrameAt = now;
        if (!sampleStartedAt) sampleStartedAt = now;
        sampledFrames += 1;
        // Wall-clock, not accumulated deltas: a dropped or throttled frame must
        // not leave the subject behind where the exposure timing expects it.
        if (viewRef.current.frozen) engine.epoch = now - engine.elapsed * 1000;
        else engine.elapsed = (now - engine.epoch) / 1000;
        const view = viewRef.current;
        engine.aimCamera();
        engine.poseSubjects(engine.elapsed);
        for (const update of engine.built.updaters) update(engine.elapsed);
        const focusDue = !view.frozen && now - engine.probedAt > FOCUS_PROBE_MS;
        const lightDue = now - lastLightAt >= LIGHT_METER_MS;
        if (focusDue || lightDue) {
          // The AF frame and the metering spot are the same point on the sensor,
          // so one ray answers both. Two casts walked the same scene graph twice.
          const shared = view.aimX === 0 && view.aimY === 0 ? engine.castCenter(0, 0) : undefined;
          if (focusDue) {
            engine.probedAt = now;
            const reading = engine.probeFocus(shared);
            // Report only real movement: a metre of jitter at 90 m changes nothing,
            // half a metre at 4 m changes the whole photo.
            const moved = Math.abs(reading.focusM - engine.focus.focusM) > engine.focus.focusM * 0.01 || Math.abs(reading.subjectM - engine.focus.subjectM) > engine.focus.subjectM * 0.01;
            if (moved) { engine.focus = reading; focusRef.current?.(reading); }
          }
          if (lightDue) {
            const light = engine.probeLight(shared);
            const meteredEv = Math.round(light.ev / METER_STEP_EV) * METER_STEP_EV;
            if (!Number.isFinite(lastLightEv) || meteredEv !== lastLightEv) {
              lastLightEv = meteredEv;
              lightRef.current?.({ ev: meteredEv });
            }
            lastLightAt = now;
          }
        }
        camera.layers.enableAll();
        renderer.render(engine.built.scene, camera);
        if (now - sampleStartedAt >= PERFORMANCE_SAMPLE_MS) {
          const fps = (sampledFrames * 1000) / (now - sampleStartedAt);
          const targetFps = refreshTargetFps(fastestFrameMs);
          stableWindows = fps >= targetFps * 0.97 ? stableWindows + 1 : 0;
          const nextRatio = nextPixelRatio(engine.pixelRatio, engine.maximumPixelRatio, fps, targetFps, stableWindows);
          if (nextRatio !== engine.pixelRatio) {
            engine.pixelRatio = nextRatio;
            renderer.setPixelRatio(nextRatio);
            renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false);
            stableWindows = 0;
          }
          canvas.dataset.fps = fps.toFixed(0);
          canvas.dataset.targetFps = String(targetFps);
          canvas.dataset.pixelRatio = engine.pixelRatio.toFixed(3);
          canvas.dataset.drawCalls = String(renderer.info.render.calls);
          sampleStartedAt = now;
          sampledFrames = 0;
        }
        // Writing the same attribute value every frame still costs a DOM mutation.
        const renderState = view.frozen ? "paused" : "active";
        if (canvas.dataset.renderState !== renderState) canvas.dataset.renderState = renderState;
        if (!viewRef.current.frozen) scheduleFrame();
      };
      engine.wake = scheduleFrame;
      const onVisibilityChange = () => {
        if (!document.hidden) {
          engine.wake();
          engine.warmScenes();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      // Point the tripod head. A capture calls this too, so a photo never
      // depends on an animation frame having landed first.
      engine.aimCamera = (focalOverride?: number) => {
        const view = viewRef.current, world = engine.built?.world;
        if (!world) return;
        camera.position.set(0, world.cameraHeight, 0);
        camera.rotation.set((view.pitch + world.pitch) * DEG2RAD, view.yaw * DEG2RAD, 0);
        const takingFocal = focalOverride ?? view.focal;
        const projectionKey = `${takingFocal}:${camera.aspect}`;
        if (projectionKey !== engine.projectionKey) {
          camera.fov = verticalFieldOfView(takingFocal, camera.aspect);
          camera.updateProjectionMatrix();
          engine.projectionKey = projectionKey;
        }
        // The AF ray is cast from this matrix, and it can run before the first
        // render of a scene, which is what would otherwise have refreshed it.
        camera.updateMatrixWorld();
      };

      engine.poseSubjects = (seconds: number) => {
        const built = engine.built;
        if (!built) return;
        built.subjects.forEach((mesh, index) => {
          const pose = subjectPath(built.key, seconds, built.key === "bird" ? index / built.subjects.length : 0, index);
          mesh.position.set(pose.x, pose.y, pose.z);
          const yawRad = mesh.type === "Group" ? (pose.yaw * Math.PI) / 180 : Math.atan2(-pose.x, -pose.z);
          // Yaw-pitch-roll: the pitch axis has to be the model's own wing line,
          // otherwise a jet lined up along X would roll instead of rotating.
          mesh.rotation.order = "YXZ";
          mesh.rotation.set(((pose.pitch ?? 0) * Math.PI) / 180, yawRad, (pose.tilt * Math.PI) / 180);
          const shadow = built.shadows[index];
          if (shadow) { shadow.position.set(pose.x, 0.02, pose.z); shadow.visible = mesh.visible; }
        });
      };

      // One ray through a point on the sensor, sorted near to far. Autofocus and
      // the light meter both read the middle of the frame, so they share this
      // list instead of walking the whole scene graph twice.
      engine.castCenter = (x: number, y: number) => {
        const built = engine.built;
        if (!built) return [];
        // Raycasting reads world matrices, and only a render refreshes them. A probe
        // before this scene's first frame, or right after re-posing a subject, has to
        // do it itself or every object still measures as sitting on the tripod.
        built.scene.updateMatrixWorld();
        afPoint.set(x, y);
        raycaster.setFromCamera(afPoint, camera);
        return raycaster.intersectObjects(built.scene.children, true);
      };

      // Whatever sits under the AF frame is the plane the lens focuses on, exactly
      // like dropping the box onto a face instead of the wall behind it.
      engine.probeFocus = (sharedHits?: Intersection[]) => {
        const built = engine.built;
        if (!built) return { focusM: INFINITY_FOCUS_M, subjectM: 0 };

        const findSubjectForHit = (hitObject: Object3D) => {
          let curr: Object3D | null = hitObject;
          while (curr) {
            if (subjectRoots.has(curr)) return curr;
            curr = curr.parent;
          }
          return null;
        };

        const getFallbackSubjectM = () => {
          let minDistanceSq = Infinity;
          let closestSubjectM = (WORLD[built.key] ?? WORLD.landscape).focus;
          for (const s of built.subjects) {
            if (s.visible !== false) {
              const distSq = camera.position.distanceToSquared(s.position);
              if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestSubjectM = Math.sqrt(distSq);
              }
            }
          }
          return closestSubjectM;
        };

        // Recursive raycasting is required to penetrate 3D vehicle, animal & character groups
        const hits = sharedHits ?? engine.castCenter(viewRef.current.aimX, viewRef.current.aimY);
        for (const hit of hits) {
          const obj = hit.object as Partial<Mesh>;
          const mat = firstMaterial(obj.material) as MeshBasicMaterial | undefined;
          // Skip line segments (e.g. rain) and depthWrite: false visual decals (shadows, puddle glow)
          if (obj.isMesh && hit.distance > 0.05 && mat?.depthWrite !== false) {
            const subjectHit = findSubjectForHit(hit.object);
            const subjectM = subjectHit ? hit.distance : getFallbackSubjectM();
            return { focusM: hit.distance, subjectM };
          }
        }
        return { focusM: INFINITY_FOCUS_M, subjectM: getFallbackSubjectM() };
      };

      engine.probeLight = (sharedHits?: Intersection[]) => {
        const built = engine.built;
        if (!built) return { ev: 0 };
        if (!sharedHits) built.scene.updateMatrixWorld();
        camera.getWorldDirection(forward);
        const emitter = built.scene.userData.meteringEmitter;
        if (emitter?.getWorldPosition) emitter.getWorldPosition(emitterPosition);
        else emitterPosition.copy(built.sun.position);
        toEmitter.copy(emitterPosition).sub(camera.position).normalize();
        const sunAlignment = Math.max(0, forward.dot(toEmitter));

        // Reflected-light meters respond to what fills the frame. The centre ray
        // samples the aimed surface, including its colour, emissive glow and how
        // directly it faces the key light; sky falls back to the view direction.
        let meterHits = sharedHits;
        if (!meterHits) {
          raycaster.setFromCamera(meterPoint, camera);
          meterHits = raycaster.intersectObjects(built.scene.children, true);
        }
        const hit = meterHits.find(item => {
          const obj = item.object as Partial<Mesh>;
          const mat = firstMaterial(obj.material) as MeshBasicMaterial | undefined;
          return obj.isMesh && item.object !== emitter && mat?.depthWrite !== false;
        });
        let surfaceLuminance: number | null = null, emissiveLuminance = 0, incidence = 1;
        if (hit) {
          const material = firstMaterial((hit.object as Mesh).material) as MeshBasicMaterial & { emissive?: { r: number; g: number; b: number }; emissiveIntensity?: number };
          if (material?.color) surfaceLuminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
          if (material?.emissive) emissiveLuminance = (material.emissive.r * 0.2126 + material.emissive.g * 0.7152 + material.emissive.b * 0.0722) * (material.emissiveIntensity ?? 1);
          if (hit.face) {
            surfaceNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
            incidence = Math.max(0, surfaceNormal.dot(toEmitter));
          }
        }
        const localEv = viewMeterAdjustment({ sunAlignment, surfaceLuminance, incidence, emissiveLuminance });
        return { ev: localEv };
      };

      const disposeBuiltWorld = () => {
        if (!engine.built) return;
        disposeObjectTree(engine.built.scene, renderer);
        engine.built = null;
        subjectRoots.clear();
      };

      engine.mount = (key: SceneKey, sceneModule: SceneModule) => {
        disposeBuiltWorld();
        // scene3d.mjs is dependency-injected and only touches exports provided by
        // three-runtime.ts. Its inferred JS signature widens that parameter to
        // the complete Three namespace, so keep the narrowing at this boundary.
        const built = buildScene(THREE as unknown as typeof import("three"), key, geometryUtils.mergeGeometries, sceneModule) as unknown as BuiltWorld;
        built.key = key;
        engine.built = built;
        engine.captureMaterials = collectMaterials(built.scene);
        subjectRoots = new Set(built.subjects);
        engine.elapsed = 0;
        engine.epoch = performance.now();
        engine.focus = { focusM: 0, subjectM: 0 };
        engine.probedAt = 0;
        engine.poseSubjects(0);
        if (built.shadows[0]) built.shadows[0].material.opacity = 0.24;
        renderer.setClearColor(0x000000, 0);
        resize();
        engine.wake();
      };

      // Each scenario's geometry is its own chunk. The requested world is claimed
      // before the await so a fast switch supersedes an older resolution, and the
      // previous world keeps rendering until the replacement is actually in hand.
      engine.select = (key: SceneKey) => {
        engine.sceneKey = key;
        void loadSceneModule(key).then((sceneModule: SceneModule) => {
          if (disposed || engine.sceneKey !== key) return;
          engine.mount(key, sceneModule);
        });
      };

      // The first world is visible behind the start card, but the other ten are
      // not needed until the player enters the camera. Warm them only after that
      // interaction, only on a capable connection, and only once the main thread
      // has an idle slot. Scene imports themselves remain sequential.
      let scenesWarmed = false;
      let warmIdleId: number | null = null;
      let warmTimer = 0;
      engine.warmScenes = () => {
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
        if (scenesWarmed || viewRef.current.frozen || document.hidden || !shouldPrefetchScenes(connection)) return;
        scenesWarmed = true;
        const warm = () => {
          warmIdleId = null;
          warmTimer = 0;
          const canContinue = () => {
            const currentConnection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
            return !disposed && !viewRef.current.frozen && !document.hidden && shouldPrefetchScenes(currentConnection);
          };
          if (!engine.sceneKey || !canContinue()) {
            scenesWarmed = false;
            return;
          }
          void prefetchOtherScenes(engine.sceneKey, canContinue).then(completed => {
            if (!completed) scenesWarmed = false;
          });
        };
        if (typeof window.requestIdleCallback === "function") warmIdleId = window.requestIdleCallback(warm, { timeout: 2500 });
        else warmTimer = window.setTimeout(warm, 600);
      };

      const firstKey = viewRef.current.scene;
      const firstModule = await loadSceneModule(firstKey);
      if (disposed) return;
      engine.sceneKey = firstKey;
      engine.mount(firstKey, firstModule);
      engine.wake();
      onReady?.();
      engine.warmScenes();

      engine.teardown = () => {
        if (warmIdleId !== null) window.cancelIdleCallback(warmIdleId);
        window.clearTimeout(warmTimer);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        observer.disconnect();
        engine.mount = noop;
        engine.select = noop;
        engine.warmScenes = noop;
        disposeBuiltWorld();
        engine.captureMaterials = [];
        // Release the capture surfaces: five full-resolution canvases can be tens
        // of megabytes of backing store the page no longer has any use for.
        engine.scratch = { layers: [], composite: null, thumb: null, noise: null };
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      engineRef.current?.teardown();
      engineRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    engineRef.current?.wake();
    engineRef.current?.warmScenes();
  }, [focal, aimX, aimY, frozen]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.built || engine.sceneKey === scene) return;
    viewRef.current.yaw = 0;
    viewRef.current.pitch = 0;
    engine.select(scene);
  }, [scene]);

  useImperativeHandle(ref, () => ({
    setLook(nextLook) {
      const view = viewRef.current;
      if (view.yaw === nextLook.yaw && view.pitch === nextLook.pitch) return;
      view.yaw = nextLook.yaw;
      view.pitch = nextLook.pitch;
      engineRef.current?.wake();
    },
    capture(request) {
      const engine = engineRef.current;
      if (!engine?.built) return null;
      const { THREE, renderer, camera, built } = engine;
      // Expose at the instant the shutter was pressed, not at the last painted
      // frame, so a slow frame rate cannot nudge the subject out of the shot.
      if (!viewRef.current.frozen) engine.elapsed = (performance.now() - engine.epoch) / 1000;
      // Pose the world at the instant the shutter fired before reading the AF frame,
      // so a bird is measured where it is now, not where the last frame left it.
      engine.poseSubjects(engine.elapsed);
      engine.aimCamera(request.focalMm);
      // Read the AF frame through the taking focal length, so a shot fired mid-zoom
      // focuses on whatever the frame covers at that angle rather than the last one.
      const reading = engine.probeFocus();
      engine.focus = reading;
      focusRef.current?.(reading);
      const source: HTMLCanvasElement = renderer.domElement;
      const liveWidth = Math.max(1, source.clientWidth);
      const liveHeight = Math.max(1, source.clientHeight);
      const livePixelRatio = renderer.getPixelRatio();
      const { width, height } = photoOutputSize(liveWidth, liveHeight);

      const span = Math.min(request.shutterSeconds, 30);
      const trajectory = request.lookTrajectory && request.lookTrajectory.length > 0
        ? request.lookTrajectory
        : [{ yaw: (camera.rotation.y * 180) / Math.PI, pitch: (camera.rotation.x * 180) / Math.PI - built.world.pitch }];
      const cameraMotionAngle = trajectoryDistance(trajectory);
      const cameraMotionPx = (cameraMotionAngle / Math.max(0.01, verticalFieldOfView(request.focalMm, camera.aspect))) * height;

      // Measure the projected path, not just start-to-end displacement. A runner
      // completing a lap or a pan returning to its origin still crosses the frame
      // during the exposure and must not collapse to a single temporal sample.
      const projected = new THREE.Vector3();
      let subjectMotionPx = 0;
      built.subjects.forEach((_, subjectIndex) => {
        let previousX = 0, previousY = 0, pathPixels = 0;
        for (let probe = 0; probe <= MOTION_PROBE_SEGMENTS; probe += 1) {
          const probeTime = engine.elapsed + span * (probe / MOTION_PROBE_SEGMENTS);
          const pose = subjectPath(built.key, probeTime, built.key === "bird" ? subjectIndex / built.subjects.length : 0, subjectIndex);
          projected.set(pose.x, pose.y, pose.z).project(camera);
          if (probe > 0) pathPixels += Math.hypot((projected.x - previousX) * width * 0.5, (projected.y - previousY) * height * 0.5);
          previousX = projected.x;
          previousY = projected.y;
        }
        subjectMotionPx = Math.max(subjectMotionPx, pathPixels);
      });
      const motionPixels = subjectMotionPx + request.shakePx * 2 + cameraMotionPx * 0.75;
      const samples = captureSampleCount(motionPixels);
      const poses = exposureSamples(built.key, engine.elapsed, span, samples);
      const blur = depthBlurPlan(built.key, { focalMm: request.focalMm, fNumber: request.fNumber, imageWidthPx: width, ...reading });

      const pool = engine.scratch;
      const layers = BUCKETS.map((_, index) => (pool.layers[index] = reuseScratch(pool.layers[index] ?? null, width, height)));
      const shakeRadians = ((request.shakePx / width) * verticalFieldOfView(request.focalMm, camera.aspect) * camera.aspect * Math.PI) / 180;
      const shakeAngle = (engine.elapsed % 1) * Math.PI * 2;
      const invSamplesMinus1 = 1 / Math.max(1, samples - 1);
      const invSamples = 1 / Math.max(1, samples);
      const trajLenMinus1 = trajectory.length - 1;

      // Additive accumulation averages the sub-frames exactly. Plain source-over
      // at alpha 1/N converges to 1-(1-1/N)^N of the true value, darkening every shot.
      for (const layer of layers) { layer.context.globalAlpha = 1 / samples; layer.context.globalCompositeOperation = "lighter"; }
      try {
        // Capture from a real photo-sized WebGL drawing buffer. Scaling a small
        // phone canvas into a 1920 px JPEG would meet the file dimensions but not
        // the requested image quality. CSS sizing is untouched, so the viewfinder
        // stays in place while the backing buffer is temporarily upgraded.
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        engine.projectionKey = "";
        engine.aimCamera(request.focalMm);
        for (const [step] of poses.entries()) {
          const fraction = step * invSamplesMinus1;
          const trajIndex = fraction * trajLenMinus1;
          const idx0 = Math.floor(trajIndex);
          const idx1 = Math.min(trajLenMinus1, Math.ceil(trajIndex));
          const tFrac = trajIndex - idx0;
          const curYaw = trajectory[idx0].yaw + (trajectory[idx1].yaw - trajectory[idx0].yaw) * tFrac;
          const curPitch = trajectory[idx0].pitch + (trajectory[idx1].pitch - trajectory[idx0].pitch) * tFrac;

          const subDrift = (fraction - 0.5) * shakeRadians;
          // The trajectory arrives in viewfinder degrees relative to the scene's base
          // tilt, so it takes the same conversion aimCamera uses. Skip it and the shot
          // is fired from a different direction than the one the user framed.
          camera.rotation.y = curYaw * DEG2RAD + Math.cos(shakeAngle) * subDrift;
          camera.rotation.x = (curPitch + built.world.pitch) * DEG2RAD + Math.sin(shakeAngle) * subDrift;
          const stepTime = engine.elapsed + span * step * invSamples;
          built.subjects.forEach((mesh, index) => {
            const subjectPose = subjectPath(built.key, stepTime, built.key === "bird" ? index / built.subjects.length : 0, index);
            mesh.position.set(subjectPose.x, subjectPose.y, subjectPose.z);
            const yawRad = mesh.type === "Group" ? (subjectPose.yaw * Math.PI) / 180 : Math.atan2(-subjectPose.x, -subjectPose.z);
            mesh.rotation.order = "YXZ";
            mesh.rotation.set(((subjectPose.pitch ?? 0) * Math.PI) / 180, yawRad, (subjectPose.tilt * Math.PI) / 180);
            const shadow = built.shadows[index];
            if (shadow) shadow.position.set(subjectPose.x, 0.02, subjectPose.z);
          });
          // Each blur bucket needs the complete scene's depth buffer. Rendering a
          // subject layer by itself loses every tree, rail, vehicle, or person in
          // front of it, and the later 2D composite then paints moving objects on
          // top of the photograph. Populate depth once with normal materials but
          // color writes disabled, then reuse that depth while clearing only color
          // between buckets. Materials whose depthWrite is false (rain, glows,
          // contact shadows) remain non-occluding just as they are in live view.
          const previousAutoClear = renderer.autoClear;
          const colorWriteStates = engine.captureMaterials.map(material => material.colorWrite);
          try {
            renderer.autoClear = false;
            camera.layers.enableAll();
            renderer.setClearColor(0x000000, 1);
            renderer.clear(true, true, true);
            engine.captureMaterials.forEach(material => { material.colorWrite = false; });
            renderer.render(built.scene, camera);
            engine.captureMaterials.forEach((material, index) => { material.colorWrite = colorWriteStates[index]; });

            BUCKETS.forEach((bucket, index) => {
              if (index > 0) {
                renderer.setClearColor(0x000000, 0);
                renderer.clear(true, false, false);
              }
              camera.layers.set(bucket);
              renderer.render(built.scene, camera);
              layers[index].context.drawImage(source, 0, 0, width, height);
            });
          } finally {
            engine.captureMaterials.forEach((material, index) => { material.colorWrite = colorWriteStates[index]; });
            renderer.autoClear = previousAutoClear;
            camera.layers.enableAll();
            renderer.setClearColor(0x000000, 0);
          }
        }
      } finally {
        // The live renderer must be restored even if a material or canvas draw
        // fails, otherwise one failed photo could leave the UI at capture cost.
        camera.layers.enableAll();
        renderer.setPixelRatio(livePixelRatio);
        renderer.setSize(liveWidth, liveHeight, false);
        camera.aspect = liveWidth / liveHeight;
        engine.projectionKey = "";
        engine.aimCamera();
        engine.poseSubjects(engine.elapsed);
        renderer.setClearColor(0x000000, 0);
        renderer.render(built.scene, camera);
      }
      for (const layer of layers) { layer.context.globalAlpha = 1; layer.context.globalCompositeOperation = "source-over"; }

      const composite = (pool.composite = reuseScratch(pool.composite, width, height));
      const radii = [blur.far, blur.subject, blur.near];
      layers.forEach((layer, index) => {
        const radius = radii[index];
        composite.context.filter = radius > 0.35 ? `blur(${radius.toFixed(2)}px)` : "none";
        const bleed = index === 0 ? Math.ceil(radius) : 0;
        composite.context.drawImage(layer.canvas, -bleed, -bleed, width + bleed * 2, height + bleed * 2);
      });
      composite.context.filter = "none";

      // The only surface allocated per shot: `toBlob` encodes it asynchronously, so
      // it must not be the canvas the next frame of a burst starts painting over.
      const output = scratchCanvas(width, height);
      output.context.filter = `brightness(${request.brightness.toFixed(3)}) saturate(${(1 - Math.min(0.4, request.noise)).toFixed(3)})`;
      output.context.drawImage(composite.canvas, 0, 0);
      output.context.filter = "none";
      if (request.noise > 0.01) {
        const pattern = noisePattern(pool, output.context, Math.floor(engine.elapsed * 1000) + 7);
        if (pattern) {
          output.context.globalAlpha = Math.min(0.55, request.noise);
          output.context.globalCompositeOperation = "soft-light";
          output.context.fillStyle = pattern;
          output.context.fillRect(0, 0, width, height);
          output.context.globalAlpha = 1;
          output.context.globalCompositeOperation = "source-over";
        }
      }
      const thumbWidth = Math.min(320, width);
      const thumbHeight = Math.max(1, Math.round((height / width) * thumbWidth));
      const thumbCanvas = (pool.thumb = reuseScratch(pool.thumb, thumbWidth, thumbHeight));
      thumbCanvas.context.drawImage(output.canvas, 0, 0, width, height, 0, 0, thumbWidth, thumbHeight);
      const thumb = thumbCanvas.canvas.toDataURL("image/jpeg", 0.7);
      // toBlob encodes async and off the JS-string heap; the caller decides when
      // (and whether) to mint an object URL from the bytes it hands back.
      const image = new Promise<Blob | null>(resolve => {
        output.canvas.toBlob(resolve, "image/jpeg", 0.92);
      });
      return { width, height, thumb, image, ...reading };
    },
  }), []);

  return <canvas ref={canvasRef} className="live-canvas" />;
});

export default Viewport3D;
