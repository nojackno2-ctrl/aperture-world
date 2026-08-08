"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { DirectionalLight, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { exposureSamples, subjectPath } from "./motion.mjs";
import { verticalFieldOfView } from "./optics.mjs";
import { cappedPixelRatio, nextPixelRatio, refreshTargetFps } from "./performance.mjs";
import { buildScene } from "./scene3d.mjs";
import { LAYER, WORLD, depthBlurPlan, viewMeterAdjustment } from "./world.mjs";

type SceneKey = "landscape" | "bird" | "sports" | "portrait" | "group" | "street" | "night";
type Billboard = Mesh & { material: MeshBasicMaterial };
type BuiltWorld = { key: SceneKey; scene: Scene; subjects: Billboard[]; shadows: Billboard[]; sun: DirectionalLight; updaters: ((elapsed: number) => void)[]; world: { cameraHeight: number; pitch: number } };
/** What the AF frame is sitting on, and how far the subject itself now stands. */
export type FocusReading = { focusM: number; subjectM: number };
export type LightReading = { ev: number };
type Engine = {
  THREE: typeof import("three"); renderer: WebGLRenderer; camera: PerspectiveCamera; built: BuiltWorld | null; sceneKey: SceneKey | null; elapsed: number; epoch: number; focus: FocusReading; probedAt: number;
  pixelRatio: number; maximumPixelRatio: number; projectionKey: string;
  aimCamera: (focalOverride?: number) => void; poseSubjects: (seconds: number) => void; probeFocus: () => FocusReading; probeLight: () => LightReading; mount: (key: SceneKey) => void; teardown: () => void;
};
export type CaptureRequest = { focalMm: number; fNumber: number; shutterSeconds: number; brightness: number; noise: number; shakePx: number };
export type CaptureResult = FocusReading & { image: string };
export type ViewportHandle = { capture: (request: CaptureRequest) => CaptureResult | null };
type Props = { scene: SceneKey; focal: number; yaw: number; pitch: number; aimX: number; aimY: number; frozen?: boolean; onFocus?: (reading: FocusReading) => void; onLight?: (reading: LightReading) => void; onReady?: () => void };

/** Longest slice of a long exposure that still reads as a streak instead of ghosts. */
const MAX_EXPOSURE_SPAN_SECONDS = 2;
const MAX_CAPTURE_WIDTH = 1600;
const BUCKETS = [LAYER.far, LAYER.subject, LAYER.near] as const;
/** Nothing solid under the AF frame: the lens racks past the sky dome, to infinity. */
const INFINITY_FOCUS_M = 4000;
/** Re-reading the AF frame every frame is wasted work; the world moves slower than that. */
const FOCUS_PROBE_MS = 110;
const PERFORMANCE_SAMPLE_MS = 1000;
const LIGHT_METER_MS = 160;

function scratchCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  return { canvas, context: canvas.getContext("2d") as CanvasRenderingContext2D };
}

function noisePattern(context: CanvasRenderingContext2D, seed: number) {
  const tile = scratchCanvas(96, 96);
  const image = tile.context.createImageData(96, 96);
  let value = seed;
  for (let index = 0; index < image.data.length; index += 4) {
    value = (value * 1103515245 + 12345) % 2147483648;
    const grain = 96 + (value / 2147483648) * 128;
    image.data[index] = image.data[index + 1] = image.data[index + 2] = grain;
    image.data[index + 3] = 255;
  }
  tile.context.putImageData(image, 0, 0);
  return context.createPattern(tile.canvas, "repeat");
}

const Viewport3D = forwardRef<ViewportHandle, Props>(function Viewport3D({ scene, focal, yaw, pitch, aimX, aimY, frozen = false, onFocus, onLight, onReady }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const viewRef = useRef({ focal, yaw, pitch, scene, frozen, aimX, aimY });
  viewRef.current = { focal, yaw, pitch, scene, frozen, aimX, aimY };
  if (engineRef.current) {
    engineRef.current.aimCamera();
  }
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;
  const lightRef = useRef(onLight);
  lightRef.current = onLight;

  useEffect(() => {
    let disposed = false, frame = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    void (async () => {
      const [THREE, geometryUtils] = await Promise.all([import("three"), import("three/addons/utils/BufferGeometryUtils.js")]);
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
      camera.rotation.order = "YXZ";
      const noop = () => {};
      const engine: Engine = { THREE, renderer, camera, built: null, sceneKey: null, elapsed: 0, epoch: performance.now(), focus: { focusM: 0, subjectM: 0 }, probedAt: 0, pixelRatio: 1, maximumPixelRatio: 1, projectionKey: "", aimCamera: noop, poseSubjects: noop, probeFocus: () => ({ focusM: INFINITY_FOCUS_M, subjectM: 0 }), probeLight: () => ({ ev: 0 }), mount: noop, teardown: noop };
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

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
        engine.maximumPixelRatio = cappedPixelRatio(window.devicePixelRatio || 1, width, height);
        if (!engine.pixelRatio || engine.pixelRatio > engine.maximumPixelRatio) engine.pixelRatio = engine.maximumPixelRatio;
        renderer.setPixelRatio(engine.pixelRatio);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        engine.projectionKey = "";
        engine.aimCamera();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      let lastFrameAt = 0, sampleStartedAt = 0, sampledFrames = 0, fastestFrameMs = Number.POSITIVE_INFINITY, stableWindows = 0, lastLightAt = 0, lastLightEv = Number.NaN;
      const loop = (now: number) => {
        frame = window.requestAnimationFrame(loop);
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
        engine.aimCamera();
        engine.poseSubjects(engine.elapsed);
        if (!viewRef.current.frozen && now - engine.probedAt > FOCUS_PROBE_MS) {
          engine.probedAt = now;
          const reading = engine.probeFocus();
          // Report only real movement: a metre of jitter at 90 m changes nothing,
          // half a metre at 4 m changes the whole photo.
          const moved = Math.abs(reading.focusM - engine.focus.focusM) > engine.focus.focusM * 0.01 || Math.abs(reading.subjectM - engine.focus.subjectM) > engine.focus.subjectM * 0.01;
          if (moved) { engine.focus = reading; focusRef.current?.(reading); }
        }
        for (const update of engine.built.updaters) update(engine.elapsed);
        if (now - lastLightAt >= LIGHT_METER_MS) {
          const light = engine.probeLight();
          if (!Number.isFinite(lastLightEv) || Math.abs(light.ev - lastLightEv) >= 0.025) {
            lastLightEv = light.ev;
            lightRef.current?.({ ev: light.ev, level: light.level });
          }
          lastLightAt = now;
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
      };

      // Point the tripod head. A capture calls this too, so a photo never
      // depends on an animation frame having landed first.
      engine.aimCamera = (focalOverride?: number) => {
        const view = viewRef.current, world = engine.built?.world;
        if (!world) return;
        camera.position.set(0, world.cameraHeight, 0);
        camera.rotation.set((view.pitch + world.pitch) * Math.PI / 180, view.yaw * Math.PI / 180, 0);
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
          const yawRad = (mesh.type === "Group" || (mesh as Partial<Billboard>).isGroup) ? (pose.yaw * Math.PI) / 180 : Math.atan2(-pose.x, -pose.z);
          mesh.rotation.set(0, yawRad, (pose.tilt * Math.PI) / 180);
          const shadow = built.shadows[index];
          if (shadow) { shadow.position.set(pose.x, 0.02, pose.z); shadow.visible = mesh.visible; }
        });
        if (built.shadows[0]) built.shadows[0].material.opacity = 0.24;
      };

      // Whatever sits under the AF frame is the plane the lens focuses on, exactly
      // like dropping the box onto a face instead of the wall behind it.
      engine.probeFocus = () => {
        const built = engine.built;
        if (!built) return { focusM: INFINITY_FOCUS_M, subjectM: 0 };
        // Raycasting reads world matrices, and only a render refreshes them. A probe
        // before this scene's first frame, or right after re-posing a subject, has to
        // do it itself or every object still measures as sitting on the tripod.
        built.scene.updateMatrixWorld();

        const findSubjectForHit = (hitObject: THREE.Object3D) => {
          let curr: THREE.Object3D | null = hitObject;
          while (curr) {
            if (built.subjects.includes(curr as any)) return curr;
            curr = curr.parent;
          }
          return null;
        };

        const getFallbackSubjectM = () => {
          let minDistance = Infinity;
          let closestSubjectM = (WORLD[built.key] ?? WORLD.landscape).focus;
          for (const s of built.subjects) {
            if (s.visible !== false) {
              const dist = camera.position.distanceTo(s.position);
              if (dist < minDistance) {
                minDistance = dist;
                closestSubjectM = dist;
              }
            }
          }
          return closestSubjectM;
        };

        afPoint.set(viewRef.current.aimX, viewRef.current.aimY);
        raycaster.setFromCamera(afPoint, camera);
        // Recursive raycasting is required to penetrate 3D vehicle, animal & character groups
        const hits = raycaster.intersectObjects(built.scene.children, true);
        for (const hit of hits) {
          const obj = hit.object as Partial<Mesh>;
          const mat = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as MeshBasicMaterial | undefined;
          // Skip line segments (e.g. rain) and depthWrite: false visual decals (shadows, puddle glow)
          if (obj.isMesh && hit.distance > 0.05 && mat?.depthWrite !== false) {
            const subjectHit = findSubjectForHit(hit.object);
            const subjectM = subjectHit ? hit.distance : getFallbackSubjectM();
            return { focusM: hit.distance, subjectM };
          }
        }
        return { focusM: INFINITY_FOCUS_M, subjectM: getFallbackSubjectM() };
      };

      engine.probeLight = () => {
        const built = engine.built;
        if (!built) return { ev: 0 };
        built.scene.updateMatrixWorld();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const emitter = built.scene.userData.meteringEmitter;
        const emitterPosition = new THREE.Vector3();
        if (emitter?.getWorldPosition) emitter.getWorldPosition(emitterPosition);
        else emitterPosition.copy(built.sun.position);
        const toEmitter = emitterPosition.sub(camera.position).normalize();
        const sunAlignment = Math.max(0, forward.dot(toEmitter));

        // Reflected-light meters respond to what fills the frame. The centre ray
        // samples the aimed surface, including its colour, emissive glow and how
        // directly it faces the key light; sky falls back to the view direction.
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const hit = raycaster.intersectObjects(built.scene.children, true).find(item => {
          const obj = item.object as Partial<Mesh>;
          const mat = (Array.isArray(obj.material) ? obj.material[0] : obj.material) as MeshBasicMaterial | undefined;
          return obj.isMesh && item.object !== emitter && mat?.depthWrite !== false;
        });
        let surfaceLuminance: number | null = null, emissiveLuminance = 0, incidence = 1;
        if (hit) {
          const material = (Array.isArray((hit.object as Mesh).material) ? (hit.object as Mesh).material[0] : (hit.object as Mesh).material) as MeshBasicMaterial & { emissive?: { r: number; g: number; b: number }; emissiveIntensity?: number };
          if (material?.color) surfaceLuminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
          if (material?.emissive) emissiveLuminance = (material.emissive.r * 0.2126 + material.emissive.g * 0.7152 + material.emissive.b * 0.0722) * (material.emissiveIntensity ?? 1);
          if (hit.face) {
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            incidence = Math.max(0, normal.dot(toEmitter));
          }
        }
        const localEv = viewMeterAdjustment({ sunAlignment, surfaceLuminance, incidence, emissiveLuminance });
        return { ev: localEv };
      };

      engine.mount = (key: SceneKey) => {
        if (engine.built) {
          engine.built.scene.traverse(object => {
            const mesh = object as Partial<Mesh>;
            mesh.geometry?.dispose?.();
            const material = mesh.material;
            for (const item of Array.isArray(material) ? material : material ? [material] : []) { (item as MeshBasicMaterial).map?.dispose?.(); item.dispose?.(); }
          });
        }
        const built = buildScene(THREE, key, geometryUtils.mergeGeometries) as unknown as BuiltWorld;
        built.key = key;
        engine.built = built;
        engine.elapsed = 0;
        engine.epoch = performance.now();
        engine.focus = { focusM: 0, subjectM: 0 };
        engine.probedAt = 0;
        engine.poseSubjects(0);
        renderer.setClearColor(0x000000, 0);
        resize();
      };

      engine.mount(viewRef.current.scene);
      engine.sceneKey = viewRef.current.scene;
      frame = window.requestAnimationFrame(loop);
      onReady?.();

      engine.teardown = () => { observer.disconnect(); renderer.dispose(); };
    })();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      engineRef.current?.teardown();
      engineRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine?.built || engine.sceneKey === scene) return;
    engine.mount(scene);
    engine.sceneKey = scene;
  }, [scene]);

  useImperativeHandle(ref, () => ({
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
      const width = Math.min(MAX_CAPTURE_WIDTH, source.width) || 1;
      const height = Math.max(1, Math.round((source.height / source.width) * width));

      const span = Math.min(request.shutterSeconds, MAX_EXPOSURE_SPAN_SECONDS);
      // Enough sub-frames that the smear stays continuous: one per few pixels the
      // subject and the shake actually travel, rather than a fixed cadence.
      const travel = [subjectPath(built.key, engine.elapsed), subjectPath(built.key, engine.elapsed + span)]
        .map(pose => new THREE.Vector3(pose.x, pose.y, pose.z).project(camera));
      const drift = Math.hypot(travel[1].x - travel[0].x, travel[1].y - travel[0].y) * 0.5 * width;
      const samples = Math.max(8, Math.min(40, Math.ceil((drift + request.shakePx * 2) / 2.5)));
      const poses = exposureSamples(built.key, engine.elapsed, span, samples);
      const blur = depthBlurPlan(built.key, { focalMm: request.focalMm, fNumber: request.fNumber, imageWidthPx: width, ...reading });

      const layers = BUCKETS.map(() => scratchCanvas(width, height));
      const shakeRadians = ((request.shakePx / width) * verticalFieldOfView(request.focalMm, camera.aspect) * camera.aspect * Math.PI) / 180;
      const shakeAngle = (engine.elapsed % 1) * Math.PI * 2;
      const baseYaw = camera.rotation.y, basePitch = camera.rotation.x;

      // Additive accumulation averages the sub-frames exactly. Plain source-over
      // at alpha 1/N converges to 1-(1-1/N)^N of the true value, darkening every shot.
      for (const layer of layers) { layer.context.globalAlpha = 1 / samples; layer.context.globalCompositeOperation = "lighter"; }
      for (const [step, pose] of poses.entries()) {
        const drift = (step / Math.max(1, samples - 1) - 0.5) * shakeRadians;
        camera.rotation.y = baseYaw + Math.cos(shakeAngle) * drift;
        camera.rotation.x = basePitch + Math.sin(shakeAngle) * drift;
        camera.updateProjectionMatrix();
        built.subjects.forEach((mesh, index) => {
          const subjectPose = subjectPath(built.key, engine.elapsed + (span * step) / Math.max(1, samples), built.key === "bird" ? index / built.subjects.length : 0, index);
          mesh.position.set(subjectPose.x, subjectPose.y, subjectPose.z);
          const yawRad = (mesh.type === "Group" || (mesh as Partial<Billboard>).isGroup) ? (subjectPose.yaw * Math.PI) / 180 : Math.atan2(-subjectPose.x, -subjectPose.z);
          mesh.rotation.set(0, yawRad, (subjectPose.tilt * Math.PI) / 180);
          const shadow = built.shadows[index];
          if (shadow) shadow.position.set(subjectPose.x, 0.02, subjectPose.z);
        });
        BUCKETS.forEach((bucket, index) => {
          camera.layers.set(bucket);
          renderer.setClearColor(0x000000, bucket === LAYER.far ? 1 : 0);
          renderer.render(built.scene, camera);
          layers[index].context.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
        });
      }
      for (const layer of layers) { layer.context.globalAlpha = 1; layer.context.globalCompositeOperation = "source-over"; }

      camera.layers.enableAll();
      engine.aimCamera();
      engine.poseSubjects(engine.elapsed);

      const composite = scratchCanvas(width, height);
      const radii = [blur.far, blur.subject, blur.near];
      layers.forEach((layer, index) => {
        const radius = radii[index];
        composite.context.filter = radius > 0.35 ? `blur(${radius.toFixed(2)}px)` : "none";
        const bleed = index === 0 ? Math.ceil(radius) : 0;
        composite.context.drawImage(layer.canvas, -bleed, -bleed, width + bleed * 2, height + bleed * 2);
      });
      composite.context.filter = "none";

      const output = scratchCanvas(width, height);
      output.context.filter = `brightness(${request.brightness.toFixed(3)}) saturate(${(1 - Math.min(0.4, request.noise)).toFixed(3)})`;
      output.context.drawImage(composite.canvas, 0, 0);
      output.context.filter = "none";
      if (request.noise > 0.01) {
        const pattern = noisePattern(output.context, Math.floor(engine.elapsed * 1000) + 7);
        if (pattern) {
          output.context.globalAlpha = Math.min(0.55, request.noise);
          output.context.globalCompositeOperation = "soft-light";
          output.context.fillStyle = pattern;
          output.context.fillRect(0, 0, width, height);
          output.context.globalAlpha = 1;
          output.context.globalCompositeOperation = "source-over";
        }
      }
      return { image: output.canvas.toDataURL("image/jpeg", 0.86), ...reading };
    },
  }), []);

  return <canvas ref={canvasRef} className="live-canvas" />;
});

export default Viewport3D;
